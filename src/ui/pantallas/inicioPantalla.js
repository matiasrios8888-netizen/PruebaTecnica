/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/inicioPantalla.js
 *
 * Responsabilidad:
 *   Pantalla provisoria de bienvenida (Fase 1): muestra quién está logueado
 *   y con qué rol, y permite cerrar sesión. En la Fase 3 se reemplaza por
 *   la bandeja de tareas.
 *
 * Depende de: src/services/authServicio.js, src/config/constantes.js,
 *   src/ui/utils/html.js
 * =============================================================
 */

import { cerrarSesion } from '../../services/authServicio.js';
import { NOMBRES_ROL } from '../../config/constantes.js';
import { escaparHtml } from '../utils/html.js';

/**
 * Dibuja la pantalla de inicio.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario - Usuario logueado.
 */
export function renderizarInicio(contenedor, usuario) {
  // 🔒 SEGURIDAD: los datos del perfil vienen de Firestore → se escapan antes de insertarlos.
  contenedor.innerHTML = `
    <section class="tarjeta">
      <h1 class="titulo">Hola, ${escaparHtml(usuario.nombre)}</h1>
      <dl class="datos">
        <dt>Rol</dt><dd>${escaparHtml(NOMBRES_ROL[usuario.rol] ?? usuario.rol)}</dd>
        <dt>Email</dt><dd>${escaparHtml(usuario.email)}</dd>
        <dt>Área</dt><dd>${escaparHtml(usuario.area)}</dd>
      </dl>
      <p class="subtitulo">La bandeja de tareas llega en la Fase 3.</p>
      <button id="botonSalir" class="boton">Cerrar sesión</button>
    </section>
  `;

  contenedor.querySelector('#botonSalir').addEventListener('click', () => cerrarSesion());
}
