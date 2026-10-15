/**
 * =============================================================
 * Capa: UI (utilidad compartida)
 * Archivo: src/ui/utils/tooltip.js
 *
 * Responsabilidad: mostrar un tooltip sobre cualquier elemento que tenga
 *   data-tooltip-valor (y opcionalmente data-tooltip-etiqueta), al pasar el
 *   mouse o al llegar con el teclado (Tab). Lo usan los gráficos de reportes.
 *
 *   El tooltip complementa, nunca reemplaza: todo valor que muestra también
 *   está escrito en el gráfico o en su tabla de datos.
 *
 * Depende de: nada.
 * =============================================================
 */

/** Separación entre el tooltip y el elemento, en píxeles. */
const SEPARACION = 8;

// Un solo listener para toda la app: al hacer scroll se ocultan los tooltips
// (quedarían flotando lejos de su elemento). Se registra una vez, no en cada pantalla.
window.addEventListener(
  'scroll',
  () => document.querySelectorAll('.tooltip').forEach((t) => { t.hidden = true; }),
  { passive: true },
);

/**
 * Activa los tooltips dentro de un contenedor (delegación de eventos: un solo
 * listener sirve para todos los elementos, aunque se redibujen).
 * 🔒 SEGURIDAD: el contenido se inserta con textContent, nunca como HTML.
 * @param {HTMLElement} contenedor
 */
export function conectarTooltips(contenedor) {
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  const valor = document.createElement('strong');
  const etiqueta = document.createElement('span');
  tooltip.append(valor, etiqueta);
  contenedor.append(tooltip);

  const mostrar = (elemento) => {
    valor.textContent = elemento.dataset.tooltipValor;
    etiqueta.textContent = elemento.dataset.tooltipEtiqueta ?? '';
    tooltip.hidden = false;
    // Centrado arriba del elemento, sin salirse de la ventana.
    const caja = elemento.getBoundingClientRect();
    const ancho = tooltip.offsetWidth;
    const izquierda = Math.min(
      Math.max(SEPARACION, caja.left + caja.width / 2 - ancho / 2),
      window.innerWidth - ancho - SEPARACION,
    );
    const arriba = caja.top - tooltip.offsetHeight - SEPARACION;
    tooltip.style.left = `${izquierda}px`;
    tooltip.style.top = `${arriba < SEPARACION ? caja.bottom + SEPARACION : arriba}px`;
  };
  const ocultar = () => { tooltip.hidden = true; };

  const objetivo = (evento) => evento.target.closest?.('[data-tooltip-valor]');
  contenedor.addEventListener('pointerover', (evento) => {
    const elemento = objetivo(evento);
    if (elemento) mostrar(elemento);
  });
  contenedor.addEventListener('pointerout', (evento) => {
    if (objetivo(evento)) ocultar();
  });
  contenedor.addEventListener('focusin', (evento) => {
    const elemento = objetivo(evento);
    if (elemento) mostrar(elemento);
  });
  contenedor.addEventListener('focusout', ocultar);
}
