/**
 * =============================================================
 * Capa: SERVICIOS (lógica de negocio pura)
 * Archivo: src/services/flujoSolicitud.js
 *
 * Responsabilidad:
 *   Interpretar las reglas del flujo Solicitar → Aprobar → Gestionar RH:
 *   - qué acciones puede ejecutar un usuario sobre una solicitud;
 *   - validar una acción y calcular qué cambia (campos nuevos + evento del historial);
 *   - a quién se asigna la tarea (incluido el reparto rotativo de RH);
 *   - validar los datos de una solicitud, las notas y los archivos adjuntos.
 *
 *   Es PURO: no usa Firebase, el DOM ni la fecha del sistema. Recibe datos y
 *   devuelve datos. Por eso lo usan tanto la app (solicitudesServicio.js) como
 *   el script de datos de prueba (scripts/seed.mjs), y se testea en Node
 *   (scripts/tests/flujoSolicitud.test.mjs).
 *
 * Depende de: src/config/constantes.js, src/services/errores.js
 *
 * Convención: los usuarios llegan con la forma de Usuario (modelos.js), con su
 *   uid en "id". Las fechas del evento (serverTimestamp o Timestamp) las agrega
 *   quien lo guarda, no este módulo.
 * =============================================================
 */

import {
  ACCESO_CAMPO,
  ACCIONES,
  ACCIONES_HISTORIAL,
  CONFIG_TIPOS_PERMISO,
  EJECUTORES,
  ESTADOS,
  ESTADOS_FINALES,
  LIMITES_ADJUNTO,
  MATRIZ_CAMPOS,
  NOMBRES_ROL,
  NUMERACION_SOLICITUD,
  ROLES,
  TRANSICIONES,
} from '../config/constantes.js';
import { ErrorAplicacion } from './errores.js';

/** @typedef {import('../data/modelos.js').Usuario} Usuario */
/** @typedef {import('../data/modelos.js').Solicitud} Solicitud */
/** @typedef {import('../data/modelos.js').EventoHistorial} EventoHistorial */

/** Largo máximo del motivo de una solicitud (igual que en firestore.rules). */
export const LARGO_MAXIMO_MOTIVO = 1000;
/** Largo máximo de un comentario o nota (igual que en firestore.rules). */
export const LARGO_MAXIMO_COMENTARIO = 2000;
/** Largo máximo de la referencia de liquidación de RH (igual que en firestore.rules). */
export const LARGO_MAXIMO_REFERENCIA_RH = 40;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// -------------------------------------------------------------
// Numeración y fechas
// -------------------------------------------------------------

/**
 * Da formato al número correlativo de una solicitud.
 * @param {number} numero - Ej: 11.
 * @returns {string} Ej: "SOL-0011".
 */
export function formatearNumeroSolicitud(numero) {
  return `${NUMERACION_SOLICITUD.PREFIJO}${String(numero).padStart(NUMERACION_SOLICITUD.DIGITOS, '0')}`;
}

/**
 * Convierte "AAAA-MM-DD" en milisegundos UTC. Se usa UTC para que los cambios
 * de horario de verano no hagan que un día "dure" 23 o 25 horas.
 * @param {string} fecha
 * @returns {number}
 * @throws {ErrorAplicacion} Si la fecha no tiene el formato correcto o no existe (ej: 2026-02-30).
 */
