/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/altaUsuarioPantalla.js
 *
 * Responsabilidad:
 *   Formulario para que el admin dé de alta un usuario: datos del perfil y
 *   contraseña inicial. Al guardar, vuelve al listado.
 *   La validación y el alta (cuenta de acceso + perfil) están en usuariosServicio.
 *
 * Depende de: src/services/usuariosServicio.js, src/config/constantes.js,
 *   src/ui/componentes/marco.js, src/ui/componentes/formularioUsuario.js,
 *   src/ui/router.js, src/ui/utils/*
 * =============================================================
 */

import { crearUsuario, prepararAlta } from '../../services/usuariosServicio.js';
import { LIMITES_USUARIO } from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { htmlCamposUsuario, conectarCampoSupervisor, leerCamposUsuario } from '../componentes/formularioUsuario.js';
import { navegar, RUTA_USUARIOS } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import { mostrarAviso } from '../utils/avisos.js';

/**
 * Dibuja la pantalla de alta de usuario.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario - El admin logueado.
 */
export async function renderizarAltaUsuario(contenedor, usuario) {
  const principal = dibujarMarco(contenedor, usuario);
  principal.innerHTML = `
    <section class="tarjeta tarjeta--ancha">
      <h1 class="titulo">Nuevo usuario</h1>
      <p class="subtitulo">Se crea su cuenta de acceso y su perfil. Tu sesión sigue abierta.</p>
      <div id="contenidoAlta"><p class="ayuda">Cargando…</p></div>
    </section>
  `;

  let supervisores;
  try {
    ({ supervisores } = await prepararAlta());
  } catch (error) {
    if (!principal.isConnected) return; // la pantalla ya fue reemplazada (BUGS.md · BUG-004)
    principal.querySelector('#contenidoAlta').innerHTML = `<p class="mensaje-error">${escaparHtml(error.message)}</p>`;
    return;
  }
  if (!principal.isConnected) return;

  principal.querySelector('#contenidoAlta').innerHTML = `
    <form id="formAlta" class="formulario" novalidate>
      ${htmlCamposUsuario({ supervisores })}
      <label class="campo">
        <span>Contraseña inicial</span>
        <input type="password" name="contrasena" minlength="${LIMITES_USUARIO.largoMinimoContrasena}" required
               autocomplete="new-password" />
        <small class="ayuda">
          Al menos ${LIMITES_USUARIO.largoMinimoContrasena} caracteres. Comunicásela al usuario; si la olvida,
          desde su ficha le podés enviar un mail para elegir otra.
        </small>
      </label>

      <p id="errorFormulario" class="mensaje-error" role="alert" hidden></p>

      <div class="acciones">
        <a href="${RUTA_USUARIOS}" class="boton">Cancelar</a>
        <button type="submit" class="boton boton--primario">Dar de alta</button>
      </div>
    </form>
  `;

  const formulario = principal.querySelector('#formAlta');
  const mensajeError = formulario.querySelector('#errorFormulario');
  const boton = formulario.querySelector('button[type="submit"]');
  conectarCampoSupervisor(formulario);

  // Al corregir cualquier campo se oculta el error anterior (BUGS.md · BUG-005).
  formulario.addEventListener('input', () => { mensajeError.hidden = true; });
  formulario.addEventListener('change', () => { mensajeError.hidden = true; });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mensajeError.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Dando de alta…';
    try {
      const { nombre } = await crearUsuario(leerCamposUsuario(formulario), formulario.elements.contrasena.value);
      mostrarAviso(`${nombre} quedó dado de alta.`);
      navegar(RUTA_USUARIOS);
    } catch (error) {
      if (!principal.isConnected) return;
      mensajeError.textContent = error.message;
      mensajeError.hidden = false;
      boton.disabled = false;
      boton.textContent = 'Dar de alta';
    }
  });
}
