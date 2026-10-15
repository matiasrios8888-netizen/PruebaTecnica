/**
 * =============================================================
 * Capa: SERVICIOS
 * Archivo: src/services/authServicio.js
 *
 * Responsabilidad:
 *   Lógica de negocio de la sesión:
 *   - Iniciar y cerrar sesión.
 *   - Cargar el perfil del usuario (colección "usuarios") después de autenticarlo.
 *   - Impedir el ingreso de usuarios sin perfil o dados de baja (activo = false).
 *   - Traducir los errores de Firebase a mensajes claros en español.
 *   - Mantener el perfil del usuario logueado disponible para el resto de la app
 *     y cargar el catálogo de nombres de roles (catalogoRoles.js).
 *   - Dar a los demás servicios el usuario requerido (con control de rol) y la
 *     traducción de errores que tiene en cuenta si la sesión sigue abierta.
 *
 * Depende de: src/data/authRepositorio.js, src/data/usuariosRepositorio.js,
 *   src/services/errores.js, src/services/catalogoRoles.js
 * =============================================================
 */

import { autenticar, desautenticar, escucharCambiosDeSesion } from '../data/authRepositorio.js';
import { obtenerUsuarioPorId } from '../data/usuariosRepositorio.js';
import { ErrorAplicacion, aErrorAplicacion } from './errores.js';
import { cargarCatalogoRoles, limpiarCatalogoRoles } from './catalogoRoles.js';

/** @typedef {import('../data/modelos.js').Usuario} Usuario */

/** Perfil del usuario logueado (null si no hay sesión). */
let usuarioActual = null;

/** Mensajes en español para los códigos de error de Firebase Auth. */
const MENSAJES_ERROR_AUTH = {
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/invalid-email': 'El email no tiene un formato válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Esperá unos minutos y volvé a intentar.',
  'auth/network-request-failed': 'No hay conexión. Revisá tu internet y volvé a intentar.',
};

/**
 * Carga el perfil de Firestore y verifica que el usuario pueda usar la app.
 * @param {string} uid
 * @returns {Promise<Usuario>}
 * @throws {ErrorAplicacion} Si no tiene perfil o está dado de baja.
 */
async function cargarPerfilHabilitado(uid) {
  const perfil = await obtenerUsuarioPorId(uid);

  // ⚠️ IMPORTANTE: tener cuenta en Firebase Auth no alcanza. El usuario necesita
  // un perfil en "usuarios" (ahí está su rol) y estar activo. La baja es lógica:
  // la cuenta de Auth sigue existiendo, por eso se controla acá y en firestore.rules.
  if (!perfil) {
    throw new ErrorAplicacion('Tu usuario no tiene un perfil asignado. Contactá al administrador.', 'sinPerfil');
  }
  if (!perfil.activo) {
    throw new ErrorAplicacion('Tu usuario está dado de baja. Contactá al administrador.', 'usuarioInactivo');
  }
  // Nombres de los roles elegidos por el admin, para mostrarlos en toda la app.
  await cargarCatalogoRoles();
  return perfil;
}

/**
 * Inicia sesión con email y contraseña y devuelve el perfil del usuario.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Usuario>} Perfil del usuario logueado.
 * @throws {ErrorAplicacion} Datos incompletos, credenciales incorrectas, usuario sin
 *   perfil o inactivo, o problema de conexión. El mensaje está listo para mostrar.
 */
