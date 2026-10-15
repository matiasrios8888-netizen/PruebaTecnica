/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/detalleSolicitudPantalla.js
 *
 * Responsabilidad:
 *   Mostrar un trámite completo y permitir actuar sobre él:
 *   - datos de la solicitud (editables solo si el usuario puede corregirlos);
 *   - etapa actual (barra de progreso) y a quién está asignada;
 *   - un botón por cada acción del flujo que el usuario puede ejecutar;
 *   - notas, adjuntos (ver y agregar) e historial completo (trazabilidad).
 *
 *   ⚠️ IMPORTANTE: la pantalla NO decide qué puede hacer cada rol: muestra lo
 *   que devuelve solicitudesServicio.obtenerDetalle() (acciones,
 *   puedeCorregirDatos, puedeAgregarSeguimiento), que sale de flujoSolicitud.js.
 *
 * Depende de: src/services/solicitudesServicio.js, src/services/archivos.js,
 *   src/config/constantes.js, src/ui/componentes/marco.js, src/ui/router.js,
 *   src/ui/utils/*
 * =============================================================
 */

import {
  obtenerDetalle,
  ejecutarAccion,
  agregarNota,
  agregarAdjunto,
} from '../../services/solicitudesServicio.js';
import { crearUrlDeAdjunto } from '../../services/archivos.js';
import { LARGO_MAXIMO_COMENTARIO, LARGO_MAXIMO_MOTIVO } from '../../services/flujoSolicitud.js';
import {
  ACCIONES,
  CONFIG_TIPOS_PERMISO,
  ETAPAS,
  NOMBRES_ACCION,
  NOMBRES_ACCION_HISTORIAL,
  TRANSICIONES,
} from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { recargarPantalla, RUTA_INICIO } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import { mostrarAviso } from '../utils/avisos.js';
import {
  claseEstado,
  formatearFechaCalendario,
  formatearFechaHora,
  formatearTamano,
  nombreEstado,
  nombreEtapa,
  nombreRol,
  nombreTipo,
} from '../utils/formato.js';

/** Orden de las etapas para la barra de progreso. */
const ORDEN_ETAPAS = [ETAPAS.SOLICITUD, ETAPAS.APROBACION, ETAPAS.GESTION_RH, ETAPAS.FINALIZADA];

/** Acciones que cierran el trámite de forma negativa: se pide confirmación. */
const ACCIONES_A_CONFIRMAR = [ACCIONES.RECHAZAR, ACCIONES.RECHAZAR_RH, ACCIONES.CANCELAR];

/** Estilo del botón de cada acción. */
const CLASE_BOTON = {
  [ACCIONES.APROBAR]: 'boton--primario',
  [ACCIONES.COMPLETAR]: 'boton--primario',
  [ACCIONES.REENVIAR]: 'boton--primario',
  [ACCIONES.RECHAZAR]: 'boton--peligro',
  [ACCIONES.RECHAZAR_RH]: 'boton--peligro',
  [ACCIONES.CANCELAR]: 'boton--peligro',
};

// -------------------------------------------------------------
// Pantalla
// -------------------------------------------------------------

/**
 * Dibuja el detalle de una solicitud.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario
 * @param {{ id: string }} parametros - Id de la solicitud (de la URL).
 */
export async function renderizarDetalleSolicitud(contenedor, usuario, { id }) {
  const principal = dibujarMarco(contenedor, usuario);
  principal.innerHTML = '<p class="vacio">Cargando solicitud…</p>';

  let detalle;
  try {
    detalle = await obtenerDetalle(id);
  } catch (error) {
    if (!principal.isConnected) return; // la pantalla ya fue reemplazada (BUGS.md · BUG-004)
    principal.innerHTML = `
      <section class="tarjeta tarjeta--ancha">
        <h1 class="titulo">No se pudo abrir la solicitud</h1>
        <p class="mensaje-error">${escaparHtml(error.message)}</p>
        <p><a href="${RUTA_INICIO}">Volver al inicio</a></p>
      </section>`;
    return;
  }

  // Si mientras cargaba el usuario navegó o cerró sesión, no se dibuja (BUGS.md · BUG-004).
  if (!principal.isConnected) return;

  const { solicitud, historial, adjuntos, acciones, puedeAgregarSeguimiento, puedeCorregirDatos } = detalle;

  principal.innerHTML = `
    ${htmlEncabezado(solicitud)}
    <div class="detalle-grilla">
      <div class="columna">
        ${htmlDatos(solicitud, puedeCorregirDatos)}
        ${htmlHistorial(historial)}
      </div>
      <div class="columna">
        ${htmlAcciones(solicitud, acciones)}
        ${htmlNotas(puedeAgregarSeguimiento)}
        ${htmlAdjuntos(adjuntos, puedeAgregarSeguimiento)}
      </div>
    </div>
  `;

  conectarAcciones(principal, solicitud, puedeCorregirDatos);
  conectarNotas(principal, solicitud);
  conectarAdjuntos(principal, solicitud, adjuntos);
}

