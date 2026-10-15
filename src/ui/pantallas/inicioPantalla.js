/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/inicioPantalla.js
 *
 * Responsabilidad:
 *   Pantalla de inicio provisoria: saludo y, para el iniciador, acceso a
 *   crear una solicitud. En la Fase 3 se reemplaza por la bandeja de tareas.
 *
 * Depende de: src/ui/componentes/marco.js, src/ui/router.js, src/ui/utils/*,
 *   src/config/constantes.js
 * =============================================================
 */

import { ROLES } from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { RUTA_NUEVA_SOLICITUD } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import { nombreRol } from '../utils/formato.js';

/**
 * Dibuja la pantalla de inicio.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario - Usuario logueado.
 */
export function renderizarInicio(contenedor, usuario) {
  const principal = dibujarMarco(contenedor, usuario);
  const botonNueva =
    usuario.rol === ROLES.INICIADOR
      ? `<a href="${RUTA_NUEVA_SOLICITUD}" class="boton boton--primario">Nueva solicitud</a>`
      : '';

  // 🔒 SEGURIDAD: los datos del perfil vienen de Firestore → se escapan antes de insertarlos.
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
  `;
}
