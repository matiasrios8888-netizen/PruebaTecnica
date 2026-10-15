/**
 * =============================================================
 * Capa: SERVICIOS
 * Archivo: src/services/solicitudesServicio.js
 *
 * Responsabilidad:
 *   Casos de uso de las solicitudes, para el usuario logueado:
 *   crear, ver el detalle, ejecutar acciones del flujo (aprobar, devolver…),
 *   agregar notas y adjuntos, y listar sus tareas y solicitudes.
 *
 *   Orquesta: toma el usuario de la sesión, carga el contexto necesario
 *   (supervisor, usuarios RH), aplica la lógica pura de flujoSolicitud.js y
 *   pide al repositorio que guarde. Todos los errores salen como
 *   ErrorAplicacion con mensaje en español.
 *
 * Depende de: src/services/flujoSolicitud.js, src/services/authServicio.js,
 *   src/services/archivos.js, src/services/errores.js,
 *   src/data/solicitudesRepositorio.js, src/data/usuariosRepositorio.js,
 *   src/config/constantes.js
 * =============================================================
 */

import {
  ACCIONES,
  LIMITE_BANDEJA,
  LIMITES_ADJUNTO,
  PESTANAS_BANDEJA,
  ROLES,
} from '../config/constantes.js';
import { armarPestanas, pestanasVisibles } from './bandeja.js';
import * as repositorio from '../data/solicitudesRepositorio.js';
import { obtenerUsuarioPorId, listarUsuariosPorRol } from '../data/usuariosRepositorio.js';
import { obtenerUsuarioActual } from './authServicio.js';
import { leerComoBase64 } from './archivos.js';
import { ErrorAplicacion, aErrorAplicacion } from './errores.js';
import {
  accionesDisponibles,
  calcularTransicion,
  construirEventoAdjunto,
  construirEventoNota,
  formatearNumeroSolicitud,
  puedeAgregarSeguimiento,
  accesoACampos,
  validarArchivoAdjunto,
  validarDatosSolicitud,
} from './flujoSolicitud.js';

/** @typedef {import('../data/modelos.js').Solicitud} Solicitud */
/** @typedef {import('../data/modelos.js').Usuario} Usuario */

// -------------------------------------------------------------
// Utilidades internas
// -------------------------------------------------------------

/**
 * Usuario logueado; falla si no hay sesión.
 * @returns {Usuario}
 * @throws {ErrorAplicacion}
 */
function usuarioRequerido() {
  const usuario = obtenerUsuarioActual();
  if (!usuario) throw new ErrorAplicacion('Tu sesión terminó. Volvé a iniciar sesión.', 'sinSesion');
  return usuario;
}

/**
 * Valida y lee archivos del navegador para guardarlos como adjuntos.
 * @param {File[]} archivos
 * @returns {Promise<{ nombreArchivo: string, tipoMime: string, tamanoBytes: number, contenidoBase64: string }[]>}
 * @throws {ErrorAplicacion} Si algún archivo no cumple los límites (antes de leer ninguno).
 */
