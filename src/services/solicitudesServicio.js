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

import { ACCIONES, ESTADOS_FINALES, LIMITES_ADJUNTO, ROLES } from '../config/constantes.js';
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
  puedeCorregirDatos,
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

/** Ordena solicitudes de la más reciente a la más vieja (por última actualización). */
const porActualizacionDescendente = (a, b) =>
  (b.fechaActualizacion?.toMillis?.() ?? 0) - (a.fechaActualizacion?.toMillis?.() ?? 0);

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
    throw aErrorAplicacion(error, 'No se pudo crear la solicitud. Volvé a intentar.');
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
 *   puedeCorregirDatos: boolean,
 * }>}
 * @throws {ErrorAplicacion} Si no existe o el usuario no tiene permiso para verla.
 */
export async function obtenerDetalle(id) {
  try {
    const usuario = usuarioRequerido();
    const solicitud = await repositorio.obtenerSolicitud(id);
    if (!solicitud) throw new ErrorAplicacion('La solicitud no existe.', 'noExiste');

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
      puedeCorregirDatos: puedeCorregirDatos(solicitud, usuario),
    };
  } catch (error) {
    throw aErrorAplicacion(error, 'No se pudo cargar la solicitud.');
  }
}

/**
 * Listas del inicio: tareas asignadas al usuario y solicitudes en las que participa.
 * (La bandeja completa, con filtros y búsqueda, llega en la Fase 3.)
 * @returns {Promise<{ tareas: Solicitud[], solicitudes: Solicitud[] }>}
 * @throws {ErrorAplicacion}
 */
export async function listarInicio() {
  try {
    const usuario = usuarioRequerido();
    const [tareas, participa] = await Promise.all([
      repositorio.listarAsignadasA(usuario.id),
      repositorio.listarDondeParticipa(usuario.id),
    ]);
    return {
      tareas: tareas.filter((s) => !ESTADOS_FINALES.includes(s.estadoActual)).sort(porActualizacionDescendente),
      solicitudes: participa.sort(porActualizacionDescendente),
    };
  } catch (error) {
    throw aErrorAplicacion(error, 'No se pudieron cargar tus solicitudes.');
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
 * @returns {Promise<void>}
 * @throws {ErrorAplicacion}
 */
export async function ejecutarAccion(id, accion, { comentario = '', datosCorregidos } = {}) {
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
      });
      // ⚠️ IMPORTANTE: los datos del permiso solo se corrigen al reenviar una devuelta.
      const correccion =
        accion === ACCIONES.REENVIAR && datosCorregidos
          ? validarDatosSolicitud(datosCorregidos, { cantidadAdjuntos: solicitud.cantidadAdjuntos })
          : {};
      return { datos: { ...correccion, ...cambios }, evento };
    });
  } catch (error) {
    throw aErrorAplicacion(error, 'No se pudo completar la acción.');
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
    throw aErrorAplicacion(error, 'No se pudo guardar la nota.');
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
    throw aErrorAplicacion(error, 'No se pudo adjuntar el archivo.');
  }
}
