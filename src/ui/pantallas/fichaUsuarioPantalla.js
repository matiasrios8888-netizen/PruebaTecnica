/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/fichaUsuarioPantalla.js
 *
 * Responsabilidad:
 *   Ficha de un usuario para el admin:
 *   - editar nombre, rol, área y supervisor (el email no se edita);
 *   - dar de baja o reactivar, mostrando por qué una baja está bloqueada;
 *   - enviar el mail para cambiar la contraseña;
 *   - ver sus trámites abiertos y, si es supervisor, sus colaboradores.
 *   Avisa antes de guardar si un cambio de rol está bloqueado; la decisión
 *   final la toma usuariosServicio con datos frescos.
 *
 * Depende de: src/services/usuariosServicio.js, src/config/constantes.js,
 *   src/ui/componentes/marco.js, src/ui/componentes/formularioUsuario.js,
 *   src/ui/router.js, src/ui/utils/*
 * =============================================================
 */

import {
  actualizarUsuario,
  darDeBaja,
  enviarCambioDeContrasena,
  obtenerFichaUsuario,
  reactivar,
} from '../../services/usuariosServicio.js';
import { dibujarMarco } from '../componentes/marco.js';
import { htmlCamposUsuario, conectarCampoSupervisor, leerCamposUsuario } from '../componentes/formularioUsuario.js';
import { rutaDetalle, rutaFichaUsuario, RUTA_USUARIOS } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import { claseEstado, nombreEstado, nombreRol, nombreTipo } from '../utils/formato.js';
import { ejecutarConEstado } from '../utils/operaciones.js';
import { mostrarAviso } from '../utils/avisos.js';

/** @typedef {import('../../services/usuariosServicio.js').FichaUsuario} FichaUsuario */

/**
 * Dibuja la ficha de un usuario.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} admin - El admin logueado.
 * @param {{ id: string }} parametros - uid del usuario (de la URL).
 */
export async function renderizarFichaUsuario(contenedor, admin, { id }) {
  const principal = dibujarMarco(contenedor, admin);
  principal.innerHTML = '<p class="vacio">Cargando usuario…</p>';

  /** @type {FichaUsuario} */
  let ficha;
  try {
    ficha = await obtenerFichaUsuario(id);
  } catch (error) {
    if (!principal.isConnected) return; // la pantalla ya fue reemplazada (BUGS.md · BUG-004)
    principal.innerHTML = `
      <section class="tarjeta tarjeta--ancha">
        <h1 class="titulo">No se pudo abrir el usuario</h1>
        <p class="mensaje-error">${escaparHtml(error.message)}</p>
        <p><a href="${RUTA_USUARIOS}">Volver a Usuarios</a></p>
      </section>`;
    return;
  }
  if (!principal.isConnected) return;

  const { usuario } = ficha;
  principal.innerHTML = `
    ${htmlEncabezado(usuario)}
    <div class="detalle-grilla">
      <div class="columna">
        ${htmlDatos(ficha)}
        ${htmlTramites(ficha)}
      </div>
      <div class="columna">
        ${htmlEstado(ficha)}
        ${htmlContrasena(usuario)}
      </div>
    </div>
  `;

  conectarDatos(principal, ficha);
  conectarEstado(principal, usuario);
  conectarContrasena(principal, usuario);
}

// -------------------------------------------------------------
// HTML de cada sección (todo dato de Firestore pasa por escaparHtml)
// -------------------------------------------------------------

function htmlEncabezado(usuario) {
  const estado = usuario.activo
    ? '<span class="etiqueta etiqueta--ok">Activo</span>'
    : '<span class="etiqueta etiqueta--neutra">Dado de baja</span>';
  return `
    <section class="tarjeta tarjeta--ancha">
      <p class="ayuda"><a href="${RUTA_USUARIOS}">← Usuarios</a></p>
      <div class="cabecera-seccion">
        <div>
          <h1 class="titulo">${escaparHtml(usuario.nombre)}</h1>
          <p class="subtitulo">${escaparHtml(usuario.email)} · ${escaparHtml(nombreRol(usuario.rol))} · ${escaparHtml(usuario.area)}</p>
        </div>
        ${estado}
      </div>
    </section>`;
}

