/**
 * =============================================================
 * Capa: UI (componente)
 * Archivo: src/ui/componentes/tablaSolicitudes.js
 *
 * Responsabilidad:
 *   Dibujar una tabla de solicitudes (número, tipo, solicitante, fechas,
 *   estado, asignado, última actualización) con la marca "Nueva", y hacer
 *   que cada fila abra el detalle.
 *
 * Depende de: src/ui/router.js, src/ui/utils/html.js, src/ui/utils/formato.js
 * =============================================================
 */

import { navegar, rutaDetalle } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import {
  claseEstado,
  formatearFechaCalendario,
  formatearFechaHora,
  nombreEstado,
  nombreTipo,
} from '../utils/formato.js';

/**
 * HTML de la tabla.
 * 🔒 SEGURIDAD: todos los datos que vienen de Firestore pasan por escaparHtml.
 * @param {import('../../data/modelos.js').Solicitud[]} lista
 * @param {import('../../data/modelos.js').Usuario} usuario - Para la marca "Nueva".
 * @returns {string}
 */
export function htmlTablaSolicitudes(lista, usuario) {
  const filas = lista
    .map((s) => {
      // "Nueva" = me la asignaron y todavía no la abrí (vistaPorAsignado = false).
      const nueva =
        s.asignadoA === usuario.id && !s.vistaPorAsignado ? ' <span class="etiqueta etiqueta--nueva">Nueva</span>' : '';
      return `
        <tr data-id="${escaparHtml(s.id)}">
          <td><a href="${rutaDetalle(s.id)}">${escaparHtml(s.numero)}</a>${nueva}</td>
          <td>${escaparHtml(nombreTipo(s.tipoPermiso))}</td>
          <td>${escaparHtml(s.solicitanteNombre)}</td>
          <td>${formatearFechaCalendario(s.fechaInicio)} – ${formatearFechaCalendario(s.fechaFin)}</td>
          <td><span class="${claseEstado(s.estadoActual)}">${escaparHtml(nombreEstado(s.estadoActual))}</span></td>
          <td>${escaparHtml(s.asignadoNombre ?? '—')}</td>
          <td>${formatearFechaHora(s.fechaActualizacion)}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr><th>Número</th><th>Tipo</th><th>Solicitante</th><th>Fechas</th><th>Estado</th><th>Asignado a</th><th>Actualizada</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

/**
 * Hace que cada fila de la tabla abra el detalle (el número sigue siendo un enlace accesible).
 * @param {HTMLElement} contenedor - Elemento que contiene la tabla.
 */
export function conectarFilas(contenedor) {
  for (const fila of contenedor.querySelectorAll('tbody tr[data-id]')) {
    fila.addEventListener('click', (evento) => {
      if (evento.target.closest('a')) return; // el enlace ya navega solo
      navegar(rutaDetalle(fila.dataset.id));
    });
  }
}
