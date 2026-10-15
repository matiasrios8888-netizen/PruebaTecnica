/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/rolesPantalla.js
 *
 * Responsabilidad:
 *   Gestión de roles para el admin (DECISIONES.md #25):
 *   - una tarjeta por cada uno de los 4 roles del sistema, con su descripción,
 *     sus permisos (solo lectura) y cuántos usuarios lo tienen;
 *   - editar el nombre visible y la descripción;
 *   - "Crear rol": solo para volver a crear un rol del sistema que falte.
 *
 * Depende de: src/services/rolesServicio.js, src/services/gestionRoles.js,
 *   src/config/constantes.js, src/ui/componentes/marco.js, src/ui/utils/*
 * =============================================================
 */

import { crearRolFaltante, guardarRol, obtenerGestionRoles } from '../../services/rolesServicio.js';
import { rolPorDefecto } from '../../services/gestionRoles.js';
import { LIMITES_ROL, NOMBRES_PERMISO, NOMBRES_ROL } from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { escaparHtml, htmlOpciones } from '../utils/html.js';
import { ejecutarConEstado } from '../utils/operaciones.js';

/** @typedef {import('../../services/gestionRoles.js').RolDelCatalogo} RolDelCatalogo */

/**
 * Dibuja la pantalla de roles.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario - El admin logueado.
 */
export async function renderizarRoles(contenedor, usuario) {
  const principal = dibujarMarco(contenedor, usuario);
  principal.innerHTML = `
    <section class="tarjeta tarjeta--ancha">
      <h1 class="titulo">Roles</h1>
      <p class="subtitulo">
        Los 4 roles del flujo de permisos. Podés cambiar el nombre que se muestra y la descripción;
        lo que cada rol puede hacer lo define el flujo, por eso los permisos no se editan.
      </p>
    </section>
    <div id="contenidoRoles"><p class="vacio">Cargando roles…</p></div>
  `;

  let gestion;
  try {
    gestion = await obtenerGestionRoles();
  } catch (error) {
    if (!principal.isConnected) return; // la pantalla ya fue reemplazada (BUGS.md · BUG-004)
    principal.querySelector('#contenidoRoles').innerHTML = `<p class="mensaje-error">${escaparHtml(error.message)}</p>`;
    return;
  }
  if (!principal.isConnected) return;

  const contenido = principal.querySelector('#contenidoRoles');
  contenido.className = 'columna';
  contenido.innerHTML = `
    <div class="grilla-roles">${gestion.roles.map(htmlRol).join('')}</div>
    ${htmlCrearRol(gestion.faltantes)}
  `;
  gestion.roles.filter((rol) => rol.existe).forEach((rol) => conectarEdicion(contenido, rol));
  if (gestion.faltantes.length > 0) conectarCreacion(contenido);
}

// -------------------------------------------------------------
// HTML (todo dato de Firestore pasa por escaparHtml)
// -------------------------------------------------------------

const htmlPermisos = (permisos) =>
  `<ul class="lista-permisos">${permisos.map((p) => `<li>${escaparHtml(NOMBRES_PERMISO[p] ?? p)}</li>`).join('')}</ul>`;

/**
 * Tarjeta de un rol, con su formulario de edición oculto.
 * @param {RolDelCatalogo} rol
 * @returns {string}
 */
function htmlRol(rol) {
  const estado = rol.existe
    ? ''
    : '<span class="etiqueta etiqueta--alerta">Falta en el catálogo</span>';
  const usuarios = `${rol.usuariosActivos} ${rol.usuariosActivos === 1 ? 'usuario activo' : 'usuarios activos'}` +
    (rol.usuariosTotales > rol.usuariosActivos ? ` (${rol.usuariosTotales - rol.usuariosActivos} de baja)` : '');

  const edicion = rol.existe
    ? `
      <button type="button" class="boton boton--chico" data-editar>Editar</button>
      <form class="formulario" data-form-rol hidden novalidate>
        <label class="campo">
          <span>Nombre visible</span>
          <input type="text" name="nombre" maxlength="${LIMITES_ROL.largoMaximoNombre}" value="${escaparHtml(rol.nombre)}" required />
        </label>
        <label class="campo">
          <span>Descripción</span>
          <textarea name="descripcion" rows="3" maxlength="${LIMITES_ROL.largoMaximoDescripcion}">${escaparHtml(rol.descripcion)}</textarea>
        </label>
        <p class="mensaje-error" role="alert" data-error hidden></p>
        <div class="acciones">
          <button type="button" class="boton" data-cancelar>Cancelar</button>
          <button type="submit" class="boton boton--primario">Guardar</button>
        </div>
      </form>`
    : '<p class="mensaje-alerta">Los usuarios con este rol siguen funcionando. Volvé a crearlo abajo para editar su nombre y descripción.</p>';

  return `
    <section class="tarjeta tarjeta--ancha tarjeta-rol" data-rol="${escaparHtml(rol.clave)}">
      <div class="cabecera-seccion">
        <div>
          <h2 class="titulo--seccion">${escaparHtml(rol.nombre)}</h2>
          <p class="ayuda">Clave: <code>${escaparHtml(rol.clave)}</code> · ${usuarios}</p>
        </div>
        ${estado}
      </div>
      <div class="tarjeta-rol__vista" data-vista>
        <p>${escaparHtml(rol.descripcion) || '<span class="ayuda">Sin descripción.</span>'}</p>
        <p class="ayuda"><strong>Permisos</strong> (los define el flujo)</p>
        ${htmlPermisos(rol.permisos)}
      </div>
      ${edicion}
    </section>`;
}

/**
 * Sección "Crear rol": explica cuándo se usa y, si falta algún rol, muestra el formulario.
 * @param {string[]} faltantes
 * @returns {string}
 */
function htmlCrearRol(faltantes) {
  if (faltantes.length === 0) {
    return `
      <section class="tarjeta tarjeta--ancha">
        <h2 class="titulo--seccion">Crear rol</h2>
        <p class="ayuda">
          Los 4 roles del sistema están en el catálogo. Solo se puede crear un rol si alguno falta
          (por ejemplo, si se borró desde la consola de Firebase). Un rol con otro nombre no tendría
          ninguna función en el flujo, por eso no se ofrece.
        </p>
      </section>`;
  }
  const nombres = Object.fromEntries(faltantes.map((clave) => [clave, NOMBRES_ROL[clave]]));
  const inicial = rolPorDefecto(faltantes[0]);
  return `
    <section class="tarjeta tarjeta--ancha">
      <h2 class="titulo--seccion">Crear rol</h2>
      <p class="mensaje-alerta">
        Falta${faltantes.length > 1 ? 'n' : ''} en el catálogo: ${escaparHtml(faltantes.map((c) => NOMBRES_ROL[c]).join(', '))}.
        Se vuelve a crear con sus permisos de fábrica.
      </p>
      <form id="formCrearRol" class="formulario formulario--separado" novalidate>
        <label class="campo">
          <span>Rol del sistema</span>
          <select name="clave">${htmlOpciones(nombres, faltantes[0])}</select>
        </label>
        <label class="campo">
          <span>Nombre visible</span>
          <input type="text" name="nombre" maxlength="${LIMITES_ROL.largoMaximoNombre}" value="${escaparHtml(inicial.nombre)}" required />
        </label>
        <label class="campo">
          <span>Descripción</span>
          <textarea name="descripcion" rows="3" maxlength="${LIMITES_ROL.largoMaximoDescripcion}">${escaparHtml(inicial.descripcion)}</textarea>
        </label>
        <div>
          <p class="ayuda"><strong>Permisos</strong> (de fábrica, no se editan)</p>
          <div id="permisosNuevoRol">${htmlPermisos(inicial.permisos)}</div>
        </div>
        <p id="errorCrearRol" class="mensaje-error" role="alert" hidden></p>
        <div class="acciones">
          <button type="submit" class="boton boton--primario">Crear rol</button>
        </div>
      </form>
    </section>`;
}

// -------------------------------------------------------------
// Comportamiento
// -------------------------------------------------------------

/**
 * "Editar" muestra el formulario de la tarjeta; "Cancelar" vuelve a la vista.
 * @param {HTMLElement} contenido
 * @param {RolDelCatalogo} rol
 */
function conectarEdicion(contenido, rol) {
  const tarjeta = contenido.querySelector(`[data-rol="${rol.clave}"]`);
  const botonEditar = tarjeta.querySelector('[data-editar]');
  const formulario = tarjeta.querySelector('[data-form-rol]');
  const vista = tarjeta.querySelector('[data-vista]');
  const mensajeError = formulario.querySelector('[data-error]');

  const mostrarFormulario = (mostrar) => {
    formulario.hidden = !mostrar;
    vista.hidden = mostrar;
    botonEditar.hidden = mostrar;
    if (mostrar) formulario.elements.nombre.focus();
  };
  botonEditar.addEventListener('click', () => mostrarFormulario(true));
  formulario.querySelector('[data-cancelar]').addEventListener('click', () => {
    formulario.reset();
    mensajeError.hidden = true;
    mostrarFormulario(false);
  });
  formulario.addEventListener('input', () => { mensajeError.hidden = true; }); // BUGS.md · BUG-005

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const datos = { nombre: formulario.elements.nombre.value, descripcion: formulario.elements.descripcion.value };
    ejecutarConEstado(
      formulario.querySelector('button[type="submit"]'),
      mensajeError,
      () => guardarRol(rol.clave, datos),
      `Rol "${datos.nombre.trim()}" guardado.`,
    );
  });
}

/**
 * Formulario "Crear rol": al elegir otro rol faltante, carga sus valores de fábrica.
 * @param {HTMLElement} contenido
 */
function conectarCreacion(contenido) {
  const formulario = contenido.querySelector('#formCrearRol');
  const mensajeError = formulario.querySelector('#errorCrearRol');
  const campos = formulario.elements;

  campos.clave.addEventListener('change', () => {
    const deFabrica = rolPorDefecto(campos.clave.value);
    campos.nombre.value = deFabrica.nombre;
    campos.descripcion.value = deFabrica.descripcion;
    contenido.querySelector('#permisosNuevoRol').innerHTML = htmlPermisos(deFabrica.permisos);
  });
  formulario.addEventListener('input', () => { mensajeError.hidden = true; }); // BUGS.md · BUG-005

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const datos = { nombre: campos.nombre.value, descripcion: campos.descripcion.value };
    ejecutarConEstado(
      formulario.querySelector('button[type="submit"]'),
      mensajeError,
      () => crearRolFaltante(campos.clave.value, datos),
      `Rol "${datos.nombre.trim()}" creado.`,
    );
  });
}
