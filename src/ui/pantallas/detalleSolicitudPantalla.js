/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/detalleSolicitudPantalla.js
 *
 * Responsabilidad:
 *   Mostrar un trámite completo y permitir actuar sobre él:
 *   - datos de la solicitud y de gestión RH, editables u ocultos según la matriz
 *     de control de campos por rol (MATRIZ_CAMPOS);
 *   - etapa actual (barra de progreso) y a quién está asignada;
 *   - un botón por cada acción del flujo que el usuario puede ejecutar;
 *   - notas, adjuntos (ver y agregar) e historial completo (trazabilidad).
 *
 *   ⚠️ IMPORTANTE: la pantalla NO decide qué puede hacer cada rol: muestra lo
 *   que devuelve solicitudesServicio.obtenerDetalle() (acciones, campos,
 *   puedeAgregarSeguimiento), que sale de flujoSolicitud.js.
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
import {
  LARGO_MAXIMO_COMENTARIO,
  LARGO_MAXIMO_MOTIVO,
  LARGO_MAXIMO_REFERENCIA_RH,
} from '../../services/flujoSolicitud.js';
import {
  ACCESO_CAMPO,
  ACCIONES,
  CAMPOS,
  CONFIG_TIPOS_PERMISO,
  MATRIZ_CAMPOS,
  ETAPAS,
  NOMBRES_ACCION,
  NOMBRES_ACCION_HISTORIAL,
  TRANSICIONES,
} from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { ponerTitulo, RUTA_INICIO } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import { ejecutarConEstado } from '../utils/operaciones.js';
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

  const { solicitud, historial, adjuntos, acciones, puedeAgregarSeguimiento, campos } = detalle;
  ponerTitulo(solicitud.numero);

  principal.innerHTML = `
    ${htmlEncabezado(solicitud)}
    <div class="detalle-grilla">
      <div class="columna">
        ${htmlDatos(solicitud, campos)}
        ${htmlGestionRh(solicitud, campos)}
        ${htmlHistorial(historial)}
      </div>
      <div class="columna">
        ${htmlAcciones(solicitud, acciones)}
        ${htmlNotas(puedeAgregarSeguimiento)}
        ${htmlAdjuntos(adjuntos, puedeAgregarSeguimiento)}
      </div>
    </div>
  `;

  conectarAcciones(principal, solicitud, campos);
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

/** Atributo "disabled" si el campo no es editable para este usuario (según MATRIZ_CAMPOS). */
const atributoEdicion = (campos, campo) => (campos[campo] === ACCESO_CAMPO.EDITABLE ? '' : 'disabled');

/**
 * ⚠️ IMPORTANTE (control de campos por rol): cada campo se habilita o no según
 * "campos" (MATRIZ_CAMPOS aplicada al usuario por el servicio). Hoy los datos
 * del permiso solo son editables para el solicitante cuando le devolvieron la
 * solicitud, y se guardan al "Reenviar corregida".
 */
