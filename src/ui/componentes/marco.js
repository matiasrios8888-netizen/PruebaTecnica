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
import { RUTA_INICIO, RUTA_NUEVA_SOLICITUD, RUTA_REPORTES, RUTA_ROLES, RUTA_USUARIOS } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import { nombreRol } from '../utils/formato.js';

/**
 * Ícono de la app (un calendario con una tilde), el mismo de favicon.svg.
 * Es decorativo: el texto "Permisos" ya nombra el enlace.
 */
export const ICONO_APP = `
  <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="6" width="24" height="22" rx="4"/>
      <path d="M4 12h24M11 3.5v5M21 3.5v5"/>
    </g>
    <path d="M10.5 19.5l3.5 3.5 7-7.5" fill="none" stroke="#86b6ef" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

/**
 * Dibuja el marco y devuelve el contenedor del contenido.
 * @param {HTMLElement} contenedor - El #app.
 * @param {import('../../data/modelos.js').Usuario} usuario
 * @returns {HTMLElement} El <main> de la pantalla.
 */
export function dibujarMarco(contenedor, usuario) {
  // ⚠️ IMPORTANTE: cada rol ve solo los enlaces de lo que puede hacer: "Nueva solicitud"
  // el iniciador, los reportes RH y admin, y el mantenimiento el admin.
  // (Es comodidad: el router, los servicios y firestore.rules igual lo controlan.)
  const enlacesDelRol = {
    [ROLES.INICIADOR]: [[RUTA_NUEVA_SOLICITUD, 'Nueva solicitud']],
    [ROLES.RH]: [[RUTA_REPORTES, 'Reportes']],
    [ROLES.ADMIN]: [
      [RUTA_REPORTES, 'Reportes'],
      [RUTA_USUARIOS, 'Usuarios'],
      [RUTA_ROLES, 'Roles'],
    ],
  };
  const enlacesExtra = (enlacesDelRol[usuario.rol] ?? [])
    .map(([ruta, texto]) => `<a href="${ruta}" class="nav__enlace">${texto}</a>`)
    .join('');

  contenedor.className = 'app app--privada';
  contenedor.innerHTML = `
    <header class="encabezado">
      <a href="${RUTA_INICIO}" class="encabezado__marca">${ICONO_APP} Permisos</a>
      <nav class="nav" aria-label="Secciones">
        <a href="${RUTA_INICIO}" class="nav__enlace">Bandeja</a>
        ${enlacesExtra}
      </nav>
      <div class="encabezado__usuario">
        <span class="encabezado__persona">
          <span class="encabezado__nombre">${escaparHtml(usuario.nombre)}</span>
          <span class="encabezado__rol">${escaparHtml(nombreRol(usuario.rol))}</span>
        </span>
        <button type="button" class="boton boton--chico boton--sobre-tinta" id="botonSalir">Salir</button>
      </div>
    </header>
    <main class="contenido" id="contenido"></main>
  `;

  // Marca el enlace de la sección actual, incluidas sus subrutas
  // (#/bandeja/nuevas es "Bandeja"; #/usuarios/abc es "Usuarios").
  const hash = window.location.hash || RUTA_INICIO;
  for (const enlace of contenedor.querySelectorAll('.nav__enlace')) {
    const destino = enlace.getAttribute('href');
    if (hash === destino || hash.startsWith(`${destino}/`)) enlace.setAttribute('aria-current', 'page');
  }
  contenedor.querySelector('#botonSalir').addEventListener('click', () => cerrarSesion());
  return contenedor.querySelector('#contenido');
}
