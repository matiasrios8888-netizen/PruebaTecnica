/**
 * =============================================================
 * Capa: SERVICIOS (lógica pura, sin Firebase ni DOM)
 * Archivo: src/services/gestionUsuarios.js
 *
 * Responsabilidad:
 *   Reglas de negocio del mantenimiento de usuarios:
 *   - validar y normalizar los datos de un usuario (alta y edición);
 *   - decidir si una baja o un cambio de rol está bloqueado, y por qué;
 *   - validar una reactivación;
 *   - buscar, filtrar y ordenar el listado de usuarios.
 *
 *   Es pura (recibe todos los datos por parámetro): se prueba en Node
 *   (scripts/tests/gestionUsuarios.test.mjs) y la usan tanto el servicio
 *   (que decide con datos frescos) como las pantallas (que avisan antes de guardar).
 *
 * Depende de: src/config/constantes.js, src/services/errores.js,
 *   src/services/bandeja.js (normalizarTexto)
 * =============================================================
 */

import {
  ESTADOS_FINALES,
  FILTROS_ESTADO_USUARIO,
  LIMITES_USUARIO,
  OPERACIONES_USUARIO,
  ROLES,
} from '../config/constantes.js';
import { ErrorAplicacion } from './errores.js';
import { normalizarTexto } from './bandeja.js';

/** @typedef {import('../data/modelos.js').Usuario} Usuario */
/** @typedef {import('../data/modelos.js').Solicitud} Solicitud */

/**
 * Datos que carga el admin en el formulario de un usuario.
 * @typedef {Object} DatosUsuario
 * @property {string} nombre
 * @property {string} email
 * @property {string} rol - Una de ROLES.
 * @property {string} area
 * @property {string|null} supervisorId - Solo para el iniciador.
 */

/** Formato mínimo de un email: algo@algo.algo, sin espacios. */
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Orden alfabético por nombre (con reglas del español: "Á" va con "A"). */
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');

/** "1 trámite abierto" / "3 trámites abiertos". */
const cantidad = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

const esSupervisorActivo = (usuario) => usuario?.rol === ROLES.SUPERVISOR && usuario.activo === true;

// -------------------------------------------------------------
// Consultas sobre la lista de usuarios
// -------------------------------------------------------------

/**
 * Supervisores que se pueden elegir para un iniciador.
 * @param {Usuario[]} usuarios
 * @param {{ incluirId?: string|null }} [opciones] - Supervisor actual del usuario editado:
 *   se incluye aunque esté dado de baja, para que el formulario muestre el valor guardado.
 * @returns {Usuario[]} Ordenados por nombre.
 */
export function supervisoresDisponibles(usuarios, { incluirId = null } = {}) {
  return usuarios
    .filter((u) => esSupervisorActivo(u) || (incluirId !== null && u.id === incluirId && u.rol === ROLES.SUPERVISOR))
    .sort(porNombre);
}

/**
 * Iniciadores activos que tienen a este usuario como supervisor.
 * @param {Usuario} supervisor
 * @param {Usuario[]} usuarios
 * @returns {Usuario[]} Ordenados por nombre.
 */
export function colaboradoresActivos(supervisor, usuarios) {
  return usuarios
    .filter((u) => u.supervisorId === supervisor.id && u.activo && u.rol === ROLES.INICIADOR)
    .sort(porNombre);
}

/**
 * Trámites que todavía no terminaron.
 * @param {Solicitud[]} solicitudes
 * @returns {Solicitud[]} Ordenados por número.
 */
export function tramitesAbiertos(solicitudes) {
  return solicitudes
    .filter((s) => !ESTADOS_FINALES.includes(s.estadoActual))
    .sort((a, b) => a.numero.localeCompare(b.numero));
}

// -------------------------------------------------------------
// Validación de datos
// -------------------------------------------------------------

/**
 * Valida y normaliza los datos de un usuario (alta o edición).
 *
 * ⚠️ IMPORTANTE: solo el iniciador tiene supervisor (es quien aprueba sus
 * solicitudes). Si el usuario va a estar activo, su supervisor también tiene
 * que estarlo: si no, sus solicitudes no se podrían crear. firestore.rules
 * exige lo mismo en el servidor.
 *
 * @param {DatosUsuario} datos
 * @param {{ id?: string|null, activo?: boolean, usuarios: Usuario[] }} contexto
 *   - id: uid del usuario que se edita (null en un alta).
 *   - activo: si el usuario va a quedar activo.
 *   - usuarios: todos los usuarios (para el email repetido y el supervisor).
 * @returns {DatosUsuario} Datos sin espacios sobrantes, email en minúsculas y
 *   supervisorId en null para los roles que no lo usan.
 * @throws {ErrorAplicacion} Con un mensaje claro para el admin.
 */
