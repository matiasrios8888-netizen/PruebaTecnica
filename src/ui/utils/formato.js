/**
 * =============================================================
 * Capa: UI (utilidad compartida)
 * Archivo: src/ui/utils/formato.js
 *
 * Responsabilidad: mostrar fechas, tamaños y estados en formato legible
 *   para el usuario (es-AR).
 *
 * Depende de: src/config/constantes.js, src/services/catalogoRoles.js (nombres de los roles)
 * =============================================================
 */

import { CONFIG_TIPOS_PERMISO, ESTADOS, NOMBRES_ESTADO, NOMBRES_ETAPA } from '../../config/constantes.js';
import { nombreDeRol } from '../../services/catalogoRoles.js';

const formatoFechaHora = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Timestamp de Firestore → "15/10/26, 12:51".
 * @param {{ toDate: () => Date }|null|undefined} timestamp
 * @returns {string} "—" si no hay fecha (por ejemplo, mientras el servidor la asigna).
 */
export function formatearFechaHora(timestamp) {
  return timestamp?.toDate ? formatoFechaHora.format(timestamp.toDate()) : '—';
}

/**
 * Date del navegador → "15/10/26, 12:51" (por ejemplo, el momento de un reporte).
 * @param {Date} fecha
 * @returns {string}
 */
export function formatearMomento(fecha) {
  return formatoFechaHora.format(fecha);
}

/**
 * "2026-11-03" → "03/11/2026" (sin pasar por Date, para no correr el día por la zona horaria).
 * @param {string} fecha
 * @returns {string}
 */
export function formatearFechaCalendario(fecha) {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Bytes → "182 KB".
 * @param {number} bytes
 * @returns {string}
 */
export function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

/** Nombre para mostrar de un tipo de permiso. */
export const nombreTipo = (tipo) => CONFIG_TIPOS_PERMISO[tipo]?.nombre ?? tipo;
/** Nombre para mostrar de un estado. */
export const nombreEstado = (estado) => NOMBRES_ESTADO[estado] ?? estado;
/** Nombre para mostrar de una etapa. */
export const nombreEtapa = (etapa) => NOMBRES_ETAPA[etapa] ?? etapa;
/** Nombre para mostrar de un rol: el que eligió el admin en la gestión de roles (o el de fábrica). */
export const nombreRol = (rol) => nombreDeRol(rol);

/**
 * Clase CSS de la "etiqueta" de color de cada estado.
 * @param {string} estado
 * @returns {string}
 */
export function claseEstado(estado) {
  const clases = {
    [ESTADOS.EN_APROBACION]: 'etiqueta--pendiente',
    [ESTADOS.DEVUELTA]: 'etiqueta--alerta',
    [ESTADOS.EN_GESTION_RH]: 'etiqueta--pendiente',
    [ESTADOS.COMPLETADA]: 'etiqueta--ok',
    [ESTADOS.RECHAZADA]: 'etiqueta--error',
    [ESTADOS.CANCELADA]: 'etiqueta--neutra',
  };
  return `etiqueta ${clases[estado] ?? 'etiqueta--neutra'}`;
}
