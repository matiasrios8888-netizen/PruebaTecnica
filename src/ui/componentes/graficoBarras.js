/**
 * =============================================================
 * Capa: UI (componente)
 * Archivo: src/ui/componentes/graficoBarras.js
 *
 * Responsabilidad:
 *   Dibujar un gráfico de barras horizontales en HTML y CSS, sin librerías:
 *   una fila por categoría (etiqueta a la izquierda, barra y valor a la derecha).
 *   Cada barra puede tener varios segmentos apilados (por ejemplo, tareas
 *   vistas + nuevas). Cada segmento muestra un tooltip con el mouse o el
 *   teclado (ver utils/tooltip.js).
 *
 *   Pautas de diseño: barras finas (hasta 20 px), extremo redondeado y base
 *   recta, 2 px de separación entre segmentos, el valor escrito al final de
 *   la barra y el texto siempre en color de texto (nunca en el color de la serie).
 *
 * Depende de: src/ui/utils/html.js
 * =============================================================
 */

import { escaparHtml } from '../utils/html.js';

/**
 * Una parte de la barra.
 * @typedef {Object} SegmentoGrafico
 * @property {number} valor
 * @property {string} clase - Clase CSS que da el color (ej: "serie--nuevas").
 * @property {string} tooltipValor - Texto principal del tooltip (ej: "3 trámites").
 * @property {string} tooltipEtiqueta - Texto secundario (ej: "Aprobación · 30%").
 */

/**
 * Una fila del gráfico.
 * @typedef {Object} FilaGrafico
 * @property {string} etiqueta - Nombre de la categoría.
 * @property {string} [detalle] - Texto chico debajo del nombre.
 * @property {SegmentoGrafico[]} segmentos - Se apilan en este orden.
 * @property {string} textoValor - Lo que se escribe al final de la barra.
 */

/**
 * HTML del gráfico.
 * 🔒 SEGURIDAD: todos los textos pasan por escaparHtml (pueden venir de Firestore).
 * @param {Object} opciones
 * @param {FilaGrafico[]} opciones.filas
 * @param {string} opciones.descripcion - Descripción para lectores de pantalla.
 * @returns {string}
 */
export function htmlGraficoBarras({ filas, descripcion }) {
  const totalDe = (fila) => fila.segmentos.reduce((suma, s) => suma + s.valor, 0);
  // La barra más larga ocupa todo el ancho disponible; las demás, en proporción.
  const maximo = Math.max(1, ...filas.map(totalDe));

  const htmlFilas = filas
    .map((fila) => {
      const segmentos = fila.segmentos
        .filter((s) => s.valor > 0)
        .map(
          (s) => `
            <span class="grafico-barras__segmento ${escaparHtml(s.clase)}" style="flex-grow: ${s.valor}"
                  tabindex="0" aria-label="${escaparHtml(`${s.tooltipValor}, ${s.tooltipEtiqueta}`)}"
                  data-tooltip-valor="${escaparHtml(s.tooltipValor)}"
                  data-tooltip-etiqueta="${escaparHtml(s.tooltipEtiqueta)}"></span>`,
        )
        .join('');
      const detalle = fila.detalle ? `<small class="grafico-barras__detalle">${escaparHtml(fila.detalle)}</small>` : '';
      return `
        <li class="grafico-barras__fila">
          <span class="grafico-barras__etiqueta">${escaparHtml(fila.etiqueta)}${detalle}</span>
          <span class="grafico-barras__pista">
            <span class="grafico-barras__barra" style="--proporcion: ${totalDe(fila) / maximo}">${segmentos}</span>
            <span class="grafico-barras__valor">${escaparHtml(fila.textoValor)}</span>
          </span>
        </li>`;
    })
    .join('');

  return `<ul class="grafico-barras" aria-label="${escaparHtml(descripcion)}">${htmlFilas}</ul>`;
}