function fechaAMilisegundos(fecha) {
  if (typeof fecha !== 'string' || !PATRON_FECHA.test(fecha)) {
    throw new ErrorAplicacion('Ingresá una fecha válida.', 'fechaInvalida');
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const milisegundos = Date.UTC(anio, mes - 1, dia);
  // Date.UTC "corrige" fechas imposibles (30 de febrero → 2 de marzo): se detecta comparando.
  const verificada = new Date(milisegundos);
  if (verificada.getUTCFullYear() !== anio || verificada.getUTCMonth() !== mes - 1 || verificada.getUTCDate() !== dia) {
    throw new ErrorAplicacion('Ingresá una fecha válida.', 'fechaInvalida');
  }
  return milisegundos;
}

/**
 * Cantidad de días corridos del permiso, contando el primero y el último.
 * @param {string} fechaInicio - "AAAA-MM-DD".
 * @param {string} fechaFin - "AAAA-MM-DD".
 * @returns {number} Ej: del 2026-11-03 al 2026-11-07 → 5.
 * @throws {ErrorAplicacion} Si alguna fecha es inválida.
 */
export function calcularCantidadDias(fechaInicio, fechaFin) {
  return Math.round((fechaAMilisegundos(fechaFin) - fechaAMilisegundos(fechaInicio)) / MS_POR_DIA) + 1;
}

// -------------------------------------------------------------
// Validación de datos
// -------------------------------------------------------------

/**
 * Valida los datos que carga el solicitante (al crear o al corregir una devuelta).
 *
 * ⚠️ IMPORTANTE: reglas de negocio de los tipos de permiso (CONFIG_TIPOS_PERMISO).
 * firestore.rules repite estas validaciones en el servidor.
 *
 * @param {{ tipoPermiso: string, fechaInicio: string, fechaFin: string, motivo: string }} datos
 * @param {{ cantidadAdjuntos: number }} contexto - Adjuntos que tendrá la solicitud.
 * @returns {{ tipoPermiso: string, fechaInicio: string, fechaFin: string, motivo: string, cantidadDias: number }}
 *   Datos normalizados (motivo sin espacios sobrantes) y la cantidad de días calculada.
 * @throws {ErrorAplicacion} Con un mensaje claro para el usuario.
 */
export function validarDatosSolicitud(datos, { cantidadAdjuntos }) {
  const configTipo = CONFIG_TIPOS_PERMISO[datos.tipoPermiso];
  if (!configTipo) {
    throw new ErrorAplicacion('Elegí un tipo de permiso.', 'tipoInvalido');
  }

  const cantidadDias = calcularCantidadDias(datos.fechaInicio, datos.fechaFin);
  if (cantidadDias < 1) {
    throw new ErrorAplicacion('La fecha de fin no puede ser anterior a la de inicio.', 'fechasInvertidas');
  }
  if (cantidadDias > configTipo.diasMaximos) {
    throw new ErrorAplicacion(
      `${configTipo.nombre} admite como máximo ${configTipo.diasMaximos} días (pediste ${cantidadDias}).`,
      'superaDiasMaximos',
    );
  }

  const motivo = String(datos.motivo ?? '').trim();
  if (!motivo) {
    throw new ErrorAplicacion('Contá brevemente el motivo del permiso.', 'motivoVacio');
  }
  if (motivo.length > LARGO_MAXIMO_MOTIVO) {
    throw new ErrorAplicacion(`El motivo puede tener hasta ${LARGO_MAXIMO_MOTIVO} caracteres.`, 'motivoLargo');
  }

  if (configTipo.requiereAdjunto && cantidadAdjuntos < 1) {
    throw new ErrorAplicacion(
      `${configTipo.nombre} requiere adjuntar documentación (por ejemplo, un certificado).`,
      'faltaAdjunto',
    );
  }

  return {
    tipoPermiso: datos.tipoPermiso,
    fechaInicio: datos.fechaInicio,
    fechaFin: datos.fechaFin,
    motivo,
    cantidadDias,
  };
}

/**
 * Valida un archivo antes de adjuntarlo (se llama ANTES de convertirlo a base64).
 * 🔒 SEGURIDAD: firestore.rules valida los mismos límites en el servidor.
 * @param {{ nombre: string, tipo: string, tamano: number }} archivo - Datos del File del navegador.
 * @throws {ErrorAplicacion} Si el tipo no está permitido o supera los 600 KB.
 */
export function validarArchivoAdjunto({ nombre, tipo, tamano }) {
  if (!LIMITES_ADJUNTO.tiposMimePermitidos.includes(tipo)) {
    throw new ErrorAplicacion(`"${nombre}": solo se permiten archivos PDF, JPG o PNG.`, 'tipoArchivoInvalido');
  }
  if (tamano <= 0) {
    throw new ErrorAplicacion(`"${nombre}" está vacío.`, 'archivoVacio');
  }
  if (tamano > LIMITES_ADJUNTO.tamanoMaximoBytes) {
    const kb = Math.ceil(tamano / 1024);
    throw new ErrorAplicacion(`"${nombre}" pesa ${kb} KB; el máximo es 600 KB.`, 'archivoGrande');
  }
}

/**
 * Valida los datos que carga RH al completar la gestión.
 * ⚠️ IMPORTANTE: la referencia es obligatoria y los días descontados no pueden
 * superar los días del permiso. firestore.rules exige lo mismo.
 * @param {{ referenciaRh: string, diasDescontados: number|string }} datos - Valores del formulario.
 * @param {number} cantidadDias - Días del permiso.
 * @returns {{ referenciaRh: string, diasDescontados: number }} Datos normalizados.
 * @throws {ErrorAplicacion} Si falta la referencia o los días no son válidos.
 */
export function validarGestionRh(datos, cantidadDias) {
  const referenciaRh = String(datos?.referenciaRh ?? '').trim();
  if (!referenciaRh) {
    throw new ErrorAplicacion('Ingresá la referencia de liquidación para completar la gestión.', 'faltaReferenciaRh');
  }
  if (referenciaRh.length > LARGO_MAXIMO_REFERENCIA_RH) {
    throw new ErrorAplicacion(`La referencia puede tener hasta ${LARGO_MAXIMO_REFERENCIA_RH} caracteres.`, 'referenciaLarga');
  }
  const texto = String(datos?.diasDescontados ?? '').trim();
  const diasDescontados = Number(texto);
  if (texto === '' || !Number.isInteger(diasDescontados) || diasDescontados < 0 || diasDescontados > cantidadDias) {
    throw new ErrorAplicacion(`Los días descontados tienen que ser un número entero entre 0 y ${cantidadDias}.`, 'diasDescontadosInvalidos');
  }
  return { referenciaRh, diasDescontados };
}

/**
 * Normaliza y valida el texto de una nota o comentario.
 * @param {string} texto
 * @param {{ obligatorio: boolean }} opciones
 * @returns {string} Texto sin espacios sobrantes.
 * @throws {ErrorAplicacion} Si es obligatorio y está vacío, o si es demasiado largo.
 */
export function validarComentario(texto, { obligatorio }) {
  const limpio = String(texto ?? '').trim();
  if (obligatorio && !limpio) {
    throw new ErrorAplicacion('Escribí un comentario explicando el motivo.', 'comentarioObligatorio');
  }
  if (limpio.length > LARGO_MAXIMO_COMENTARIO) {
    throw new ErrorAplicacion(`El comentario puede tener hasta ${LARGO_MAXIMO_COMENTARIO} caracteres.`, 'comentarioLargo');
  }
  return limpio;
}

// -------------------------------------------------------------
// Permisos sobre una solicitud
// -------------------------------------------------------------

/**
 * Indica si el usuario puede ejecutar una acción sobre la solicitud (sin lanzar errores).
 * @param {string} accion - Una de ACCIONES.
 * @param {Solicitud|null} solicitud - null para la acción "crear".
 * @param {Usuario} usuario
 * @returns {boolean}
 */
export function puedeEjecutar(accion, solicitud, usuario) {
  return motivoDeRechazo(accion, solicitud, usuario) === null;
}

/**
 * ⚠️ IMPORTANTE: aplica la tabla TRANSICIONES a un caso concreto.
 * @param {string} accion
 * @param {Solicitud|null} solicitud
 * @param {Usuario} usuario
 * @returns {string|null} Por qué no puede ejecutarla, o null si puede.
 */
function motivoDeRechazo(accion, solicitud, usuario) {
  const transicion = TRANSICIONES[accion];
  if (!transicion) return 'La acción no existe.';
  if (!usuario?.activo) return 'Tu usuario no está activo.';
  if (usuario.rol !== transicion.rolRequerido) {
    return `Esta acción corresponde al rol ${NOMBRES_ROL[transicion.rolRequerido]}.`;
  }

  if (accion === ACCIONES.CREAR) return null;
  if (!solicitud) return 'La solicitud no existe.';

  if (!transicion.estadosOrigen.includes(solicitud.estadoActual)) {
    return 'La solicitud ya no está en un estado que permita esta acción.';
  }
  if (transicion.ejecutor === EJECUTORES.ASIGNADO && solicitud.asignadoA !== usuario.id) {
    return 'Solo puede hacerlo el usuario que tiene asignada la solicitud.';
  }
  if (transicion.ejecutor === EJECUTORES.SOLICITANTE && solicitud.solicitanteId !== usuario.id) {
    return 'Solo puede hacerlo quien creó la solicitud.';
  }
  return null;
}

/**
 * Acciones de flujo que el usuario puede ejecutar ahora sobre la solicitud.
 * La pantalla de detalle muestra un botón por cada una.
 * @param {Solicitud} solicitud
 * @param {Usuario} usuario
 * @returns {string[]} Ej: ["aprobar", "devolver", "rechazar"] para el supervisor asignado.
 */
export function accionesDisponibles(solicitud, usuario) {
  return Object.values(ACCIONES).filter(
    (accion) => accion !== ACCIONES.CREAR && puedeEjecutar(accion, solicitud, usuario),
  );
}

/**
 * Indica si el usuario participa del trámite (lo creó, lo tiene asignado o intervino).
 * @param {Solicitud} solicitud
 * @param {Usuario} usuario
 * @returns {boolean}
 */
export function esParticipante(solicitud, usuario) {
  return (
    solicitud.solicitanteId === usuario.id ||
    solicitud.asignadoA === usuario.id ||
    (solicitud.participantes ?? []).includes(usuario.id)
  );
}

/**
 * Indica si el usuario puede agregar notas o adjuntos: participa del trámite,
 * está activo y el trámite no terminó (firestore.rules exige lo mismo).
 * @param {Solicitud} solicitud
 * @param {Usuario} usuario
 * @returns {boolean}
 */
export function puedeAgregarSeguimiento(solicitud, usuario) {
  return Boolean(usuario?.activo) && esParticipante(solicitud, usuario) && !ESTADOS_FINALES.includes(solicitud.estadoActual);
}

/**
 * ⚠️ IMPORTANTE: los datos del permiso solo los corrige el solicitante cuando
 * le devolvieron la solicitud, y se guardan al reenviarla.
 * @param {Solicitud} solicitud
 * @param {Usuario} usuario
 * @returns {boolean}
 */
export function puedeCorregirDatos(solicitud, usuario) {
  return puedeEjecutar(ACCIONES.REENVIAR, solicitud, usuario);
}

/**
 * ⚠️ IMPORTANTE (control de campos por rol): aplica MATRIZ_CAMPOS a un caso concreto.
 * Un campo es:
 *   - EDITABLE si el usuario puede ejecutar ahora la acción que lo guarda (mismo
 *     estado, rol y ejecutor que pide la matriz);
 *   - LECTURA si su rol y el estado están entre los que pueden verlo, o si el
 *     estado está en "lecturaGeneralEn";
 *   - OCULTO en cualquier otro caso.
 * @param {Solicitud} solicitud
 * @param {Usuario} usuario
 * @returns {Record<string, string>} Acceso por campo (valores de ACCESO_CAMPO).
 */
export function accesoACampos(solicitud, usuario) {
  const acceso = {};
  for (const [campo, config] of Object.entries(MATRIZ_CAMPOS)) {
    const { edicion, lectura, lecturaGeneralEn = [] } = config;
    const editable = solicitud.estadoActual === edicion.estado && puedeEjecutar(edicion.accion, solicitud, usuario);
    const rolPuedeVer = !lectura.roles || lectura.roles.includes(usuario.rol);
    const estadoPermiteVer = !lectura.estados || lectura.estados.includes(solicitud.estadoActual);
    const visible = (rolPuedeVer && estadoPermiteVer) || lecturaGeneralEn.includes(solicitud.estadoActual);

    if (editable) acceso[campo] = ACCESO_CAMPO.EDITABLE;
    else if (visible) acceso[campo] = ACCESO_CAMPO.LECTURA;
    else acceso[campo] = ACCESO_CAMPO.OCULTO;
  }
  return acceso;
}

// -------------------------------------------------------------
// Asignación
// -------------------------------------------------------------

/**
 * ⚠️ IMPORTANTE: reparto rotativo de la gestión RH (DECISIONES.md #8).
 * Ordena los RH activos por nombre y elige según el número de la solicitud,
 * así las tareas se reparten parejo sin leer las tareas de nadie.
 * @param {string|number} numero - "SOL-0011" o 11.
 * @param {Usuario[]} usuariosRh - Usuarios con rol RH (se ignoran los inactivos).
 * @returns {Usuario} El usuario RH elegido.
 * @throws {ErrorAplicacion} Si no hay ningún usuario RH activo.
 */
export function elegirUsuarioRh(numero, usuariosRh) {
  const activos = usuariosRh
    .filter((u) => u.rol === ROLES.RH && u.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id));
  if (activos.length === 0) {
    throw new ErrorAplicacion('No hay usuarios de Recursos Humanos activos para asignar la solicitud.', 'sinRh');
  }
  const numeroEntero = typeof numero === 'number' ? numero : Number.parseInt(String(numero).replace(/\D/g, ''), 10);
  return activos[numeroEntero % activos.length];
}