function htmlDatos({ usuario, supervisores }) {
  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Datos</h2>
      <form id="formFicha" class="formulario" novalidate>
        ${htmlCamposUsuario({ valores: usuario, supervisores, emailEditable: false })}
        <div id="avisoRol" class="mensaje-alerta" role="status" hidden></div>
        <p id="errorFicha" class="mensaje-error" role="alert" hidden></p>
        <div class="acciones">
          <button type="submit" class="boton boton--primario">Guardar cambios</button>
        </div>
      </form>
    </section>`;
}

/** Lista de motivos como <ul>. */
const htmlMotivos = (motivos) => `<ul class="lista-motivos">${motivos.map((m) => `<li>${escaparHtml(m)}</li>`).join('')}</ul>`;

function htmlEstado({ usuario, motivosBaja }) {
  let contenido;
  if (!usuario.activo) {
    contenido = `
      <p class="ayuda">No puede iniciar sesión ni operar. Su historial y sus trámites se conservan.</p>
      <button type="button" class="boton boton--primario" id="botonReactivar">Reactivar</button>`;
  } else if (motivosBaja.length > 0) {
    contenido = `
      <p class="mensaje-alerta">No se puede dar de baja por ahora:</p>
      ${htmlMotivos(motivosBaja)}
      <button type="button" class="boton boton--peligro" disabled>Dar de baja</button>`;
  } else {
    contenido = `
      <p class="ayuda">La baja es lógica: no podrá iniciar sesión, pero su historial se conserva y se puede reactivar.</p>
      <button type="button" class="boton boton--peligro" id="botonBaja">Dar de baja</button>`;
  }
  return `
    <section class="tarjeta tarjeta--ancha panel-acciones">
      <h2 class="titulo--seccion">Estado</h2>
      ${contenido}
      <p id="errorEstado" class="mensaje-error" role="alert" hidden></p>
    </section>`;
}

function htmlContrasena(usuario) {
  return `
    <section class="tarjeta tarjeta--ancha panel-acciones">
      <h2 class="titulo--seccion">Contraseña</h2>
      <p class="ayuda">Firebase le envía a ${escaparHtml(usuario.email)} un enlace para elegir una contraseña nueva. Nadie más la conoce.</p>
      <button type="button" class="boton" id="botonContrasena" ${usuario.activo ? '' : 'disabled'}>Enviar mail para cambiar la contraseña</button>
      <p id="errorContrasena" class="mensaje-error" role="alert" hidden></p>
    </section>`;
}

function htmlTramites({ tramitesAbiertos, colaboradores }) {
  const tramites = tramitesAbiertos.length
    ? `<ul class="lista-adjuntos">${tramitesAbiertos
        .map(
          (s) => `
          <li>
            <span><a href="${rutaDetalle(s.id)}">${escaparHtml(s.numero)}</a> · ${escaparHtml(nombreTipo(s.tipoPermiso))} · ${escaparHtml(s.solicitanteNombre)}</span>
            <span class="${claseEstado(s.estadoActual)}">${escaparHtml(nombreEstado(s.estadoActual))}</span>
          </li>`,
        )
        .join('')}</ul>`
    : '<p class="vacio">No participa en trámites abiertos.</p>';

  const equipo = colaboradores.length
    ? `
      <h2 class="titulo--seccion">Colaboradores a cargo</h2>
      <ul class="lista-adjuntos">${colaboradores
        .map((c) => `<li><a href="${rutaFichaUsuario(c.id)}">${escaparHtml(c.nombre)}</a><span>${escaparHtml(c.area)}</span></li>`)
        .join('')}</ul>`
    : '';

  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Trámites abiertos</h2>
      ${tramites}
      ${equipo}
    </section>`;
}

// -------------------------------------------------------------
// Comportamiento
// -------------------------------------------------------------

/**
 * Formulario de datos: avisa en vivo si el rol elegido está bloqueado y guarda.
 * @param {HTMLElement} principal
 * @param {FichaUsuario} ficha
 */
function conectarDatos(principal, { usuario, motivosCambioDeRol }) {
  const formulario = principal.querySelector('#formFicha');
  const avisoRol = formulario.querySelector('#avisoRol');
  const mensajeError = formulario.querySelector('#errorFicha');
  const boton = formulario.querySelector('button[type="submit"]');
  conectarCampoSupervisor(formulario);

  // ⚠️ IMPORTANTE: aviso anticipado; el servicio vuelve a decidir con datos frescos al guardar.
  const revisarRol = () => {
    const motivos = motivosCambioDeRol(formulario.elements.rol.value);
    avisoRol.hidden = motivos.length === 0;
    avisoRol.innerHTML = motivos.length ? `<p>No se puede cambiar el rol por ahora:</p>${htmlMotivos(motivos)}` : '';
    boton.disabled = motivos.length > 0;
  };
  formulario.elements.rol.addEventListener('change', revisarRol);

  // Al corregir cualquier campo se oculta el error anterior (BUGS.md · BUG-005).
  formulario.addEventListener('input', () => { mensajeError.hidden = true; });
  formulario.addEventListener('change', () => { mensajeError.hidden = true; });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    ejecutarConEstado(
      boton,
      mensajeError,
      () => actualizarUsuario(usuario.id, leerCamposUsuario(formulario)),
      'Cambios guardados.',
    );
  });
}

/**
 * Botones de baja y reactivación.
 * @param {HTMLElement} principal
 * @param {import('../../data/modelos.js').Usuario} usuario
 */
function conectarEstado(principal, usuario) {
  const mensajeError = principal.querySelector('#errorEstado');
  principal.querySelector('#botonBaja')?.addEventListener('click', (evento) => {
    if (!window.confirm(`¿Dar de baja a ${usuario.nombre}? No va a poder iniciar sesión hasta que se reactive su usuario.`)) return;
    ejecutarConEstado(evento.currentTarget, mensajeError, () => darDeBaja(usuario.id), `Se dio de baja a ${usuario.nombre}.`);
  });
  principal.querySelector('#botonReactivar')?.addEventListener('click', (evento) => {
    ejecutarConEstado(evento.currentTarget, mensajeError, () => reactivar(usuario.id), `Se reactivó a ${usuario.nombre}.`);
  });
}

/**
 * Botón para enviar el mail de cambio de contraseña (no recarga la pantalla).
 * @param {HTMLElement} principal
 * @param {import('../../data/modelos.js').Usuario} usuario
 */
function conectarContrasena(principal, usuario) {
  const boton = principal.querySelector('#botonContrasena');
  const mensajeError = principal.querySelector('#errorContrasena');
  boton.addEventListener('click', async () => {
    mensajeError.hidden = true;
    boton.disabled = true;
    try {
      const email = await enviarCambioDeContrasena(usuario.id);
      mostrarAviso(`Mail enviado a ${email}.`);
    } catch (error) {
      mensajeError.textContent = error.message;
      mensajeError.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });
}
