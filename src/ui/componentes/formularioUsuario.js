/**
 * =============================================================
 * Capa: UI (componente)
 * Archivo: src/ui/componentes/formularioUsuario.js
 *
 * Responsabilidad:
 *   Campos del formulario de un usuario, compartidos por el alta y la ficha:
 *   nombre, email, rol, área y supervisor. El supervisor solo se muestra
 *   cuando el rol es "iniciador" (es quien aprueba sus solicitudes).
 *   No valida: la validación real está en gestionUsuarios.js (vía el servicio).
 *
 * Depende de: src/config/constantes.js, src/ui/utils/html.js, src/ui/utils/formato.js
 * =============================================================
 */

import { LIMITES_USUARIO, ROLES } from '../../config/constantes.js';
import { escaparHtml, htmlOpciones } from '../utils/html.js';
import { nombreRol } from '../utils/formato.js';

/** @typedef {import('../../data/modelos.js').Usuario} Usuario */

/**
 * HTML de los campos.
 * 🔒 SEGURIDAD: los valores que vienen de Firestore pasan por escaparHtml.
 * @param {Object} opciones
 * @param {Partial<Usuario>} [opciones.valores] - Valores iniciales (vacío en el alta).
 * @param {Usuario[]} opciones.supervisores - Supervisores que se pueden elegir.
 * @param {boolean} [opciones.emailEditable] - false en la ficha: el email no se edita después del alta.
 * @returns {string}
 */
export function htmlCamposUsuario({ valores = {}, supervisores, emailEditable = true }) {
  const nombresRol = Object.fromEntries(Object.values(ROLES).map((clave) => [clave, nombreRol(clave)]));
  const nombresSupervisor = Object.fromEntries(
    supervisores.map((s) => [s.id, s.activo ? s.nombre : `${s.nombre} (de baja)`]),
  );
  const ayudaEmail = emailEditable
    ? 'Es el usuario para iniciar sesión.'
    : 'No se puede cambiar: tiene que coincidir con la cuenta de acceso.';

  return `
    <div class="fila">
      <label class="campo">
        <span>Nombre y apellido</span>
        <input type="text" name="nombre" maxlength="${LIMITES_USUARIO.largoMaximoNombre}" required
               value="${escaparHtml(valores.nombre)}" autocomplete="off" />
      </label>
      <label class="campo">
        <span>Email</span>
        <input type="email" name="email" maxlength="${LIMITES_USUARIO.largoMaximoEmail}" required
               value="${escaparHtml(valores.email)}" autocomplete="off" ${emailEditable ? '' : 'disabled'} />
        <small class="ayuda">${ayudaEmail}</small>
      </label>
    </div>
    <div class="fila">
      <label class="campo">
        <span>Rol</span>
        <select name="rol" required>${htmlOpciones(nombresRol, valores.rol ?? '', 'Elegí un rol…')}</select>
      </label>
      <label class="campo">
        <span>Área o sector</span>
        <input type="text" name="area" maxlength="${LIMITES_USUARIO.largoMaximoArea}" required
               value="${escaparHtml(valores.area)}" autocomplete="off" />
      </label>
    </div>
    <label class="campo" id="campoSupervisor">
      <span>Supervisor</span>
      <select name="supervisorId">${htmlOpciones(nombresSupervisor, valores.supervisorId ?? '', 'Elegí un supervisor…')}</select>
      <small class="ayuda">Aprueba las solicitudes de este colaborador.</small>
    </label>
  `;
}

/**
 * Muestra el campo "Supervisor" solo si el rol elegido es iniciador.
 * @param {HTMLFormElement} formulario
 */
export function conectarCampoSupervisor(formulario) {
  const campo = formulario.querySelector('#campoSupervisor');
  const actualizar = () => {
    campo.hidden = formulario.elements.rol.value !== ROLES.INICIADOR;
  };
  formulario.elements.rol.addEventListener('change', actualizar);
  actualizar();
}

/**
 * Lee los valores cargados (sin validar).
 * @param {HTMLFormElement} formulario
 * @returns {import('../../services/gestionUsuarios.js').DatosUsuario}
 */
export function leerCamposUsuario(formulario) {
  const campos = formulario.elements;
  return {
    nombre: campos.nombre.value,
    email: campos.email.value,
    rol: campos.rol.value,
    area: campos.area.value,
    supervisorId: campos.supervisorId.value || null,
  };
}