/**
 * A quién le toca actuar después de una transición.
 * @param {string} estadoNuevo
 * @param {{ solicitante: {id: string, nombre: string}, supervisor?: Usuario, usuariosRh?: Usuario[], numero: string }} contexto
 * @returns {{ id: string, nombre: string, rol: string }|null} null en los estados finales.
 * @throws {ErrorAplicacion} Si falta el supervisor o no hay RH activos.
 */
function resolverAsignado(estadoNuevo, { solicitante, supervisor, usuariosRh, numero }) {
  switch (estadoNuevo) {
    case ESTADOS.EN_APROBACION:
      if (!supervisor?.activo) {
        throw new ErrorAplicacion('No tenés un supervisor activo asignado. Contactá al administrador.', 'sinSupervisor');
      }
      return { id: supervisor.id, nombre: supervisor.nombre, rol: ROLES.SUPERVISOR };
    case ESTADOS.DEVUELTA:
      return { id: solicitante.id, nombre: solicitante.nombre, rol: ROLES.INICIADOR };
    case ESTADOS.EN_GESTION_RH: {
      const rh = elegirUsuarioRh(numero, usuariosRh ?? []);
      return { id: rh.id, nombre: rh.nombre, rol: ROLES.RH };
    }
    default:
      return null; // estados finales: nadie más tiene que actuar
  }
}