function htmlDatos(solicitud, campos) {
  const opcionesTipo = Object.entries(CONFIG_TIPOS_PERMISO)
    .map(
      ([clave, tipo]) =>
        `<option value="${clave}" ${clave === solicitud.tipoPermiso ? 'selected' : ''}>${escaparHtml(tipo.nombre)}</option>`,
    )
    .join('');

  const algunoEditable = [CAMPOS.TIPO_PERMISO, CAMPOS.FECHA_INICIO, CAMPOS.FECHA_FIN, CAMPOS.MOTIVO].some(
    (campo) => campos[campo] === ACCESO_CAMPO.EDITABLE,
  );
  const aviso = algunoEditable
    ? '<p class="mensaje-alerta">Te devolvieron la solicitud: corregí lo necesario y tocá <strong>Reenviar corregida</strong>.</p>'
    : '';

  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Datos del permiso</h2>
      ${aviso}
      <form id="formDatos" class="formulario" novalidate>
        <label class="campo">
          <span>${escaparHtml(MATRIZ_CAMPOS[CAMPOS.TIPO_PERMISO].etiqueta)}</span>
          <select name="tipoPermiso" ${atributoEdicion(campos, CAMPOS.TIPO_PERMISO)}>${opcionesTipo}</select>
        </label>
        <div class="fila">
          <label class="campo"><span>${escaparHtml(MATRIZ_CAMPOS[CAMPOS.FECHA_INICIO].etiqueta)}</span>
            <input type="date" name="fechaInicio" value="${escaparHtml(solicitud.fechaInicio)}" ${atributoEdicion(campos, CAMPOS.FECHA_INICIO)} /></label>
          <label class="campo"><span>${escaparHtml(MATRIZ_CAMPOS[CAMPOS.FECHA_FIN].etiqueta)}</span>
            <input type="date" name="fechaFin" value="${escaparHtml(solicitud.fechaFin)}" ${atributoEdicion(campos, CAMPOS.FECHA_FIN)} /></label>
        </div>
        <label class="campo">
          <span>${escaparHtml(MATRIZ_CAMPOS[CAMPOS.MOTIVO].etiqueta)}</span>
          <textarea name="motivo" rows="3" maxlength="${LARGO_MAXIMO_MOTIVO}" ${atributoEdicion(campos, CAMPOS.MOTIVO)}>${escaparHtml(solicitud.motivo)}</textarea>
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

/**
 * ⚠️ IMPORTANTE (control de campos por rol): sección de gestión RH.
 *   - Oculta si el usuario no puede ver ninguno de sus campos (ej: la solicitante
 *     mientras RH la gestiona).
 *   - Editable para el RH asignado mientras está en gestión RH; se guarda al
 *     "Completar gestión" (la referencia es obligatoria).
 *   - Solo lectura para RH y admin, y para todos una vez completada.
 */
function htmlGestionRh(solicitud, campos) {
  const camposRh = [CAMPOS.REFERENCIA_RH, CAMPOS.DIAS_DESCONTADOS];
  if (camposRh.every((campo) => campos[campo] === ACCESO_CAMPO.OCULTO)) return '';

  const editable = camposRh.some((campo) => campos[campo] === ACCESO_CAMPO.EDITABLE);
  const ayuda = editable
    ? '<p class="ayuda">Completá estos datos antes de tocar <strong>Completar gestión</strong>. La referencia es obligatoria.</p>'
    : '';
  const valor = (campo) => solicitud[campo] ?? '';

  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Gestión RH</h2>
      ${ayuda}
      <form id="formGestionRh" class="formulario" novalidate>
        <div class="fila">
          <label class="campo"><span>${escaparHtml(MATRIZ_CAMPOS[CAMPOS.REFERENCIA_RH].etiqueta)}</span>
            <input type="text" name="referenciaRh" maxlength="${LARGO_MAXIMO_REFERENCIA_RH}" placeholder="${editable ? 'Ej: LIQ-2026-0042' : '—'}"
              value="${escaparHtml(valor(CAMPOS.REFERENCIA_RH))}" ${atributoEdicion(campos, CAMPOS.REFERENCIA_RH)} /></label>
          <label class="campo"><span>${escaparHtml(MATRIZ_CAMPOS[CAMPOS.DIAS_DESCONTADOS].etiqueta)}</span>
            <input type="number" name="diasDescontados" min="0" max="${escaparHtml(solicitud.cantidadDias)}" step="1" placeholder="${editable ? `0 a ${escaparHtml(solicitud.cantidadDias)}` : '—'}"
              value="${escaparHtml(valor(CAMPOS.DIAS_DESCONTADOS))}" ${atributoEdicion(campos, CAMPOS.DIAS_DESCONTADOS)} /></label>
        </div>
      </form>
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

function conectarAcciones(principal, solicitud, campos) {
  const mensajeError = principal.querySelector('#errorAccion');
  // El error de una acción puede venir del comentario, de los datos corregidos (al
  // reenviar) o de los datos de gestión RH (al completar).
  ocultarErrorAlEditar(
    [principal.querySelector('#comentarioAccion'), principal.querySelector('#formDatos'), principal.querySelector('#formGestionRh')],
    mensajeError,
  );
  for (const boton of principal.querySelectorAll('[data-accion]')) {
    boton.addEventListener('click', () => {
      const accion = boton.dataset.accion;
      if (ACCIONES_A_CONFIRMAR.includes(accion) && !window.confirm(`¿Seguro que querés "${NOMBRES_ACCION[accion]}"? No se puede deshacer.`)) {
        return;
      }
      const comentario = principal.querySelector('#comentarioAccion').value;
      // Cada acción lleva los campos que la matriz le asigna (MATRIZ_CAMPOS → edicion.accion).
      const datosCorregidos =
        accion === ACCIONES.REENVIAR && campos[CAMPOS.TIPO_PERMISO] === ACCESO_CAMPO.EDITABLE
          ? leerFormularioDatos(principal)
          : undefined;
      const datosGestionRh =
        accion === ACCIONES.COMPLETAR && campos[CAMPOS.REFERENCIA_RH] === ACCESO_CAMPO.EDITABLE
          ? leerFormularioGestionRh(principal)
          : undefined;
      ejecutarConEstado(
        boton,
        mensajeError,
        () => ejecutarAccion(solicitud.id, accion, { comentario, datosCorregidos, datosGestionRh }),
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

function leerFormularioGestionRh(principal) {
  const campos = principal.querySelector('#formGestionRh').elements;
  return { referenciaRh: campos.referenciaRh.value, diasDescontados: campos.diasDescontados.value };
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