// -------------------------------------------------------------
// HTML de cada sección (todo dato de Firestore pasa por escaparHtml)
// -------------------------------------------------------------

function htmlEncabezado(solicitud) {
  const indiceActual = ORDEN_ETAPAS.indexOf(solicitud.etapaActual);
  const pasos = ORDEN_ETAPAS.map((etapa, i) => {
    const marca = i < indiceActual ? '✔ ' : i === indiceActual ? '● ' : '';
    const clase = i === indiceActual ? 'etapas__paso etapas__paso--actual' : 'etapas__paso';
    return `<li class="${clase}">${marca}${escaparHtml(nombreEtapa(etapa))}</li>`;
  }).join('<li aria-hidden="true" class="etapas__separador">→</li>');

  const esperando = solicitud.asignadoA
    ? `Esperando a <strong>${escaparHtml(solicitud.asignadoNombre)}</strong> (${escaparHtml(nombreRol(solicitud.rolAsignado))})`
    : 'Trámite finalizado';

  return `
    <section class="tarjeta tarjeta--ancha">
      <div class="cabecera-seccion">
        <div>
          <h1 class="titulo">${escaparHtml(solicitud.numero)} · ${escaparHtml(nombreTipo(solicitud.tipoPermiso))}</h1>
          <p class="subtitulo">${esperando}</p>
        </div>
        <span class="${claseEstado(solicitud.estadoActual)}">${escaparHtml(nombreEstado(solicitud.estadoActual))}</span>
      </div>
      <ol aria-label="Etapas del trámite" class="etapas">
        ${pasos}
      </ol>
    </section>`;
}

/**
 * ⚠️ IMPORTANTE (control de campos por rol): los datos del permiso se muestran
 * en campos deshabilitados, salvo para el solicitante cuando le devolvieron la
 * solicitud. En ese caso se habilitan y se guardan al "Reenviar corregida".
 */
