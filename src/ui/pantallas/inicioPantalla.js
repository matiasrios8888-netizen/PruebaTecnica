/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/inicioPantalla.js
 *
 * Responsabilidad:
 *   Pantalla de inicio provisoria (Fase 2): saludo, acceso a "Nueva solicitud"
 *   para el iniciador y dos listas simples:
 *   - "Mis tareas pendientes": solicitudes asignadas al usuario (con marca "Nueva").
 *   - "Mis solicitudes": las que creó o en las que intervino.
 *   En la Fase 3 se reemplaza por la bandeja con pestañas, filtros, orden y búsqueda.
 *
 * Depende de: src/services/solicitudesServicio.js, src/ui/componentes/marco.js,
 *   src/ui/router.js, src/ui/utils/*, src/config/constantes.js
 * =============================================================
 */

import { listarInicio } from '../../services/solicitudesServicio.js';
import { ROLES } from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { navegar, rutaDetalle, RUTA_NUEVA_SOLICITUD } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import {
  claseEstado,
  formatearFechaCalendario,
  formatearFechaHora,
  nombreEstado,
  nombreRol,
  nombreTipo,
} from '../utils/formato.js';

/**
 * Dibuja la pantalla de inicio.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario - Usuario logueado.
 */
export async function renderizarInicio(contenedor, usuario) {
  const principal = dibujarMarco(contenedor, usuario);
  const botonNueva =
    usuario.rol === ROLES.INICIADOR
      ? `<a href="${RUTA_NUEVA_SOLICITUD}" class="boton boton--primario">Nueva solicitud</a>`
      : '';

  // 🔒 SEGURIDAD: los datos que vienen de Firestore se escapan antes de insertarlos.
  principal.innerHTML = `
    <section class="tarjeta tarjeta--ancha">
      <div class="cabecera-seccion">
        <div>
          <h1 class="titulo">Hola, ${escaparHtml(usuario.nombre)}</h1>
          <p class="subtitulo">${escaparHtml(nombreRol(usuario.rol))} · ${escaparHtml(usuario.area)}</p>
        </div>
        ${botonNueva}
      </div>
    </section>
    <section class="tarjeta tarjeta--ancha" id="seccionTareas">
      <h2 class="titulo--seccion">Mis tareas pendientes</h2>
      <p class="vacio">Cargando…</p>
    </section>
    <section class="tarjeta tarjeta--ancha" id="seccionSolicitudes">
      <h2 class="titulo--seccion">Mis solicitudes</h2>
      <p class="vacio">Cargando…</p>
    </section>
  `;

  try {
    const { tareas, solicitudes } = await listarInicio();
    llenarSeccion(principal.querySelector('#seccionTareas'), 'Mis tareas pendientes', tareas, usuario,
      'No tenés tareas pendientes.');
    llenarSeccion(principal.querySelector('#seccionSolicitudes'), 'Mis solicitudes', solicitudes, usuario,
      'Todavía no participaste de ninguna solicitud.');
  } catch (error) {
    principal.querySelector('#seccionTareas').innerHTML =
      `<p class="mensaje-error">${escaparHtml(error.message)}</p>`;
    principal.querySelector('#seccionSolicitudes').remove();
  }
}

/**
 * Dibuja una tabla de solicitudes; cada fila abre el detalle.
 * @param {HTMLElement} seccion
 * @param {string} titulo
 * @param {import('../../data/modelos.js').Solicitud[]} lista
 * @param {import('../../data/modelos.js').Usuario} usuario
 * @param {string} textoVacio
 */
function llenarSeccion(seccion, titulo, lista, usuario, textoVacio) {
  if (lista.length === 0) {
    seccion.innerHTML = `<h2 class="titulo--seccion">${titulo}</h2><p class="vacio">${textoVacio}</p>`;
    return;
  }

  const filas = lista
    .map((s) => {
      // "Nueva" = me la asignaron y todavía no la abrí (vistaPorAsignado = false).
      const nueva = s.asignadoA === usuario.id && !s.vistaPorAsignado ? ' <span class="etiqueta etiqueta--nueva">Nueva</span>' : '';
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

  seccion.innerHTML = `
    <h2 class="titulo--seccion">${titulo} <small class="ayuda">(${lista.length})</small></h2>
    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr><th>Número</th><th>Tipo</th><th>Solicitante</th><th>Fechas</th><th>Estado</th><th>Asignado a</th><th>Actualizada</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;

  // Comodidad: toda la fila es clickeable (el número sigue siendo un enlace accesible).
  for (const fila of seccion.querySelectorAll('tbody tr')) {
    fila.addEventListener('click', (evento) => {
      if (evento.target.closest('a')) return;
      navegar(rutaDetalle(fila.dataset.id));
    });
  }
}