async function prepararArchivos(archivos) {
  // ⚠️ IMPORTANTE: se valida ANTES de convertir a base64 (que agranda el archivo ~33%).
  archivos.forEach((archivo) => validarArchivoAdjunto({ nombre: archivo.name, tipo: archivo.type, tamano: archivo.size }));
  return Promise.all(
    archivos.map(async (archivo) => ({
      nombreArchivo: archivo.name,
      tipoMime: archivo.type,
      tamanoBytes: archivo.size,
      contenidoBase64: await leerComoBase64(archivo),
    })),
  );
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
function errorParaUsuario(error, mensajePorDefecto) {
  if (!obtenerUsuarioActual()) {
    return new ErrorAplicacion('Tu sesión terminó. Volvé a iniciar sesión.', 'sinSesion', error);
  }
  return aErrorAplicacion(error, mensajePorDefecto);
}

// -------------------------------------------------------------
// Crear
// -------------------------------------------------------------

/**
 * Crea una solicitud a nombre del usuario logueado, asignada a su supervisor.
 *
 * ⚠️ IMPORTANTE: el número se asigna dentro de una transacción (ver
 * solicitudesRepositorio.crearConNumero) y la solicitud, su evento "creada"
 * y los adjuntos se guardan juntos.
 *
 * @param {{ tipoPermiso: string, fechaInicio: string, fechaFin: string, motivo: string }} datosFormulario
 * @param {File[]} [archivos] - Adjuntos (máximo LIMITES_ADJUNTO.maximoAlCrear).
 * @returns {Promise<{ id: string, numero: string }>}
 * @throws {ErrorAplicacion} Datos inválidos, archivos fuera de límite, sin supervisor activo,
 *   o rechazo del servidor.
 */
export async function crearSolicitud(datosFormulario, archivos = []) {
  try {
    const usuario = usuarioRequerido();
    if (archivos.length > LIMITES_ADJUNTO.maximoAlCrear) {
      throw new ErrorAplicacion(
        `Podés adjuntar hasta ${LIMITES_ADJUNTO.maximoAlCrear} archivos al crear la solicitud; después podés sumar más desde el detalle.`,
        'demasiadosArchivos',
      );
    }
    const datos = validarDatosSolicitud(datosFormulario, { cantidadAdjuntos: archivos.length });
    if (!usuario.supervisorId) {
      throw new ErrorAplicacion('No tenés un supervisor asignado. Contactá al administrador.', 'sinSupervisor');
    }
    const [supervisor, adjuntosLeidos] = await Promise.all([
      obtenerUsuarioPorId(usuario.supervisorId),
      prepararArchivos(archivos),
    ]);

    return await repositorio.crearConNumero((numeroNuevo) => {
      const numero = formatearNumeroSolicitud(numeroNuevo);
      const { cambios, evento } = calcularTransicion({
        accion: ACCIONES.CREAR,
        solicitud: null,
        usuario,
        numero,
        solicitante: usuario,
        supervisor,
      });
      return {
        datos: {
          numero,
          ...datos,
          solicitanteId: usuario.id,
          solicitanteNombre: usuario.nombre,
          supervisorId: usuario.supervisorId,
          cantidadAdjuntos: adjuntosLeidos.length,
          cantidadNotas: 0,
          ...cambios,
        },
        evento,
        adjuntos: adjuntosLeidos.map((adjunto) => ({
          adjunto: { ...adjunto, subidoPor: usuario.id, subidoPorNombre: usuario.nombre },
          // 📝 TRAZABILIDAD: cada archivo inicial también queda en el historial.
          evento: construirEventoAdjunto(null, usuario, adjunto.nombreArchivo),
        })),
      };
    });
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo crear la solicitud. Volvé a intentar.');
  }
}

// -------------------------------------------------------------
// Ver
// -------------------------------------------------------------

/**
 * Detalle de una solicitud con su historial, adjuntos y lo que el usuario puede hacer.
 * Si el usuario es el asignado y todavía no la había visto, la marca como vista.
 *
 * @param {string} id
 * @returns {Promise<{
 *   solicitud: Solicitud,
 *   historial: import('../data/modelos.js').EventoHistorial[],
 *   adjuntos: import('../data/modelos.js').Adjunto[],
 *   acciones: string[],
 *   puedeAgregarSeguimiento: boolean,
 *   campos: Record<string, string>,
 * }>}
 * @throws {ErrorAplicacion} Si no existe o el usuario no tiene permiso para verla.
 */
export async function obtenerDetalle(id) {
  try {
    const usuario = usuarioRequerido();
    // 🔒 SEGURIDAD: Firestore no distingue "no existe" de "no podés verla" (las reglas
    // rechazan leer un documento inexistente). Se usa un único mensaje para ambos casos,
    // así tampoco se revela si un id existe.
    const solicitud = await repositorio.obtenerSolicitud(id).catch((error) => {
      if (error?.code === 'permission-denied') return null;
      throw error;
    });
    if (!solicitud) {
      throw new ErrorAplicacion('La solicitud no existe o no tenés permiso para verla.', 'noDisponible');
    }

    const [historial, adjuntos] = await Promise.all([repositorio.listarHistorial(id), repositorio.listarAdjuntos(id)]);

    if (solicitud.asignadoA === usuario.id && !solicitud.vistaPorAsignado) {
      // Si falla, no se interrumpe el detalle: solo seguiría figurando como "nueva".
      await repositorio.marcarComoVista(id).catch((error) => console.warn('[solicitudesServicio] marcarComoVista', error));
    }

    return {
      solicitud,
      historial,
      adjuntos,
      acciones: accionesDisponibles(solicitud, usuario),
      puedeAgregarSeguimiento: puedeAgregarSeguimiento(solicitud, usuario),
      // ⚠️ IMPORTANTE: control de campos por rol (MATRIZ_CAMPOS) aplicado a este usuario.
      campos: accesoACampos(solicitud, usuario),
    };
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo cargar la solicitud.');
  }
}

/**
 * Carga la bandeja del usuario: una lista por pestaña visible para su rol.
 * Hace 2 consultas (3 para RH y admin) en paralelo; filtros, orden y búsqueda
 * se aplican después en el navegador con bandeja.js.
 *
 * @returns {Promise<{ pestanas: Record<string, Solicitud[]>, visibles: string[], limiteAlcanzado: boolean }>}
 *   limiteAlcanzado = alguna consulta llegó a LIMITE_BANDEJA (puede haber más solicitudes).
 * @throws {ErrorAplicacion}
 */
export async function cargarBandeja() {
  try {
    const usuario = usuarioRequerido();
    const visibles = pestanasVisibles(usuario);
    const [asignadas, participa, todas] = await Promise.all([
      repositorio.listarAsignadasA(usuario.id),
      repositorio.listarDondeParticipa(usuario.id),
      // 🔒 SEGURIDAD: la consulta sin filtro solo se hace para RH y admin (las reglas la rechazarían).
      visibles.includes(PESTANAS_BANDEJA.TODAS) ? repositorio.listarTodas() : null,
    ]);
    return {
      pestanas: armarPestanas({ asignadas, participa, todas }, usuario),
      visibles,
      limiteAlcanzado: [asignadas, participa, todas].some((lista) => lista?.length >= LIMITE_BANDEJA),
    };
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo cargar la bandeja.');
  }
}


// -------------------------------------------------------------
// Acciones del flujo
// -------------------------------------------------------------

/**
 * Ejecuta una acción del flujo (aprobar, devolver, reenviar, rechazar, completar, rechazarRh, cancelar).
 *
 * ⚠️ IMPORTANTE: la validación corre dentro de la transacción con la solicitud
 * recién leída. Si otro usuario la cambió mientras tanto, el error lo explica.
 *
 * @param {string} id
 * @param {string} accion - Una de ACCIONES (salvo "crear").
 * @param {Object} [opciones]
 * @param {string} [opciones.comentario] - Obligatorio al devolver y al rechazar.
 * @param {{ tipoPermiso: string, fechaInicio: string, fechaFin: string, motivo: string }} [opciones.datosCorregidos]
 *   Solo al reenviar: los datos corregidos por el solicitante.
 * @param {{ referenciaRh: string, diasDescontados: number|string }} [opciones.datosGestionRh]
 *   Solo al completar: lo que carga RH (ver MATRIZ_CAMPOS).
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion}
 */
export async function ejecutarAccion(id, accion, { comentario = '', datosCorregidos, datosGestionRh } = {}) {
  try {
    const usuario = usuarioRequerido();
    if (accion === ACCIONES.CREAR) throw new ErrorAplicacion('Acción no válida.', 'accionInvalida');

    // Contexto que puede necesitar la transición (se carga antes de la transacción).
    const solicitudPrevia = await repositorio.obtenerSolicitud(id);
    if (!solicitudPrevia) throw new ErrorAplicacion('La solicitud no existe.', 'noExiste');
    const [supervisor, usuariosRh] = await Promise.all([
      accion === ACCIONES.REENVIAR ? obtenerUsuarioPorId(solicitudPrevia.supervisorId) : undefined,
      accion === ACCIONES.APROBAR ? listarUsuariosPorRol(ROLES.RH) : undefined,
    ]);

    await repositorio.actualizarConEvento(id, (solicitud) => {
      const { cambios, evento } = calcularTransicion({
        accion,
        solicitud,
        usuario,
        comentario,
        numero: solicitud.numero,
        solicitante: { id: solicitud.solicitanteId, nombre: solicitud.solicitanteNombre },
        supervisor: supervisor ?? undefined,
        usuariosRh,
        datosGestionRh,
      });
      // ⚠️ IMPORTANTE: los datos del permiso solo se corrigen al reenviar una devuelta.
      const correccion =
        accion === ACCIONES.REENVIAR && datosCorregidos
          ? validarDatosSolicitud(datosCorregidos, { cantidadAdjuntos: solicitud.cantidadAdjuntos })
          : {};
      return { datos: { ...correccion, ...cambios }, evento };
    });
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo completar la acción.');
  }
}

/**
 * Agrega una nota al trámite (queda en el historial).
 * @param {string} id
 * @param {string} texto
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion} Si no participa, el trámite terminó o la nota está vacía.
 */
export async function agregarNota(id, texto) {
  try {
    const usuario = usuarioRequerido();
    await repositorio.actualizarConEvento(id, (solicitud) => ({
      datos: { cantidadNotas: solicitud.cantidadNotas + 1 },
      evento: construirEventoNota(solicitud, usuario, texto),
    }));
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo guardar la nota.');
  }
}

/**
 * Adjunta un archivo al trámite (queda en el historial).
 * @param {string} id
 * @param {File} archivo
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion} Si el archivo no cumple los límites o el usuario no puede adjuntar.
 */
export async function agregarAdjunto(id, archivo) {
  try {
    const usuario = usuarioRequerido();
    const [adjunto] = await prepararArchivos([archivo]);
    await repositorio.actualizarConEvento(id, (solicitud) => ({
      datos: { cantidadAdjuntos: solicitud.cantidadAdjuntos + 1 },
      evento: construirEventoAdjunto(solicitud, usuario, adjunto.nombreArchivo),
      adjuntos: [{ adjunto: { ...adjunto, subidoPor: usuario.id, subidoPorNombre: usuario.nombre } }],
    }));
  } catch (error) {
    throw errorParaUsuario(error, 'No se pudo adjuntar el archivo.');
  }
}