// -------------------------------------------------------------
// Transiciones y eventos
// -------------------------------------------------------------

/**
 * 📝 TRAZABILIDAD: arma un evento del historial (sin fecha: la agrega quien lo guarda).
 * @param {Usuario} usuario - Quien hace la acción.
 * @param {string} accionHistorial - Una de ACCIONES_HISTORIAL.
 * @param {{ estadoAnterior: string|null, estadoNuevo: string|null, etapaAnterior: string|null, etapaNueva: string|null }|null} cambio
 * @param {string} comentario
 * @returns {Omit<EventoHistorial, 'id'|'fecha'>}
 */
function construirEvento(usuario, accionHistorial, cambio, comentario) {
  return {
    accion: accionHistorial,
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
    rolUsuario: usuario.rol,
    estadoAnterior: cambio?.estadoAnterior ?? null,
    estadoNuevo: cambio?.estadoNuevo ?? null,
    etapaAnterior: cambio?.etapaAnterior ?? null,
    etapaNueva: cambio?.etapaNueva ?? null,
    comentario,
  };
}

/**
 * Valida una acción del flujo y calcula qué cambia en la solicitud y qué evento se registra.
 *
 * ⚠️ IMPORTANTE: es el corazón del flujo. firestore.rules vuelve a verificar
 * todo en el servidor; esta función existe para dar mensajes claros antes de
 * intentar guardar y para que la app y los datos de prueba usen la misma lógica.
 *
 * @param {Object} parametros
 * @param {string} parametros.accion - Una de ACCIONES.
 * @param {Solicitud|null} parametros.solicitud - Estado actual (null al crear).
 * @param {Usuario} parametros.usuario - Quien ejecuta la acción.
 * @param {string} [parametros.comentario] - Obligatorio al devolver o rechazar.
 * @param {string} parametros.numero - Número de la solicitud (para el reparto RH).
 * @param {{id: string, nombre: string}} parametros.solicitante - Dueño de la solicitud.
 * @param {Usuario} [parametros.supervisor] - Supervisor del solicitante (al crear y reenviar).
 * @param {Usuario[]} [parametros.usuariosRh] - Usuarios RH (al aprobar).
 * @param {{ referenciaRh: string, diasDescontados: number|string }} [parametros.datosGestionRh]
 *   Obligatorio al completar: lo que carga RH (ver MATRIZ_CAMPOS).
 * @returns {{ cambios: Partial<Solicitud>, evento: Omit<EventoHistorial, 'id'|'fecha'> }}
 * @throws {ErrorAplicacion} Si la acción no está permitida o faltan datos.
 */