function htmlDatos(solicitud, puedeCorregirDatos) {
  const deshabilitado = puedeCorregirDatos ? '' : 'disabled';
  const opcionesTipo = Object.entries(CONFIG_TIPOS_PERMISO)
    .map(
      ([clave, tipo]) =>
        `<option value="${clave}" ${clave === solicitud.tipoPermiso ? 'selected' : ''}>${escaparHtml(tipo.nombre)}</option>`,
    )
    .join('');

  const aviso = puedeCorregirDatos
    ? '<p class="mensaje-alerta">Te devolvieron la solicitud: corregí lo necesario y tocá <strong>Reenviar corregida</strong>.</p>'
    : '';

  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Datos del permiso</h2>
      ${aviso}
      <form id="formDatos" class="formulario" novalidate>
        <label class="campo">
          <span>Tipo de permiso</span>
          <select name="tipoPermiso" ${deshabilitado}>${opcionesTipo}</select>
        </label>
        <div class="fila">
          <label class="campo"><span>Desde</span>
            <input type="date" name="fechaInicio" value="${escaparHtml(solicitud.fechaInicio)}" ${deshabilitado} /></label>
          <label class="campo"><span>Hasta (inclusive)</span>
            <input type="date" name="fechaFin" value="${escaparHtml(solicitud.fechaFin)}" ${deshabilitado} /></label>
        </div>
        <label class="campo">
          <span>Motivo</span>
          <textarea name="motivo" rows="3" maxlength="${LARGO_MAXIMO_MOTIVO}" ${deshabilitado}>${escaparHtml(solicitud.motivo)}</textarea>
        </label>
      </form>
      <dl class="datos">
        <dt>Solicitante</dt><dd>${escaparHtml(solicitud.solicitanteNombre)}</dd>
        <dt>Días</dt><dd>${escaparHtml(solicitud.cantidadDias)} (${formatearFechaCalendario(solicitud.fechaInicio)} al ${formatearFechaCalendario(solicitud.fechaFin)})</dd>
        <dt>Etapa</dt><dd>${escaparHtml(nombreEtapa(solicitud.etapaActual))}</dd>
        <dt>Creada</dt><dd>${formatearFechaHora(solicitud.fechaCreacion)}</dd>
        <dt>Última actualización</dt><dd>${formatearFechaHora(solicitud.fechaActualizacion)}</dd>
      </dl>
    </section>`;
}

function htmlAcciones(solicitud, acciones) {
  if (acciones.length === 0) {
    const texto = solicitud.asignadoA
      ? `No tenés acciones pendientes. La solicitud está en manos de ${escaparHtml(solicitud.asignadoNombre)}.`
      : 'El trámite está finalizado.';
    return `<section class="tarjeta tarjeta--ancha"><h2 class="titulo--seccion">Acciones</h2><p class="vacio">${texto}</p></section>`;
  }

  const comentarioObligatorio = acciones.some((accion) => TRANSICIONES[accion].requiereComentario);
  const botones = acciones
    .map(
      (accion) =>
        `<button type="button" class="boton ${CLASE_BOTON[accion] ?? ''}" data-accion="${accion}">${escaparHtml(NOMBRES_ACCION[accion])}</button>`,
    )
    .join('');

  return `
    <section class="tarjeta tarjeta--ancha panel-acciones">
      <h2 class="titulo--seccion">Acciones</h2>
      <label class="campo">
        <span>Comentario</span>
        <textarea id="comentarioAccion" rows="3" maxlength="${LARGO_MAXIMO_COMENTARIO}"></textarea>
        <small class="ayuda">${comentarioObligatorio ? 'Obligatorio para devolver o rechazar.' : 'Opcional.'} Queda registrado en el historial.</small>
      </label>
      <p id="errorAccion" class="mensaje-error" role="alert" hidden></p>
      <div class="acciones acciones--izquierda">${botones}</div>
    </section>`;
}

function htmlNotas(puedeAgregarSeguimiento) {
  if (!puedeAgregarSeguimiento) return '';
  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Agregar nota</h2>
      <form id="formNota" class="formulario" novalidate>
        <label class="campo"><span class="solo-lectores">Nota</span><textarea name="nota" rows="3" maxlength="${LARGO_MAXIMO_COMENTARIO}"></textarea></label>
        <p id="errorNota" class="mensaje-error" role="alert" hidden></p>
        <div class="acciones"><button type="submit" class="boton">Agregar nota</button></div>
      </form>
    </section>`;
}

function htmlAdjuntos(adjuntos, puedeAgregarSeguimiento) {
  const lista = adjuntos.length
    ? `<ul class="lista-adjuntos">${adjuntos
        .map(
          (a, i) => `
          <li>
            <span>${escaparHtml(a.nombreArchivo)}<br /><small class="ayuda">${formatearTamano(a.tamanoBytes)} · ${escaparHtml(a.subidoPorNombre)}</small></span>
            <button type="button" class="boton boton--chico" data-adjunto="${i}">Abrir</button>
          </li>`,
        )
        .join('')}</ul>`
    : '<p class="vacio">Sin adjuntos.</p>';

  const formulario = puedeAgregarSeguimiento
    ? `<form id="formAdjunto" class="formulario formulario--separado" novalidate>
         <input type="file" name="archivo" aria-label="Archivo a adjuntar" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
         <p id="errorAdjunto" class="mensaje-error" role="alert" hidden></p>
         <div class="acciones"><button type="submit" class="boton">Adjuntar</button></div>
       </form>`
    : '';

  return `<section class="tarjeta tarjeta--ancha"><h2 class="titulo--seccion">Adjuntos</h2>${lista}${formulario}</section>`;
}