export function validarDatosUsuario(datos, { id = null, activo = true, usuarios }) {
  const nombre = String(datos.nombre ?? '').trim();
  const email = String(datos.email ?? '').trim().toLowerCase();
  const area = String(datos.area ?? '').trim();
  const { rol } = datos;

  if (!nombre) throw new ErrorAplicacion('Ingresá el nombre y apellido.', 'nombreVacio');
  if (nombre.length > LIMITES_USUARIO.largoMaximoNombre) {
    throw new ErrorAplicacion(`El nombre puede tener hasta ${LIMITES_USUARIO.largoMaximoNombre} caracteres.`, 'nombreLargo');
  }
  if (!PATRON_EMAIL.test(email) || email.length > LIMITES_USUARIO.largoMaximoEmail) {
    throw new ErrorAplicacion('Ingresá un email válido (por ejemplo, nombre@empresa.com).', 'emailInvalido');
  }
  // Firebase Auth también rechaza un email repetido; acá se avisa antes y con un mensaje claro.
  if (usuarios.some((u) => u.id !== id && u.email.toLowerCase() === email)) {
    throw new ErrorAplicacion('Ya existe un usuario con ese email.', 'emailEnUso');
  }
  if (!Object.values(ROLES).includes(rol)) throw new ErrorAplicacion('Elegí un rol.', 'rolInvalido');
  if (!area) throw new ErrorAplicacion('Ingresá el área o sector.', 'areaVacia');
  if (area.length > LIMITES_USUARIO.largoMaximoArea) {
    throw new ErrorAplicacion(`El área puede tener hasta ${LIMITES_USUARIO.largoMaximoArea} caracteres.`, 'areaLarga');
  }

  let supervisorId = null;
  if (rol === ROLES.INICIADOR) {
    supervisorId = datos.supervisorId || null;
    const supervisor = usuarios.find((u) => u.id === supervisorId);
    if (!supervisor || supervisor.id === id || supervisor.rol !== ROLES.SUPERVISOR) {
      throw new ErrorAplicacion('Elegí el supervisor que va a aprobar sus solicitudes.', 'sinSupervisor');
    }
    if (activo && !supervisor.activo) {
      throw new ErrorAplicacion(`${supervisor.nombre} está dado de baja: elegí un supervisor activo.`, 'supervisorInactivo');
    }
  }

  return { nombre, email, rol, area, supervisorId };
}

/**
 * Valida la contraseña inicial que el admin le asigna a un usuario nuevo.
 * @param {string} contrasena
 * @throws {ErrorAplicacion} Si es demasiado corta.
 */
export function validarContrasenaInicial(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length < LIMITES_USUARIO.largoMinimoContrasena) {
    throw new ErrorAplicacion(
      `La contraseña inicial tiene que tener al menos ${LIMITES_USUARIO.largoMinimoContrasena} caracteres.`,
      'contrasenaCorta',
    );
  }
}

// -------------------------------------------------------------
// Baja, cambio de rol y reactivación
// -------------------------------------------------------------

/**
 * Motivos por los que no se puede dar de baja a un usuario o cambiarle el rol.
 *
 * ⚠️ IMPORTANTE (DECISIONES.md #24): el flujo asigna cada tarea a una persona
 * concreta y la devuelve a quien corresponde (una devuelta vuelve al solicitante;
 * al reenviarla, a su supervisor). Si esa persona deja de estar activa o de tener
 * el rol, el trámite queda trabado. Por eso se bloquea mientras el usuario:
 *   1. sea el admin que está operando (además, así siempre queda un admin);
 *   2. participe en trámites abiertos (como asignado, solicitante o supervisor);
 *   3. sea supervisor de colaboradores activos (no podrían crear solicitudes);
 *   4. sea el último RH activo (las aprobadas no tendrían a quién asignarse).
 * En un cambio de rol, 3 y 4 aplican porque deja de ser supervisor o RH.
 *
 * @param {Usuario} usuario - Usuario que se quiere modificar.
 * @param {Object} contexto
 * @param {string} contexto.operacion - Una de OPERACIONES_USUARIO.
 * @param {string|null} [contexto.rolNuevo] - Rol elegido (solo en un cambio de rol).
 * @param {Usuario} contexto.usuarioActual - Admin que opera.
 * @param {Usuario[]} contexto.usuarios - Todos los usuarios.
 * @param {Solicitud[]} contexto.solicitudes - Solicitudes en las que participa (de cualquier estado).
 * @returns {string[]} Motivos para mostrar; vacío si la operación está permitida.
 */
