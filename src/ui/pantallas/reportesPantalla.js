/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/reportesPantalla.js
 *
 * Responsabilidad:
 *   Reportes de gestión para RH y admin (DECISIONES.md #27):
 *   - indicadores generales (total, en curso, finalizados, tareas sin abrir);
 *   - distribución de trámites por etapa (gráfico de barras + tabla de datos);
 *   - carga de tareas pendientes por usuario (barras apiladas vistas/nuevas + tabla).
 *   El botón "Actualizar" vuelve a leer los datos; mientras tanto el reporte
 *   anterior queda a la vista, atenuado (sin saltos ni pantallas vacías).
 *
 * Depende de: src/services/reportesServicio.js, src/config/constantes.js,
 *   src/ui/componentes/marco.js, src/ui/componentes/graficoBarras.js, src/ui/utils/*
 * =============================================================
 */

import { cargarReportes } from '../../services/reportesServicio.js';
import { dibujarMarco } from '../componentes/marco.js';
import { htmlGraficoBarras } from '../componentes/graficoBarras.js';
import { escaparHtml } from '../utils/html.js';
import { formatearMomento, nombreRol } from '../utils/formato.js';
import { conectarTooltips } from '../utils/tooltip.js';

/** "1 trámite" / "3 trámites". */
const cantidadDe = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

/**
 * Dibuja la pantalla de reportes.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario - RH o admin.
 */
export function renderizarReportes(contenedor, usuario) {
  const principal = dibujarMarco(contenedor, usuario);
  principal.innerHTML = `
    <section class="tarjeta tarjeta--ancha tarjeta--titulo">
      <div class="cabecera-seccion">
        <div>
          <h1 class="titulo">Reportes de gestión</h1>
          <p class="subtitulo" id="momentoReporte" aria-live="polite">Cargando…</p>
        </div>
        <button type="button" class="boton" id="botonActualizar">Actualizar</button>
      </div>
    </section>
    <div class="reportes" id="contenidoReportes"></div>
  `;

  const contenido = principal.querySelector('#contenidoReportes');
  const boton = principal.querySelector('#botonActualizar');
  conectarTooltips(principal);

  const actualizar = async () => {
    boton.disabled = true;
    contenido.classList.add('reportes--actualizando'); // el reporte anterior queda atenuado
    try {
      const reportes = await cargarReportes();
      if (!principal.isConnected) return; // la pantalla ya fue reemplazada (BUGS.md · BUG-004)
      dibujarReportes(contenido, reportes);
      principal.querySelector('#momentoReporte').textContent = `Datos al ${formatearMomento(reportes.generadoEn)}`;
    } catch (error) {
      if (!principal.isConnected) return;
      principal.querySelector('#momentoReporte').textContent = '';
      contenido.innerHTML = `<p class="mensaje-error">${escaparHtml(error.message)}</p>`;
    } finally {
      contenido.classList.remove('reportes--actualizando');
      boton.disabled = false;
    }
  };
  boton.addEventListener('click', actualizar);
  actualizar();
}

/**
 * Reemplaza el contenido con los reportes nuevos.
 * @param {HTMLElement} contenido
 * @param {import('../../services/reportesServicio.js').Reportes} reportes
 */
function dibujarReportes(contenido, { distribucion, carga }) {
  contenido.innerHTML = `
    ${htmlIndicadores(distribucion, carga)}
    ${htmlDistribucion(distribucion)}
    ${htmlCarga(carga)}
  `;
}

// -------------------------------------------------------------
// HTML de cada sección
// -------------------------------------------------------------

function htmlIndicador(etiqueta, valor, ayuda) {
  return `
    <div class="tarjeta tarjeta--ancha indicador">
      <span class="indicador__etiqueta">${escaparHtml(etiqueta)}</span>
      <span class="indicador__valor">${valor}</span>
      <small class="ayuda">${escaparHtml(ayuda)}</small>
    </div>`;
}

function htmlIndicadores(distribucion, carga) {
  return `
    <div class="indicadores">
      ${htmlIndicador('Trámites', distribucion.total, 'Todos los registrados')}
      ${htmlIndicador('En curso', distribucion.abiertos, 'Esperando a alguien')}
      ${htmlIndicador('Finalizados', distribucion.total - distribucion.abiertos, 'Completados, rechazados o cancelados')}
      ${htmlIndicador('Sin abrir', carga.totalNuevas, 'Tareas que su responsable todavía no vio')}
    </div>`;
}

/**
 * Detalle por estado debajo de cada etapa: el nombre del estado si hay uno solo
 * ("Devuelta para corrección") o la apertura si hay varios ("Completada 2 · Rechazada 1").
 */
function detalleDeEtapa(etapa) {
  if (etapa.estados.length === 0) return '';
  if (etapa.estados.length === 1) return etapa.estados[0].nombre;
  return etapa.estados.map((e) => `${e.nombre} ${e.cantidad}`).join(' · ');
}

/**
 * Distribución por etapa: barras en el orden del proceso, con una escala de un
 * solo tono (más oscuro = más avanzado en el proceso), y su tabla de datos.
 */
function htmlDistribucion(distribucion) {
  const filas = distribucion.etapas.map((etapa) => ({
    etiqueta: etapa.nombre,
    detalle: detalleDeEtapa(etapa),
    textoValor: `${etapa.cantidad} · ${etapa.porcentaje}%`,
    segmentos: [
      {
        valor: etapa.cantidad,
        clase: `etapa--${etapa.etapa}`,
        tooltipValor: cantidadDe(etapa.cantidad, 'trámite', 'trámites'),
        tooltipEtiqueta: `${etapa.nombre} · ${etapa.porcentaje}% del total`,
      },
    ],
  }));

  const filasTabla = distribucion.etapas
    .map(
      (etapa) => `
        <tr>
          <td>${escaparHtml(etapa.nombre)}</td>
          <td>${escaparHtml(detalleDeEtapa(etapa) || '—')}</td>
          <td class="numero">${etapa.cantidad}</td>
          <td class="numero">${etapa.porcentaje}%</td>
        </tr>`,
    )
    .join('');

  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Distribución de trámites por etapa</h2>
      <p class="ayuda">Cuántos trámites hay en cada etapa del proceso: Solicitud → Aprobación → Gestión RH → Finalizada.</p>
      ${
        distribucion.total === 0
          ? '<p class="vacio">Todavía no hay trámites.</p>'
          : htmlGraficoBarras({ filas, descripcion: 'Cantidad de trámites por etapa' })
      }
      <details class="datos-grafico">
        <summary>Ver los datos en una tabla</summary>
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead><tr><th>Etapa</th><th>Detalle por estado</th><th class="numero">Cantidad</th><th class="numero">%</th></tr></thead>
            <tbody>${filasTabla}</tbody>
            <tfoot><tr><th>Total</th><th></th><th class="numero">${distribucion.total}</th><th class="numero">${distribucion.total ? '100%' : '—'}</th></tr></tfoot>
          </table>
        </div>
      </details>
    </section>`;
}

/** Texto del trámite más antiguo de una bandeja. */
function textoMasAntiguo(fila) {
  if (!fila.masAntiguo) return 'Sin tareas pendientes';
  const { numero, dias } = fila.masAntiguo;
  const hace = dias === 0 ? 'de hoy' : `hace ${cantidadDe(dias, 'día', 'días')}`;
  return `Más antiguo: ${numero} (${hace})`;
}

/**
 * Carga de pendientes por usuario: una barra apilada por persona, con las
 * tareas que ya vio (serie 1) y las nuevas, sin abrir (serie 2). Son dos
 * series, así que lleva leyenda. Ordenada de mayor a menor carga.
 */
function htmlCarga(carga) {
  const filas = carga.filas.map((fila) => {
    const rol = fila.rol ? nombreRol(fila.rol) : 'Usuario inexistente';
    const vistas = fila.pendientes - fila.nuevas;
    return {
      etiqueta: fila.nombre,
      detalle: `${fila.activo ? rol : `${rol} · dado de baja`} · ${textoMasAntiguo(fila)}`,
      textoValor: String(fila.pendientes),
      segmentos: [
        {
          valor: vistas,
          clase: 'serie--vistas',
          tooltipValor: cantidadDe(vistas, 'tarea ya vista', 'tareas ya vistas'),
          tooltipEtiqueta: fila.nombre,
        },
        {
          valor: fila.nuevas,
          clase: 'serie--nuevas',
          tooltipValor: cantidadDe(fila.nuevas, 'tarea nueva', 'tareas nuevas'),
          tooltipEtiqueta: `${fila.nombre} · todavía sin abrir`,
        },
      ],
    };
  });

  // ⚠️ IMPORTANTE: no debería pasar (el mantenimiento bloquea la baja con trámites
  // abiertos, DECISIONES.md #24), pero si pasa tiene que verse.
  const problemas = carga.conProblemas.length
    ? `<p class="mensaje-alerta" role="status">⚠ Hay trámites asignados a usuarios dados de baja o inexistentes:
         ${escaparHtml(carga.conProblemas.map((f) => `${f.nombre} (${f.pendientes})`).join(', '))}.</p>`
    : '';

  const filasTabla = carga.filas
    .map(
      (fila) => `
        <tr>
          <td>${escaparHtml(fila.nombre)}</td>
          <td>${escaparHtml(fila.rol ? nombreRol(fila.rol) : '—')}${fila.activo ? '' : ' (de baja)'}</td>
          <td class="numero">${fila.pendientes}</td>
          <td class="numero">${fila.nuevas}</td>
          <td>${escaparHtml(fila.masAntiguo ? `${fila.masAntiguo.numero} · ${cantidadDe(fila.masAntiguo.dias, 'día', 'días')}` : '—')}</td>
        </tr>`,
    )
    .join('');

  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Carga de tareas pendientes por usuario</h2>
      <p class="ayuda">
        Trámites que esperan una acción de cada persona. También se muestran, con 0, los supervisores
        y RH activos sin tareas.
      </p>
      ${problemas}
      <ul class="leyenda" aria-label="Referencias">
        <li><span class="leyenda__muestra serie--vistas"></span>Ya vistas</li>
        <li><span class="leyenda__muestra serie--nuevas"></span>Nuevas (sin abrir)</li>
      </ul>
      ${
        carga.filas.length === 0
          ? '<p class="vacio">No hay tareas pendientes ni usuarios que puedan recibirlas.</p>'
          : htmlGraficoBarras({ filas, descripcion: 'Tareas pendientes por usuario' })
      }
      <details class="datos-grafico">
        <summary>Ver los datos en una tabla</summary>
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr><th>Usuario</th><th>Rol</th><th class="numero">Pendientes</th><th class="numero">Nuevas</th><th>Más antiguo</th></tr>
            </thead>
            <tbody>${filasTabla}</tbody>
            <tfoot>
              <tr><th>Total</th><th></th><th class="numero">${carga.totalPendientes}</th><th class="numero">${carga.totalNuevas}</th><th></th></tr>
            </tfoot>
          </table>
        </div>
      </details>
    </section>`;
}