export function calcularTransicion({
  accion,
  solicitud,
  usuario,
  comentario = '',
  numero,
  solicitante,
  supervisor,
  usuariosRh,
  datosGestionRh,
}) {
  const rechazo = motivoDeRechazo(accion, solicitud, usuario);
  if (rechazo) throw new ErrorAplicacion(rechazo, 'accionNoPermitida');

  const transicion = TRANSICIONES[accion];
  const comentarioLimpio = validarComentario(comentario, { obligatorio: transicion.requiereComentario });
  // ⚠️ IMPORTANTE: los campos de gestión RH nacen vacíos y solo se cargan al completar.
  const gestionRh =
    accion === ACCIONES.CREAR
      ? { referenciaRh: null, diasDescontados: null }
      : accion === ACCIONES.COMPLETAR
        ? validarGestionRh(datosGestionRh, solicitud.cantidadDias)
        : {};
  const asignado = resolverAsignado(transicion.estadoNuevo, { solicitante, supervisor, usuariosRh, numero });
  const esFinal = ESTADOS_FINALES.includes(transicion.estadoNuevo);

  const participantes = new Set(solicitud?.participantes ?? []);
  participantes.add(usuario.id);
  if (asignado) participantes.add(asignado.id);

  const cambios = {
    estadoActual: transicion.estadoNuevo,
    etapaActual: transicion.etapaNueva,
    asignadoA: asignado?.id ?? null,
    asignadoNombre: asignado?.nombre ?? null,
    rolAsignado: asignado?.rol ?? null,
    // El nuevo asignado todavía no la vio ("Nuevas"); si terminó, no hay nada nuevo.
    vistaPorAsignado: esFinal,
    participantes: [...participantes],
    ...gestionRh,
  };

  const evento = construirEvento(
    usuario,
    transicion.accionHistorial,
    {
      estadoAnterior: solicitud?.estadoActual ?? null,
      estadoNuevo: transicion.estadoNuevo,
      etapaAnterior: solicitud?.etapaActual ?? null,
      etapaNueva: transicion.etapaNueva,
    },
    comentarioLimpio,
  );

  return { cambios, evento };
}

