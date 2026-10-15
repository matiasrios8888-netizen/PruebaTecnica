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
 *   src/data/authAdminRepositorio.js, src/data/solicitudesRepositorio.js,
 *   src/config/constantes.js
 * =============================================================
 */

import { OPERACIONES_USUARIO, ROLES } from '../config/constantes.js';
import { actualizarPerfil, crearPerfil, listarUsuarios, obtenerUsuarioPorId } from '../data/usuariosRepositorio.js';
import { crearCuentaDeAcceso, enviarCorreoDeContrasena, verificarCuentaDeAcceso } from '../data/authAdminRepositorio.js';
import { listarParticipacionesDe } from '../data/solicitudesRepositorio.js';
import { actualizarUsuarioActual, usuarioRequerido, errorParaUsuario } from './authServicio.js';
import { ErrorAplicacion } from './errores.js';
import {
  colaboradoresActivos,
  motivosDeBloqueo,
  supervisoresDisponibles,
  tramitesAbiertos,
  validarContrasenaInicial,
  validarDatosUsuario,
  validarReactivacion,
} from './gestionUsuarios.js';

/** @typedef {import('../data/modelos.js').Usuario} Usuario */
/** @typedef {import('./gestionUsuarios.js').DatosUsuario} DatosUsuario */

/** 🔒 SEGURIDAD: solo el admin gestiona usuarios (firestore.rules lo vuelve a exigir). */
const SOLO_ADMIN = [ROLES.ADMIN];