export async function iniciarSesion(email, password) {
  const emailLimpio = email.trim();
  if (!emailLimpio || !password) {
    throw new ErrorAplicacion('Ingresá tu email y tu contraseña.', 'datosIncompletos');
  }

  let uid;
  try {
    uid = await autenticar(emailLimpio, password);
  } catch (error) {
    const mensaje = MENSAJES_ERROR_AUTH[error.code] ?? 'No se pudo iniciar sesión. Intentá de nuevo.';
    throw new ErrorAplicacion(mensaje, error.code, error);
  }

  try {
    usuarioActual = await cargarPerfilHabilitado(uid);
    return usuarioActual;
  } catch (error) {
    // 🔒 SEGURIDAD: si el perfil no es válido, no se deja la sesión de Auth abierta.
    await desautenticar();
    usuarioActual = null;
    if (error instanceof ErrorAplicacion) throw error;
    throw new ErrorAplicacion('No se pudo cargar tu perfil. Intentá de nuevo.', error.code, error);
  }
}

/**
 * Cierra la sesión del usuario actual.
 * @returns {Promise<void>}
 */
export async function cerrarSesion() {
  usuarioActual = null;
  limpiarCatalogoRoles();
  await desautenticar();
}

/**
 * Devuelve el perfil del usuario logueado (sin ir a Firestore).
 * @returns {Usuario|null}
 */
export function obtenerUsuarioActual() {
  return usuarioActual;
}

/**
 * Actualiza en memoria el perfil del usuario logueado cuando se edita a sí mismo
 * (por ejemplo, el admin corrige su nombre), para que el encabezado lo muestre sin recargar.
 * @param {Partial<Usuario>} cambios
 */
export function actualizarUsuarioActual(cambios) {
  if (usuarioActual) usuarioActual = { ...usuarioActual, ...cambios };
}

/**
 * Usuario logueado, para el inicio de cada caso de uso de los servicios.
 * @param {string[]|null} [roles] - Si se indica, solo esos roles pueden continuar.
 * @returns {Usuario}
 * @throws {ErrorAplicacion} "sinSesion" si no hay sesión, "sinPermiso" si su rol no está permitido.
 */
export function usuarioRequerido(roles = null) {
  if (!usuarioActual) throw new ErrorAplicacion('Tu sesión terminó. Volvé a iniciar sesión.', 'sinSesion');
  // 🔒 SEGURIDAD: control de rol en el servicio; firestore.rules lo vuelve a controlar en el servidor.
  if (roles && !roles.includes(usuarioActual.rol)) {
    throw new ErrorAplicacion('No tenés permiso para realizar esta acción.', 'sinPermiso');
  }
  return usuarioActual;
}

/**
 * Convierte un error en un mensaje para el usuario.
 * Si cuando llega el error ya no hay sesión (el usuario cerró sesión con una
 * consulta en curso → Firestore responde "permission-denied"), no es un problema
 * de permisos sino una consulta huérfana: se informa "sesión terminada" sin
 * ensuciar la consola. Ver BUGS.md · BUG-004.
 * @param {unknown} error
 * @param {string} mensajePorDefecto
 * @returns {ErrorAplicacion}
 */
export function errorParaUsuario(error, mensajePorDefecto) {
  if (!usuarioActual) {
    return new ErrorAplicacion('Tu sesión terminó. Volvé a iniciar sesión.', 'sinSesion', error);
  }
  return aErrorAplicacion(error, mensajePorDefecto);
}

/**
 * Observa la sesión: se ejecuta al cargar la página (Firebase recuerda la sesión
 * entre recargas), al iniciar sesión y al cerrarla.
 * @param {(usuario: Usuario|null) => void} callback - Recibe el perfil habilitado o null.
 * @returns {() => void} Función para dejar de observar.
 */
export function observarSesion(callback) {
  return escucharCambiosDeSesion(async (uid) => {
    if (!uid) {
      usuarioActual = null;
      callback(null);
      return;
    }
    try {
      usuarioActual = await cargarPerfilHabilitado(uid);
    } catch (error) {
      // ⚠️ IMPORTANTE: una sesión recordada de un usuario que fue dado de baja
      // después de loguearse también se corta acá, al recargar la página.
      console.warn('[authServicio] Sesión rechazada:', error.message);
      usuarioActual = null;
      await desautenticar();
    }
    callback(usuarioActual);
  });
}
