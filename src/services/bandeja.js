/**
 * =============================================================
 * Capa: SERVICIOS (lógica de negocio pura)
 * Archivo: src/services/bandeja.js
 *
 * Responsabilidad:
 *   Reglas de la bandeja de tareas:
 *   - qué pestañas ve cada usuario y qué solicitudes van en cada una;
 *   - filtrar (texto, estado, etapa, tipo, rango de fechas);
 *   - ordenar;
 *   - contar.
 *
 *   Es PURO (sin Firebase ni DOM): recibe listas de solicitudes ya leídas y
 *   devuelve listas nuevas. Lo usa solicitudesServicio.cargarBandeja() y la
 *   pantalla de la bandeja; se testea en scripts/tests/bandeja.test.mjs.
 *
 * Depende de: src/config/constantes.js
 *
 * Decisión (DECISIONES.md #22): Firestore trae cada pestaña ordenada por
 *   fecha (con índices compuestos) y el filtrado, orden y búsqueda se hacen
 *   acá, en el navegador: Firestore no tiene búsqueda de texto y cada
 *   combinación de filtros necesitaría su propio índice.
 * =============================================================
 */

import {
  CONFIG_TIPOS_PERMISO,
  ORDENES_BANDEJA,
  PESTANAS_BANDEJA,
  ROLES_VEN_TODAS,
} from '../config/constantes.js';

/** @typedef {import('../data/modelos.js').Solicitud} Solicitud */
/** @typedef {import('../data/modelos.js').Usuario} Usuario */

/**
 * Filtros de la bandeja ("" = sin filtrar por ese campo).
 * @typedef {Object} FiltrosBandeja
 * @property {string} texto - Busca en número, solicitante, asignado, tipo y motivo.
 * @property {string} estado - Una de ESTADOS.
 * @property {string} etapa - Una de ETAPAS.
 * @property {string} tipoPermiso - Una de TIPOS_PERMISO.
 * @property {string} desde - "AAAA-MM-DD": permisos que terminan este día o después.
 * @property {string} hasta - "AAAA-MM-DD": permisos que empiezan este día o antes.
 */

/**
 * Filtros vacíos (estado inicial de la bandeja).
 * @returns {FiltrosBandeja}
 */
export function filtrosVacios() {
  return { texto: '', estado: '', etapa: '', tipoPermiso: '', desde: '', hasta: '' };
}

/**
 * Indica si hay algún filtro activo.
 * @param {FiltrosBandeja} filtros
 * @returns {boolean}
 */
export function hayFiltrosActivos(filtros) {
  return Object.values(filtros).some((valor) => String(valor ?? '').trim() !== '');
}

// -------------------------------------------------------------
// Pestañas
// -------------------------------------------------------------

/**
 * 🔒 SEGURIDAD: pestañas que ve un usuario. "Todas" solo para RH y admin
 * (además, firestore.rules rechaza esa consulta para los demás roles).
 * @param {Usuario} usuario
 * @returns {string[]} Claves de PESTANAS_BANDEJA, en orden.
 */
export function pestanasVisibles(usuario) {
  const pestanas = [PESTANAS_BANDEJA.PENDIENTES, PESTANAS_BANDEJA.NUEVAS, PESTANAS_BANDEJA.ENVIADAS];
  if (ROLES_VEN_TODAS.includes(usuario.rol)) pestanas.push(PESTANAS_BANDEJA.TODAS);
  return pestanas;
}

/**
 * ⚠️ IMPORTANTE: arma el contenido de cada pestaña a partir de las consultas.
 *   - Pendientes: asignadas a mí (solo los trámites abiertos tienen asignado).
 *   - Nuevas: pendientes que todavía no abrí (vistaPorAsignado = false).
 *   - Enviadas: en las que participo pero que ya no tengo asignadas
 *     (las que creé y están en otras manos, las que aprobé o devolví, las finalizadas).
 *   - Todas: sin filtrar (solo si se consultó, es decir, para RH y admin).
 *
 * @param {{ asignadas: Solicitud[], participa: Solicitud[], todas?: Solicitud[]|null }} consultas
 * @param {Usuario} usuario
 * @returns {Record<string, Solicitud[]>} Una lista por pestaña visible.
 */
export function armarPestanas({ asignadas, participa, todas = null }, usuario) {
  const pestanas = {
    [PESTANAS_BANDEJA.PENDIENTES]: asignadas,
    [PESTANAS_BANDEJA.NUEVAS]: asignadas.filter((s) => !s.vistaPorAsignado),
    [PESTANAS_BANDEJA.ENVIADAS]: participa.filter((s) => s.asignadoA !== usuario.id),
  };
  if (ROLES_VEN_TODAS.includes(usuario.rol) && todas) pestanas[PESTANAS_BANDEJA.TODAS] = todas;
  return pestanas;
}

