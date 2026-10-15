/**
 * =============================================================
 * Capa: UI (componente)
 * Archivo: src/ui/componentes/marco.js
 *
 * Responsabilidad:
 *   Dibujar el marco común de las pantallas privadas: encabezado con el
 *   nombre de la app, navegación (según el rol), usuario logueado y botón
 *   de cerrar sesión. Devuelve el <main> donde cada pantalla dibuja su contenido.
 *
 * Depende de: src/services/authServicio.js, src/ui/router.js,
 *   src/ui/utils/html.js, src/ui/utils/formato.js, src/config/constantes.js
 * =============================================================
 */

import { cerrarSesion } from '../../services/authServicio.js';
import { ROLES } from '../../config/constantes.js';
import { RUTA_INICIO, RUTA_NUEVA_SOLICITUD } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import { nombreRol } from '../utils/formato.js';

/**
 * Dibuja el marco y devuelve el contenedor del contenido.
 * @param {HTMLElement} contenedor - El #app.
 * @param {import('../../data/modelos.js').Usuario} usuario
 * @returns {HTMLElement} El <main> de la pantalla.
 */
export function dibujarMarco(contenedor, usuario) {
  // ⚠️ IMPORTANTE: el enlace "Nueva solicitud" solo se muestra a quien puede crear.
  // (Es comodidad: el router y firestore.rules igual lo controlan.)
  const enlaceNueva =
    usuario.rol === ROLES.INICIADOR ? `<a href="${RUTA_NUEVA_SOLICITUD}" class="nav__enlace">Nueva solicitud</a>` : '';

  contenedor.className = 'app app--privada';
  contenedor.innerHTML = `
    <header class="encabezado">
      <a href="${RUTA_INICIO}" class="encabezado__marca">Permisos</a>
      <nav class="nav">
        <a href="${RUTA_INICIO}" class="nav__enlace">Inicio</a>
        ${enlaceNueva}
      </nav>
      <div class="encabezado__usuario">
        <span>${escaparHtml(usuario.nombre)} · <small>${escaparHtml(nombreRol(usuario.rol))}</small></span>
        <button type="button" class="boton boton--chico" id="botonSalir">Salir</button>
      </div>
    </header>
    <main class="contenido" id="contenido"></main>
  `;

  // Marca el enlace de la sección actual.
  for (const enlace of contenedor.querySelectorAll('.nav__enlace')) {
    if (enlace.getAttribute('href') === window.location.hash) enlace.setAttribute('aria-current', 'page');
  }
  contenedor.querySelector('#botonSalir').addEventListener('click', () => cerrarSesion());
  return contenedor.querySelector('#contenido');
}
