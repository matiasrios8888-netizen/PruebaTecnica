/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/loginPantalla.js
 *
 * Responsabilidad:
 *   Pantalla de inicio de sesión:
 *   - a la izquierda, qué hace la app: el recorrido de un trámite
 *     (Solicitar → Aprobar → Gestionar RH);
 *   - a la derecha, el formulario y, en la demo, un botón por rol para
 *     entrar con las cuentas de demostración.
 *   No valida reglas de negocio ni habla con Firebase: delega todo en
 *   authServicio. Cuando el login sale bien, el observador de sesión de
 *   src/main.js se encarga de navegar al inicio.
 *
 * Depende de: src/services/authServicio.js, src/config/constantes.js,
 *   src/ui/componentes/marco.js (ícono), src/ui/utils/*
 * =============================================================
 */

import { iniciarSesion } from '../../services/authServicio.js';
import { CONTRASENA_DEMO, CUENTAS_DEMO, MOSTRAR_CUENTAS_DEMO } from '../../config/constantes.js';
import { ICONO_APP } from '../componentes/marco.js';
import { escaparHtml } from '../utils/html.js';
import { nombreRol } from '../utils/formato.js';

/** El recorrido de un trámite, contado desde el lado de quien lo usa. */
const PASOS_DEL_TRAMITE = [
  ['Pedís el permiso', 'Elegís el tipo, las fechas y adjuntás la documentación que haga falta.'],
  ['Tu supervisor lo revisa', 'Lo aprueba, lo rechaza o te lo devuelve con un comentario para corregir.'],
  ['Recursos Humanos lo gestiona', 'Carga la liquidación y el trámite queda cerrado, con todo su historial.'],
];

/**
 * Dibuja la pantalla de login dentro del contenedor.
 * @param {HTMLElement} contenedor
 */
export function renderizarLogin(contenedor) {
  const pasos = PASOS_DEL_TRAMITE.map(
    ([titulo, texto], i) => `
      <li class="recorrido__paso">
        <span class="recorrido__marca" aria-hidden="true">${i + 1}</span>
        <span class="recorrido__texto"><strong>${titulo}</strong><br />${texto}</span>
      </li>`,
  ).join('');

  const cuentasDemo = MOSTRAR_CUENTAS_DEMO
    ? `
      <section class="cuentas-demo" aria-labelledby="tituloDemo">
        <h2 class="cuentas-demo__titulo" id="tituloDemo">Cuentas de demostración</h2>
        <p class="ayuda">Entrá con un rol para recorrer la app. Todas usan la contraseña <code>${escaparHtml(CONTRASENA_DEMO)}</code>.</p>
        <div class="cuentas-demo__lista">
          ${CUENTAS_DEMO.map(
            (cuenta) => `
              <button type="button" class="boton cuentas-demo__boton" data-email="${escaparHtml(cuenta.email)}">
                <span>Entrar como ${escaparHtml(cuenta.nombre)}</span>
                <small>${escaparHtml(nombreRol(cuenta.rol))}</small>
              </button>`,
          ).join('')}
        </div>
      </section>`
    : '';

  contenedor.className = 'app app--publica';
  contenedor.innerHTML = `
    <main class="login">
      <section class="login__presentacion" aria-labelledby="tituloApp">
        <h1 class="login__titulo" id="tituloApp">${ICONO_APP} Permisos</h1>
        <p class="login__bajada">Los pedidos de permiso de los colaboradores, desde la solicitud hasta Recursos Humanos.</p>
        <ol class="recorrido recorrido--vertical" aria-label="Cómo funciona">${pasos}</ol>
      </section>

      <section class="login__acceso" aria-labelledby="tituloIngreso">
        <div class="login__formulario">
          <h2 class="titulo" id="tituloIngreso">Ingresar</h2>
          <p class="subtitulo">Con el email y la contraseña de tu usuario de la empresa.</p>

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
          ${cuentasDemo}
        </div>
      </section>
    </main>
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

  // Cuentas de demostración: completan el formulario y lo envían (el mismo camino
  // que un ingreso a mano, con sus validaciones y mensajes de error).
  for (const botonDemo of contenedor.querySelectorAll('.cuentas-demo__boton')) {
    botonDemo.addEventListener('click', () => {
      formulario.elements.email.value = botonDemo.dataset.email;
      formulario.elements.password.value = CONTRASENA_DEMO;
      formulario.requestSubmit();
    });
  }
}