/**
 * Cantidad de solicitudes de cada pestaña (para las etiquetas de las pestañas).
 * @param {Record<string, Solicitud[]>} pestanas
 * @returns {Record<string, number>}
 */
export function contarPestanas(pestanas) {
  return Object.fromEntries(Object.entries(pestanas).map(([clave, lista]) => [clave, lista.length]));
}

// -------------------------------------------------------------
// Búsqueda y filtros
// -------------------------------------------------------------

/**
 * Pasa a minúsculas y quita tildes ("Gómez" → "gomez") para comparar textos.
 * @param {unknown} texto
 * @returns {string}
 */
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD') // separa la letra de su tilde: "ó" → "o" + "´"
    .replace(/[̀-ͯ]/g, '') // borra las tildes sueltas
    .toLowerCase()
    .trim();
}

/**
 * Indica si la solicitud contiene TODAS las palabras buscadas (en cualquier campo).
 * Ej: "ana vacaciones" encuentra las vacaciones de Ana Gómez.
 * @param {Solicitud} solicitud
 * @param {string} texto
 * @returns {boolean}
 */
export function coincideBusqueda(solicitud, texto) {
  const palabras = normalizarTexto(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const contenido = normalizarTexto(
    [
      solicitud.numero,
      solicitud.solicitanteNombre,
      solicitud.asignadoNombre,
      CONFIG_TIPOS_PERMISO[solicitud.tipoPermiso]?.nombre,
      solicitud.motivo,
    ].join(' '),
  );
  return palabras.every((palabra) => contenido.includes(palabra));
}

/**
 * Aplica los filtros a una lista (no la modifica: devuelve una nueva).
 * El rango de fechas busca SUPERPOSICIÓN: un permiso del 10 al 20 aparece si
 * el filtro es "del 15 al 30". Las fechas "AAAA-MM-DD" se comparan como texto.
 * @param {Solicitud[]} lista
 * @param {FiltrosBandeja} filtros
 * @returns {Solicitud[]}
 */
export function filtrarSolicitudes(lista, filtros) {
  const { texto, estado, etapa, tipoPermiso, desde, hasta } = { ...filtrosVacios(), ...filtros };
  return lista.filter(
    (s) =>
      (!estado || s.estadoActual === estado) &&
      (!etapa || s.etapaActual === etapa) &&
      (!tipoPermiso || s.tipoPermiso === tipoPermiso) &&
      (!desde || s.fechaFin >= desde) &&
      (!hasta || s.fechaInicio <= hasta) &&
      coincideBusqueda(s, texto),
  );
}

// -------------------------------------------------------------
// Orden
// -------------------------------------------------------------

/**
 * Milisegundos de un Timestamp de Firestore (o 0 si todavía no tiene fecha).
 * @param {{ toMillis?: () => number }|null|undefined} timestamp
 * @returns {number}
 */
const milisegundos = (timestamp) => timestamp?.toMillis?.() ?? 0;

/** Comparadores de cada criterio de orden (negativo = "a" va primero). */
const COMPARADORES = {
  [ORDENES_BANDEJA.RECIENTES]: (a, b) => milisegundos(b.fechaActualizacion) - milisegundos(a.fechaActualizacion),
  [ORDENES_BANDEJA.ANTIGUAS]: (a, b) => milisegundos(a.fechaActualizacion) - milisegundos(b.fechaActualizacion),
  [ORDENES_BANDEJA.INICIO_PROXIMO]: (a, b) => a.fechaInicio.localeCompare(b.fechaInicio),
  [ORDENES_BANDEJA.INICIO_LEJANO]: (a, b) => b.fechaInicio.localeCompare(a.fechaInicio),
  // "SOL-0011" > "SOL-0002" como texto porque tienen la misma cantidad de dígitos.
  [ORDENES_BANDEJA.NUMERO_DESC]: (a, b) => b.numero.localeCompare(a.numero),
  [ORDENES_BANDEJA.NUMERO_ASC]: (a, b) => a.numero.localeCompare(b.numero),
};

/**
 * Ordena una lista (devuelve una copia ordenada).
 * @param {Solicitud[]} lista
 * @param {string} orden - Una de ORDENES_BANDEJA (por defecto, las más recientes primero).
 * @returns {Solicitud[]}
 */
export function ordenarSolicitudes(lista, orden = ORDENES_BANDEJA.RECIENTES) {
  const comparador = COMPARADORES[orden] ?? COMPARADORES[ORDENES_BANDEJA.RECIENTES];
  return [...lista].sort(comparador);
}

/**
 * Filtra y ordena en un solo paso (lo que muestra la tabla).
 * @param {Solicitud[]} lista
 * @param {FiltrosBandeja} filtros
 * @param {string} orden
 * @returns {Solicitud[]}
 */
export function procesarBandeja(lista, filtros, orden) {
  return ordenarSolicitudes(filtrarSolicitudes(lista, filtros), orden);
}