export function motivosDeBloqueo(usuario, { operacion, rolNuevo = null, usuarioActual, usuarios, solicitudes }) {
  const esCambioDeRol = operacion === OPERACIONES_USUARIO.CAMBIO_ROL;
  if (esCambioDeRol && rolNuevo === usuario.rol) return []; // no hay cambio

  const motivos = [];

  // 🔒 SEGURIDAD: firestore.rules también impide que el admin se modifique esto a sí mismo.
  if (usuario.id === usuarioActual.id) {
    motivos.push(esCambioDeRol ? 'No podés cambiar tu propio rol.' : 'No podés darte de baja a vos mismo.');
  }

  const abiertos = tramitesAbiertos(solicitudes);
  if (abiertos.length > 0) {
    motivos.push(
      `Participa en ${cantidad(abiertos.length, 'trámite abierto', 'trámites abiertos')} ` +
        `(${abiertos.map((s) => s.numero).join(', ')}): tienen que finalizar antes.`,
    );
  }

  if (usuario.rol === ROLES.SUPERVISOR) {
    const colaboradores = colaboradoresActivos(usuario, usuarios);
    if (colaboradores.length > 0) {
      motivos.push(
        `Es supervisor de ${cantidad(colaboradores.length, 'colaborador activo', 'colaboradores activos')} ` +
          `(${colaboradores.map((u) => u.nombre).join(', ')}): asignales otro supervisor antes.`,
      );
    }
  }

  if (usuario.rol === ROLES.RH && usuario.activo) {
    const otrosRh = usuarios.filter((u) => u.rol === ROLES.RH && u.activo && u.id !== usuario.id);
    if (otrosRh.length === 0) {
      motivos.push('Es el único usuario de Recursos Humanos activo: las solicitudes aprobadas no tendrían a quién asignarse.');
    }
  }

  return motivos;
}

/**
 * Verifica que un usuario dado de baja se pueda reactivar.
 * @param {Usuario} usuario
 * @param {Usuario[]} usuarios - Todos los usuarios (para ver su supervisor).
 * @throws {ErrorAplicacion} Si ya está activo, o si es iniciador y su supervisor no está activo.
 */
export function validarReactivacion(usuario, usuarios) {
  if (usuario.activo) throw new ErrorAplicacion(`${usuario.nombre} ya está activo.`, 'yaActivo');
  if (usuario.rol === ROLES.INICIADOR) {
    const supervisor = usuarios.find((u) => u.id === usuario.supervisorId);
    if (!esSupervisorActivo(supervisor)) {
      throw new ErrorAplicacion(
        `No se puede reactivar: su supervisor (${supervisor?.nombre ?? 'sin asignar'}) no está activo. ` +
          'Asignale un supervisor activo y volvé a intentar.',
        'supervisorInactivo',
      );
    }
  }
}

// -------------------------------------------------------------
// Listado: búsqueda y filtros
// -------------------------------------------------------------

/**
 * Filtros del listado sin ningún valor.
 * @returns {{ texto: string, rol: string, estado: string }}
 */
export function filtrosUsuariosVacios() {
  return { texto: '', rol: '', estado: '' };
}

/**
 * Filtra y ordena el listado de usuarios.
 * La búsqueda ignora tildes y mayúsculas, y cada palabra tiene que aparecer
 * en el nombre, el email o el área ("gomez oper" encuentra a Ana Gómez, de Operaciones).
 * @param {Usuario[]} usuarios
 * @param {{ texto: string, rol: string, estado: string }} filtros - "" = sin filtrar.
 * @returns {Usuario[]} Nueva lista ordenada por nombre.
 */
export function filtrarUsuarios(usuarios, filtros) {
  const palabras = normalizarTexto(filtros.texto).split(/\s+/).filter(Boolean);
  return usuarios
    .filter((u) => {
      if (filtros.rol && u.rol !== filtros.rol) return false;
      if (filtros.estado === FILTROS_ESTADO_USUARIO.ACTIVOS && !u.activo) return false;
      if (filtros.estado === FILTROS_ESTADO_USUARIO.INACTIVOS && u.activo) return false;
      const texto = normalizarTexto(`${u.nombre} ${u.email} ${u.area}`);
      return palabras.every((palabra) => texto.includes(palabra));
    })
    .sort(porNombre);
}
