/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/router.js
 *
 * Responsabilidad:
 *   Decidir qué pantalla se muestra según la parte de la URL después del
 *   "#" (hash): #/login, #/bandeja/nuevas, #/solicitudes/abc123, etc. Cambiar el hash
 *   no recarga la página, así que la app funciona como SPA (Single Page
 *   Application) sin configurar el servidor.
 *   También protege las pantallas: sin sesión redirige al login, y las rutas
 *   restringidas a ciertos roles redirigen al inicio.
 *
 * Depende de: nada (recibe el contenedor y una función para saber quién está logueado).
 *
 * Nota: esta protección es solo de navegación (experiencia de usuario).
 *   La seguridad real de los datos está en firestore.rules.
 * =============================================================
 */

/**
 * @typedef {Object} Ruta
 * @property {string[]} segmentos - Patrón dividido por "/"; los que empiezan con ":" son parámetros.
 * @property {(contenedor: HTMLElement, usuario: import('../data/modelos.js').Usuario|null, parametros: Record<string, string>) => void} renderizar
 * @property {boolean} publica - true = se puede ver sin sesión (solo el login).
 * @property {string[]|null} roles - Si se indica, solo esos roles pueden entrar.
 */

export const RUTA_LOGIN = '#/login';
/** Pantalla principal después del login: la bandeja (pestaña Pendientes). */
export const RUTA_INICIO = '#/bandeja';
export const RUTA_BANDEJA_PESTANA = '#/bandeja/:pestana';
export const RUTA_NUEVA_SOLICITUD = '#/solicitudes/nueva';
export const RUTA_DETALLE_SOLICITUD = '#/solicitudes/:id';

/** Mantenimiento (solo admin). */
export const RUTA_USUARIOS = '#/usuarios';
export const RUTA_NUEVO_USUARIO = '#/usuarios/nuevo';
export const RUTA_FICHA_USUARIO = '#/usuarios/:id';
export const RUTA_ROLES = '#/roles';

/**
 * Arma el hash de la ficha de un usuario.
 * @param {string} id - uid del usuario.
 * @returns {string} Ej: "#/usuarios/abc123".
 */
export const rutaFichaUsuario = (id) => `#/usuarios/${encodeURIComponent(id)}`;

/**
 * Arma el hash de una pestaña de la bandeja.
 * @param {string} pestana - Una de PESTANAS_BANDEJA.
 * @returns {string} Ej: "#/bandeja/nuevas".
 */
export const rutaBandeja = (pestana) => `#/bandeja/${encodeURIComponent(pestana)}`;

/**
 * Arma el hash del detalle de una solicitud.
 * @param {string} id
 * @returns {string} Ej: "#/solicitudes/abc123".
 */
export const rutaDetalle = (id) => `#/solicitudes/${encodeURIComponent(id)}`;

/** @type {Ruta[]} */
const rutas = [];

let contenedorApp = null;
let obtenerUsuario = () => null;

/** Última pantalla dibujada (hash + usuario), para no redibujar lo mismo. */
let pantallaActual = { hash: null, usuarioId: null };

/**
 * Registra una pantalla para un patrón de ruta.
 * Las rutas fijas tienen prioridad sobre las que tienen parámetros
 * ("#/solicitudes/nueva" gana sobre "#/solicitudes/:id").
 * @param {string} patron - Ej: "#/bandeja" o "#/solicitudes/:id".
 * @param {Ruta['renderizar']} renderizar
 * @param {{ publica?: boolean, roles?: string[] }} [opciones]
 */
export function registrarRuta(patron, renderizar, { publica = false, roles = null } = {}) {
  rutas.push({ segmentos: patron.split('/'), renderizar, publica, roles });
  rutas.sort((a, b) => cantidadParametros(a) - cantidadParametros(b));
}

const cantidadParametros = (ruta) => ruta.segmentos.filter((s) => s.startsWith(':')).length;

/**
 * Busca la ruta que coincide con el hash y extrae sus parámetros.
 * @param {string} hash
 * @returns {{ ruta: Ruta, parametros: Record<string, string> }|null}
 */
function buscarRuta(hash) {
  const segmentos = hash.split('/');
  for (const ruta of rutas) {
    if (ruta.segmentos.length !== segmentos.length) continue;
    const parametros = {};
    const coincide = ruta.segmentos.every((patron, i) => {
      if (patron.startsWith(':')) {
        parametros[patron.slice(1)] = decodeURIComponent(segmentos[i]);
        return segmentos[i] !== '';
      }
      return patron === segmentos[i];
    });
    if (coincide) return { ruta, parametros };
  }
  return null;
}

/**
 * Inicia el router: escucha los cambios de hash.
 * @param {HTMLElement} contenedor - Elemento donde se dibujan las pantallas.
 * @param {() => import('../data/modelos.js').Usuario|null} funcionObtenerUsuario
 */
export function iniciarRouter(contenedor, funcionObtenerUsuario) {
  contenedorApp = contenedor;
  obtenerUsuario = funcionObtenerUsuario;
  window.addEventListener('hashchange', () => resolverRuta());
}

/**
 * Navega a una ruta (cambia el hash, lo que dispara resolverRuta).
 * @param {string} ruta
 */
export function navegar(ruta) {
  if (window.location.hash === ruta) {
    resolverRuta();
  } else {
    window.location.hash = ruta;
  }
}

/**
 * Vuelve a dibujar la pantalla actual (por ejemplo, después de ejecutar una acción).
 */
export function recargarPantalla() {
  resolverRuta({ forzar: true });
}

/**
 * Dibuja la pantalla que corresponde al hash actual, aplicando las redirecciones.
 * @param {{ forzar?: boolean }} [opciones] - forzar = redibujar aunque sea la misma pantalla.
 */
export function resolverRuta({ forzar = false } = {}) {
  const usuario = obtenerUsuario();
  const hash = window.location.hash || (usuario ? RUTA_INICIO : RUTA_LOGIN);
  const encontrada = buscarRuta(hash);

  // Ruta inexistente → a la pantalla principal (o al login si no hay sesión).
  if (!encontrada) return navegar(usuario ? RUTA_INICIO : RUTA_LOGIN);
  const { ruta, parametros } = encontrada;

  // Pantalla privada sin sesión → login.
  if (!ruta.publica && !usuario) return navegar(RUTA_LOGIN);

  // Ya logueado y entra al login → inicio.
  if (hash === RUTA_LOGIN && usuario) return navegar(RUTA_INICIO);

  // ⚠️ IMPORTANTE: pantalla de otro rol (ej: "Nueva solicitud" para un supervisor) → inicio.
  if (ruta.roles && !ruta.roles.includes(usuario?.rol)) return navegar(RUTA_INICIO);

  // Si ya se muestra esta pantalla para el mismo usuario, no se redibuja.
  // Ejemplo: un login rechazado (usuario dado de baja) cierra la sesión y el
  // observador pide otra vez el login; redibujarlo borraría el mensaje de error.
  const usuarioId = usuario?.id ?? null;
  if (!forzar && pantallaActual.hash === hash && pantallaActual.usuarioId === usuarioId) return;
  pantallaActual = { hash, usuarioId };

  window.scrollTo(0, 0);
  ruta.renderizar(contenedorApp, usuario, parametros);
}