/** Mensajes en español para los errores de Firebase Auth al crear una cuenta o enviar el mail de contraseña. */
const MENSAJES_ERROR_CUENTAS = {
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
      throw new ErrorAplicacion(MENSAJES_ERROR_CUENTAS[error.code] ?? 'No se pudo crear la cuenta de acceso.', error.code, error);
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

// -------------------------------------------------------------
// Ficha: edición, baja, reactivación y contraseña
// -------------------------------------------------------------

/**
 * Busca un usuario en la lista o falla con un mensaje claro.
 * @param {Usuario[]} usuarios
 * @param {string} uid
 * @returns {Usuario}
 * @throws {ErrorAplicacion}
 */
function buscarUsuario(usuarios, uid) {
  const usuario = usuarios.find((u) => u.id === uid);
  if (!usuario) throw new ErrorAplicacion('El usuario no existe.', 'noExiste');
  return usuario;
}

/**
 * Todo lo que muestra la ficha de un usuario.
 * @typedef {Object} FichaUsuario
 * @property {Usuario} usuario
 * @property {Usuario[]} supervisores - Para el formulario (incluye el actual aunque esté dado de baja).
 * @property {import('../data/modelos.js').Solicitud[]} tramitesAbiertos - En los que participa.
 * @property {Usuario[]} colaboradores - Si es supervisor: iniciadores activos a su cargo.
 * @property {string[]} motivosBaja - Por qué no se puede dar de baja (vacío = se puede).
 * @property {(rolNuevo: string) => string[]} motivosCambioDeRol - Para avisar antes de guardar.
 */

/**
 * Carga la ficha de un usuario.
 * @param {string} uid
 * @returns {Promise<FichaUsuario>}
 * @throws {ErrorAplicacion}
 */
export async function obtenerFichaUsuario(uid) {
  try {
    const admin = usuarioRequerido(SOLO_ADMIN);
    const [usuarios, solicitudes] = await Promise.all([listarUsuarios(), listarParticipacionesDe(uid)]);
    const usuario = buscarUsuario(usuarios, uid);
    const contexto = { usuarioActual: admin, usuarios, solicitudes };
    return {
      usuario,
      supervisores: supervisoresDisponibles(usuarios, { incluirId: usuario.supervisorId }),
      tramitesAbiertos: tramitesAbiertos(solicitudes),
      colaboradores: usuario.rol === ROLES.SUPERVISOR ? colaboradoresActivos(usuario, usuarios) : [],
      motivosBaja: usuario.activo ? motivosDeBloqueo(usuario, { ...contexto, operacion: OPERACIONES_USUARIO.BAJA }) : [],
      motivosCambioDeRol: (rolNuevo) =>
        motivosDeBloqueo(usuario, { ...contexto, operacion: OPERACIONES_USUARIO.CAMBIO_ROL, rolNuevo }),
    };
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo cargar el usuario.');
  }
}

/**
 * Guarda los cambios de la ficha (nombre, rol, área y supervisor; el email no se edita).
 *
 * ⚠️ IMPORTANTE: un cambio de rol se bloquea con los mismos motivos que una baja
 * (DECISIONES.md #24). Se decide con datos leídos en este momento, no con los
 * que tenía la pantalla al abrirse.
 *
 * @param {string} uid
 * @param {import('./gestionUsuarios.js').DatosUsuario} datosFormulario
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion} Datos inválidos, cambio de rol bloqueado o rechazo del servidor.
 */
export async function actualizarUsuario(uid, datosFormulario) {
  try {
    const admin = usuarioRequerido(SOLO_ADMIN);
    const usuarios = await listarUsuarios();
    const usuario = buscarUsuario(usuarios, uid);
    const datos = validarDatosUsuario(
      { ...datosFormulario, email: usuario.email },
      { id: uid, activo: usuario.activo, usuarios },
    );

    if (datos.rol !== usuario.rol) {
      const motivos = motivosDeBloqueo(usuario, {
        operacion: OPERACIONES_USUARIO.CAMBIO_ROL,
        rolNuevo: datos.rol,
        usuarioActual: admin,
        usuarios,
        solicitudes: await listarParticipacionesDe(uid),
      });
      if (motivos.length > 0) {
        throw new ErrorAplicacion(`No se puede cambiar el rol de ${usuario.nombre}. ${motivos.join(' ')}`, 'cambioRolBloqueado');
      }
    }

    const cambios = { nombre: datos.nombre, rol: datos.rol, area: datos.area, supervisorId: datos.supervisorId };
    await actualizarPerfil(uid, cambios);
    if (uid === admin.id) actualizarUsuarioActual(cambios); // el admin se editó a sí mismo
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudieron guardar los cambios.');
  }
}

/**
 * Da de baja a un usuario (baja lógica: activo = false). Ya no puede iniciar
 * sesión ni operar (lo controlan el login y firestore.rules).
 * @param {string} uid
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion} Si ya está dado de baja o si algún motivo la bloquea (DECISIONES.md #24).
 */
export async function darDeBaja(uid) {
  try {
    const admin = usuarioRequerido(SOLO_ADMIN);
    const [usuarios, solicitudes] = await Promise.all([listarUsuarios(), listarParticipacionesDe(uid)]);
    const usuario = buscarUsuario(usuarios, uid);
    if (!usuario.activo) throw new ErrorAplicacion(`El usuario de ${usuario.nombre} ya está dado de baja.`, 'yaInactivo');

    // ⚠️ IMPORTANTE: con datos frescos, por si algo cambió desde que se abrió la ficha.
    const motivos = motivosDeBloqueo(usuario, {
      operacion: OPERACIONES_USUARIO.BAJA,
      usuarioActual: admin,
      usuarios,
      solicitudes,
    });
    if (motivos.length > 0) {
      throw new ErrorAplicacion(`No se puede dar de baja a ${usuario.nombre}. ${motivos.join(' ')}`, 'bajaBloqueada');
    }
    await actualizarPerfil(uid, { activo: false });
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo dar de baja al usuario.');
  }
}

/**
 * Reactiva a un usuario dado de baja.
 * @param {string} uid
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion} Si ya está activo o si es iniciador y su supervisor no está activo.
 */
export async function reactivar(uid) {
  try {
    usuarioRequerido(SOLO_ADMIN);
    const usuarios = await listarUsuarios();
    const usuario = buscarUsuario(usuarios, uid);
    validarReactivacion(usuario, usuarios);
    await actualizarPerfil(uid, { activo: true });
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo reactivar al usuario.');
  }
}

/**
 * Envía al usuario el mail de Firebase para elegir una contraseña nueva.
 * El admin nunca conoce ni cambia la contraseña de otro usuario.
 * @param {string} uid
 * @returns {Promise<string>} Email al que se envió.
 * @throws {ErrorAplicacion}
 */
export async function enviarCambioDeContrasena(uid) {
  try {
    usuarioRequerido(SOLO_ADMIN);
    const usuario = buscarUsuario(await listarUsuarios(), uid);
    try {
      await enviarCorreoDeContrasena(usuario.email);
    } catch (error) {
      throw new ErrorAplicacion(MENSAJES_ERROR_CUENTAS[error.code] ?? 'No se pudo enviar el mail.', error.code, error);
    }
    return usuario.email;
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo enviar el mail.');
  }
}