/** 📝 TRAZABILIDAD: línea de tiempo con quién hizo qué y cuándo. */
function htmlHistorial(historial) {
  const eventos = historial
    .map((evento) => {
      const transicion = evento.estadoNuevo
        ? `<p class="historial__meta">${escaparHtml(evento.estadoAnterior ? nombreEstado(evento.estadoAnterior) : 'Nueva')} → ${escaparHtml(nombreEstado(evento.estadoNuevo))}</p>`
        : '';
      const comentario = evento.comentario
        ? `<p class="historial__comentario">${escaparHtml(evento.comentario)}</p>`
        : '';
      return `
        <li class="historial__evento">
          <p class="historial__encabezado">${escaparHtml(evento.usuarioNombre)} · ${escaparHtml(NOMBRES_ACCION_HISTORIAL[evento.accion] ?? evento.accion)}</p>
          <p class="historial__meta">${formatearFechaHora(evento.fecha)} · ${escaparHtml(nombreRol(evento.rolUsuario))}</p>
          ${transicion}
          ${comentario}
        </li>`;
    })
    .join('');
  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Historial</h2>
      <ol class="historial">${eventos}</ol>
    </section>`;
}

// -------------------------------------------------------------
// Comportamiento
// -------------------------------------------------------------

/**
 * Deshabilita un botón mientras corre una operación y muestra el error si falla.
 * @param {HTMLButtonElement} boton
 * @param {HTMLElement} mensajeError
 * @param {() => Promise<void>} operacion
 * @param {string} textoExito - Aviso que se muestra si sale bien (después se recarga la pantalla).
 */
async function ejecutarConEstado(boton, mensajeError, operacion, textoExito) {
  mensajeError.hidden = true;
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await operacion();
    mostrarAviso(textoExito);
    recargarPantalla();
  } catch (error) {
    mensajeError.textContent = error.message;
    mensajeError.hidden = false;
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

/**
 * Oculta un mensaje de error en cuanto el usuario vuelve a editar (BUGS.md · BUG-005).
 * @param {(HTMLElement|null)[]} elementos - Campos o formularios a observar.
 * @param {HTMLElement|null} mensajeError
 */
function ocultarErrorAlEditar(elementos, mensajeError) {
  if (!mensajeError) return;
  for (const elemento of elementos.filter(Boolean)) {
    elemento.addEventListener('input', () => { mensajeError.hidden = true; });
    elemento.addEventListener('change', () => { mensajeError.hidden = true; });
  }
}

function conectarAcciones(principal, solicitud, puedeCorregirDatos) {
  const mensajeError = principal.querySelector('#errorAccion');
  // El error de una acción puede venir del comentario o de los datos corregidos (al reenviar).
  ocultarErrorAlEditar([principal.querySelector('#comentarioAccion'), principal.querySelector('#formDatos')], mensajeError);
  for (const boton of principal.querySelectorAll('[data-accion]')) {
    boton.addEventListener('click', () => {
      const accion = boton.dataset.accion;
      if (ACCIONES_A_CONFIRMAR.includes(accion) && !window.confirm(`¿Seguro que querés "${NOMBRES_ACCION[accion]}"? No se puede deshacer.`)) {
        return;
      }
      const comentario = principal.querySelector('#comentarioAccion').value;
      // Al reenviar se mandan los datos del formulario (corregidos o no).
      const datosCorregidos =
        accion === ACCIONES.REENVIAR && puedeCorregirDatos ? leerFormularioDatos(principal) : undefined;
      ejecutarConEstado(
        boton,
        mensajeError,
        () => ejecutarAccion(solicitud.id, accion, { comentario, datosCorregidos }),
        `${solicitud.numero}: ${NOMBRES_ACCION[accion]} ✔`,
      );
    });
  }
}

function leerFormularioDatos(principal) {
  const campos = principal.querySelector('#formDatos').elements;
  return {
    tipoPermiso: campos.tipoPermiso.value,
    fechaInicio: campos.fechaInicio.value,
    fechaFin: campos.fechaFin.value,
    motivo: campos.motivo.value,
  };
}

function conectarNotas(principal, solicitud) {
  const formulario = principal.querySelector('#formNota');
  if (!formulario) return;
  ocultarErrorAlEditar([formulario], principal.querySelector('#errorNota'));
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    ejecutarConEstado(
      formulario.querySelector('button'),
      principal.querySelector('#errorNota'),
      () => agregarNota(solicitud.id, formulario.elements.nota.value),
      'Nota agregada',
    );
  });
}

function conectarAdjuntos(principal, solicitud, adjuntos) {
  for (const boton of principal.querySelectorAll('[data-adjunto]')) {
    boton.addEventListener('click', () => {
      const url = crearUrlDeAdjunto(adjuntos[Number(boton.dataset.adjunto)]);
      window.open(url, '_blank', 'noopener');
      // La URL temporal ocupa memoria: se libera después de que la pestaña la cargó.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  const formulario = principal.querySelector('#formAdjunto');
  if (!formulario) return;
  const mensajeError = principal.querySelector('#errorAdjunto');
  ocultarErrorAlEditar([formulario], mensajeError);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const [archivo] = formulario.elements.archivo.files;
    if (!archivo) {
      mensajeError.textContent = 'Elegí un archivo.';
      mensajeError.hidden = false;
      return;
    }
    ejecutarConEstado(
      formulario.querySelector('button'),
      mensajeError,
      () => agregarAdjunto(solicitud.id, archivo),
      `Archivo "${archivo.name}" adjuntado`,
    );
  });
}