/**
 * 📝 TRAZABILIDAD: evento de una nota. Valida que el usuario pueda agregarla.
 * @param {Solicitud} solicitud
 * @param {Usuario} usuario
 * @param {string} texto
 * @returns {Omit<EventoHistorial, 'id'|'fecha'>}
 * @throws {ErrorAplicacion} Si no participa, el trámite terminó o la nota está vacía.
 */
export function construirEventoNota(solicitud, usuario, texto) {
  if (!puedeAgregarSeguimiento(solicitud, usuario)) {
    throw new ErrorAplicacion('No podés agregar notas a esta solicitud.', 'seguimientoNoPermitido');
  }
  const comentario = validarComentario(texto, { obligatorio: true });
  return construirEvento(usuario, ACCIONES_HISTORIAL.NOTA_AGREGADA, null, comentario);
}

/**
 * 📝 TRAZABILIDAD: evento de un adjunto. Al crear la solicitud se pasa
 * solicitud = null (el solicitante adjunta junto con la creación).
 * @param {Solicitud|null} solicitud
 * @param {Usuario} usuario
 * @param {string} nombreArchivo
 * @returns {Omit<EventoHistorial, 'id'|'fecha'>}
 * @throws {ErrorAplicacion} Si no puede agregar adjuntos a esa solicitud.
 */
export function construirEventoAdjunto(solicitud, usuario, nombreArchivo) {
  if (solicitud && !puedeAgregarSeguimiento(solicitud, usuario)) {
    throw new ErrorAplicacion('No podés adjuntar archivos a esta solicitud.', 'seguimientoNoPermitido');
  }
  return construirEvento(usuario, ACCIONES_HISTORIAL.ADJUNTO_AGREGADO, null, nombreArchivo);
}
