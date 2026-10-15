/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/loginPantalla.js
 *
 * Responsabilidad:
 *   Dibujar el formulario de inicio de sesión y mostrar los errores.
 *   No valida reglas de negocio ni habla con Firebase: delega todo en
 *   authServicio. Cuando el login sale bien, el observador de sesión de
 *   src/main.js se encarga de navegar al inicio.
 *
 * Depende de: src/services/authServicio.js
 * =============================================================
 */

import { iniciarSesion } from '../../services/authServicio.js';

/**
 * Dibuja la pantalla de login dentro del contenedor.
 * @param {HTMLElement} contenedor
 */
export function renderizarLogin(contenedor) {
  contenedor.className = 'app app--publica';
  contenedor.innerHTML = `
    <section class="tarjeta tarjeta--login">
      <h1 class="titulo">Permisos</h1>
      <p class="subtitulo">Ingresá con tu usuario de la empresa</p>

      <form id="formLogin" class="formulario" novalidate>
        <label class="campo">
          <span>Email</span>
          <input type="email" name="email" autocomplete="username" required />
        </label>
        <label class="campo">
          <span>Contraseña</span>
          <input type="password" name="password" autocomplete="current-password" required />
        </label>

        <p id="errorLogin" class="mensaje-error" role="alert" hidden></p>

        <button type="submit" class="boton boton--primario">Ingresar</button>
      </form>
    </section>
  `;

  const formulario = contenedor.querySelector('#formLogin');
  const mensajeError = contenedor.querySelector('#errorLogin');
  const boton = formulario.querySelector('button[type="submit"]');

  // Al volver a escribir se oculta el error anterior (BUGS.md · BUG-005).
  formulario.addEventListener('input', () => { mensajeError.hidden = true; });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault(); // evita que el navegador recargue la página al enviar
    const datos = new FormData(formulario);

    mensajeError.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Ingresando…';

    try {
      await iniciarSesion(String(datos.get('email')), String(datos.get('password')));
      // No se navega desde acá: observarSesion (src/main.js) detecta el login y redirige.
    } catch (error) {
      // textContent (no innerHTML) para que el mensaje nunca se interprete como HTML.
      mensajeError.textContent = error.message;
      mensajeError.hidden = false;
      boton.disabled = false;
      boton.textContent = 'Ingresar';
    }
  });
}
