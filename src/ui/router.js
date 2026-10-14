/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/router.js
 *
 * Responsabilidad:
 *   Decidir qué pantalla se muestra según la parte de la URL después del
 *   "#" (hash): #/login, #/inicio, etc. Cambiar el hash no recarga la página,
 *   así que la app funciona como SPA (Single Page Application) sin servidor.
 *   También protege las pantallas privadas: sin sesión, redirige al login.
 *
 * Depende de: nada (recibe el contenedor y una función para saber quién está logueado).
 *
 * Nota: esta protección es solo de navegación (experiencia de usuario).
 *   La seguridad real de los datos está en firestore.rules.
 * =============================================================
 */

/**
 * @typedef {Object} Ruta
 * @property {(contenedor: HTMLElement, usuario: import('../data/modelos.js').Usuario|null) => void} renderizar
 * @property {boolean} publica - true = se puede ver sin sesión (solo el login).
 */

export const RUTA_LOGIN = '#/login';
export const RUTA_INICIO = '#/inicio';

/** @type {Map<string, Ruta>} */
const rutas = new Map();

let contenedorApp = null;
let obtenerUsuario = () => null;

/** Última pantalla dibujada (ruta + usuario), para no redibujar lo mismo. */
let pantallaActual = { hash: null, usuarioId: null };

/**
 * Registra una pantalla para una ruta.
 * @param {string} ruta - Ej: "#/inicio".
 * @param {Ruta['renderizar']} renderizar - Función que dibuja la pantalla.
 * @param {{ publica?: boolean }} [opciones]
 */
export function registrarRuta(ruta, renderizar, { publica = false } = {}) {
  rutas.set(ruta, { renderizar, publica });
}

/**
 * Inicia el router: escucha los cambios de hash.
 * @param {HTMLElement} contenedor - Elemento donde se dibujan las pantallas.
 * @param {() => import('../data/modelos.js').Usuario|null} funcionObtenerUsuario
 */
export function iniciarRouter(contenedor, funcionObtenerUsuario) {
  contenedorApp = contenedor;
  obtenerUsuario = funcionObtenerUsuario;
  window.addEventListener('hashchange', resolverRuta);
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
 * Dibuja la pantalla que corresponde al hash actual, aplicando las redirecciones de sesión.
 */
export function resolverRuta() {
  const usuario = obtenerUsuario();
  const hash = window.location.hash || (usuario ? RUTA_INICIO : RUTA_LOGIN);
  const ruta = rutas.get(hash);

  // Ruta inexistente → a la pantalla principal (o al login si no hay sesión).
  if (!ruta) return navegar(usuario ? RUTA_INICIO : RUTA_LOGIN);

  // Pantalla privada sin sesión → login.
  if (!ruta.publica && !usuario) return navegar(RUTA_LOGIN);

  // Ya logueado y entra al login → inicio.
  if (hash === RUTA_LOGIN && usuario) return navegar(RUTA_INICIO);

  // Si ya se muestra esta pantalla para el mismo usuario, no se redibuja.
  // Ejemplo: un login rechazado (usuario dado de baja) cierra la sesión y el
  // observador pide otra vez el login; redibujarlo borraría el mensaje de error.
  const usuarioId = usuario?.id ?? null;
  if (pantallaActual.hash === hash && pantallaActual.usuarioId === usuarioId) return;
  pantallaActual = { hash, usuarioId };

  ruta.renderizar(contenedorApp, usuario);
}
