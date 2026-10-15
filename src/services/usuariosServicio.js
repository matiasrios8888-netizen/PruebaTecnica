/**
 * =============================================================
 * Capa: SERVICIOS
 * Archivo: src/services/usuariosServicio.js
 *
 * Responsabilidad:
 *   Casos de uso del mantenimiento de usuarios (solo el admin): listar,
 *   dar de alta, editar, dar de baja, reactivar y pedir el cambio de contraseña.
 *
 *   Orquesta: verifica que quien opera sea admin, lee datos frescos, aplica la
 *   lógica pura de gestionUsuarios.js y pide a los repositorios que guarden.
 *   Todos los errores salen como ErrorAplicacion con mensaje en español.
 *
 * Depende de: src/services/gestionUsuarios.js, src/services/authServicio.js,
 *   src/services/errores.js, src/data/usuariosRepositorio.js,
 *   src/data/authAdminRepositorio.js, src/config/constantes.js
 * =============================================================
 */

import { ROLES } from '../config/constantes.js';
import { crearPerfil, listarUsuarios, obtenerUsuarioPorId } from '../data/usuariosRepositorio.js';
import { crearCuentaDeAcceso, verificarCuentaDeAcceso } from '../data/authAdminRepositorio.js';
import { usuarioRequerido, errorParaUsuario } from './authServicio.js';
import { ErrorAplicacion } from './errores.js';
import { supervisoresDisponibles, validarContrasenaInicial, validarDatosUsuario } from './gestionUsuarios.js';

/** @typedef {import('../data/modelos.js').Usuario} Usuario */
/** @typedef {import('./gestionUsuarios.js').DatosUsuario} DatosUsuario */

/** 🔒 SEGURIDAD: solo el admin gestiona usuarios (firestore.rules lo vuelve a exigir). */
const SOLO_ADMIN = [ROLES.ADMIN];

/** Mensajes en español para los errores de Firebase Auth al crear una cuenta. */
const MENSAJES_ERROR_ALTA = {
  'auth/invalid-email': 'El email no tiene un formato válido.',
  'auth/weak-password': 'La contraseña inicial es demasiado débil.',
  'auth/password-does-not-meet-requirements': 'La contraseña inicial no cumple los requisitos de seguridad.',
  'auth/operation-not-allowed': 'El alta con email y contraseña no está habilitada en Firebase Authentication.',
  'auth/too-many-requests': 'Demasiados intentos seguidos. Esperá unos minutos y volvé a intentar.',
  'auth/network-request-failed': 'No hay conexión. Revisá tu internet y volvé a intentar.',
};

// -------------------------------------------------------------
// Listado
// -------------------------------------------------------------

/**
 * Lista todos los usuarios (activos e inactivos), ordenados por nombre.
 * @returns {Promise<Usuario[]>}
 * @throws {ErrorAplicacion} Sin sesión, sin permiso o error de conexión.
 */
export async function cargarUsuarios() {
  try {
    usuarioRequerido(SOLO_ADMIN);
    return await listarUsuarios();
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudieron cargar los usuarios.');
  }
}

// -------------------------------------------------------------
// Alta
// -------------------------------------------------------------

/**
 * Datos para el formulario de alta: los supervisores que se pueden elegir.
 * @returns {Promise<{ supervisores: Usuario[] }>}
 * @throws {ErrorAplicacion}
 */
export async function prepararAlta() {
  try {
    usuarioRequerido(SOLO_ADMIN);
    return { supervisores: supervisoresDisponibles(await listarUsuarios()) };
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo preparar el alta.');
  }
}

/**
 * Crea la cuenta de acceso o, si ya existe con esa misma contraseña, devuelve
 * su uid (alta interrumpida: la cuenta se creó, pero el perfil no llegó a guardarse).
 * @param {string} email
 * @param {string} contrasena
 * @returns {Promise<string>} uid.
 * @throws {ErrorAplicacion}
 */
async function crearOCompletarCuenta(email, contrasena) {
  try {
    return await crearCuentaDeAcceso(email, contrasena);
  } catch (error) {
    if (error.code !== 'auth/email-already-in-use') {
      throw new ErrorAplicacion(MENSAJES_ERROR_ALTA[error.code] ?? 'No se pudo crear la cuenta de acceso.', error.code, error);
    }
  }

  // ⚠️ IMPORTANTE: la cuenta ya existe en Auth. Si es un alta interrumpida, el admin
  // la reintenta con los mismos datos: se comprueba la contraseña y, si la cuenta no
  // tiene perfil, se completa el alta. Si no, el email es de otra persona.
  let uid;
  try {
    uid = await verificarCuentaDeAcceso(email, contrasena);
  } catch (error) {
    throw new ErrorAplicacion('Ya existe una cuenta de acceso con ese email.', 'emailEnUso', error);
  }
  if (await obtenerUsuarioPorId(uid)) {
    throw new ErrorAplicacion('Ya existe un usuario con ese email.', 'emailEnUso');
  }
  return uid;
}

/**
 * Da de alta un usuario: crea su cuenta de acceso y su perfil.
 *
 * ⚠️ IMPORTANTE (DECISIONES.md #14 y #26): la cuenta se crea en la instancia
 * secundaria de Firebase, así el admin no pierde su sesión. Después el admin,
 * con SU sesión, escribe el perfil: firestore.rules solo deja hacerlo al admin.
 * Si el perfil no se llega a guardar, la cuenta queda sin perfil y no puede
 * hacer nada (las reglas exigen un perfil activo); reintentar el alta con el
 * mismo email y contraseña la completa.
 *
 * @param {DatosUsuario} datosFormulario
 * @param {string} contrasena - Contraseña inicial que el admin le comunica al usuario.
 * @returns {Promise<{ id: string, nombre: string }>}
 * @throws {ErrorAplicacion} Datos inválidos, email en uso o rechazo del servidor.
 */
export async function crearUsuario(datosFormulario, contrasena) {
  try {
    usuarioRequerido(SOLO_ADMIN);
    const usuarios = await listarUsuarios();
    const datos = validarDatosUsuario(datosFormulario, { usuarios });
    validarContrasenaInicial(contrasena);

    const uid = await crearOCompletarCuenta(datos.email, contrasena);
    try {
      await crearPerfil(uid, { ...datos, activo: true });
    } catch (error) {
      throw new ErrorAplicacion(
        'Se creó la cuenta de acceso, pero no se pudo guardar el perfil. ' +
          'Volvé a intentar el alta con el mismo email y la misma contraseña para completarla.',
        'perfilPendiente',
        error,
      );
    }
    return { id: uid, nombre: datos.nombre };
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo dar de alta el usuario.');
  }
}
