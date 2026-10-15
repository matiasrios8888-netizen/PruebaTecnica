/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/usuariosPantalla.js
 *
 * Responsabilidad:
 *   Listado de usuarios para el admin: búsqueda (nombre, email, área),
 *   filtros por rol y estado, y tabla en la que cada fila abre la ficha
 *   del usuario. Los datos se leen una vez; filtrar solo redibuja la tabla
 *   (gestionUsuarios.filtrarUsuarios, sin consultar Firestore).
 *
 * Depende de: src/services/usuariosServicio.js, src/services/gestionUsuarios.js,
 *   src/config/constantes.js, src/ui/componentes/marco.js, src/ui/router.js,
 *   src/ui/utils/*
 * =============================================================
 */

import { cargarUsuarios } from '../../services/usuariosServicio.js';
import { filtrarUsuarios, filtrosUsuariosVacios } from '../../services/gestionUsuarios.js';
import { NOMBRES_FILTRO_ESTADO_USUARIO, ROLES } from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { navegar, rutaFichaUsuario } from '../router.js';
import { escaparHtml, htmlOpciones } from '../utils/html.js';
import { nombreRol } from '../utils/formato.js';

/**
 * Filtros elegidos: se conservan al volver de una ficha y se reinician si
 * cambia el usuario logueado.
 */
let preferencias = { usuarioId: null, filtros: filtrosUsuariosVacios() };

/**
 * Dibuja el listado de usuarios.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario - El admin logueado.
 */
export async function renderizarUsuarios(contenedor, usuario) {
  if (preferencias.usuarioId !== usuario.id) {
    preferencias = { usuarioId: usuario.id, filtros: filtrosUsuariosVacios() };
  }

  const principal = dibujarMarco(contenedor, usuario);
  principal.innerHTML = `
    <section class="tarjeta tarjeta--ancha">
      <div class="cabecera-seccion">
        <div>
          <h1 class="titulo">Usuarios</h1>
          <p class="subtitulo">Colaboradores que usan la aplicación y el rol de cada uno.</p>
        </div>
      </div>
      ${htmlFiltros()}
      <p class="ayuda" id="resumen" aria-live="polite">Cargando…</p>
      <div id="resultados"></div>
    </section>
  `;

  let usuarios;
  try {
    usuarios = await cargarUsuarios();
  } catch (error) {
    if (!principal.isConnected) return; // la pantalla ya fue reemplazada (BUGS.md · BUG-004)
    principal.querySelector('#resumen').textContent = '';
    principal.querySelector('#resultados').innerHTML = `<p class="mensaje-error">${escaparHtml(error.message)}</p>`;
    return;
  }
  if (!principal.isConnected) return;

  conectarFiltros(principal, () => dibujarResultados(principal, usuarios));
  dibujarResultados(principal, usuarios);
}

// -------------------------------------------------------------
// Partes de la pantalla
// -------------------------------------------------------------

function htmlFiltros() {
  const { filtros } = preferencias;
  const nombresRol = Object.fromEntries(Object.values(ROLES).map((clave) => [clave, nombreRol(clave)]));
  return `
    <form class="filtros" id="formFiltros" role="search" novalidate>
      <label class="campo filtros__busqueda">
        <span>Buscar</span>
        <input type="search" name="texto" value="${escaparHtml(filtros.texto)}" placeholder="Nombre, email o área" />
      </label>
      <label class="campo"><span>Rol</span>
        <select name="rol">${htmlOpciones(nombresRol, filtros.rol, 'Todos')}</select></label>
      <label class="campo"><span>Estado</span>
        <select name="estado">${htmlOpciones(NOMBRES_FILTRO_ESTADO_USUARIO, filtros.estado, 'Todos')}</select></label>
      <div class="filtros__acciones">
        <button type="reset" class="boton boton--chico">Limpiar filtros</button>
      </div>
    </form>`;
}

/**
 * Cada cambio en los filtros actualiza las preferencias y redibuja solo la tabla.
 * @param {HTMLElement} principal
 * @param {() => void} redibujar
 */
function conectarFiltros(principal, redibujar) {
  const formulario = principal.querySelector('#formFiltros');
  const leer = () => {
    const campos = formulario.elements;
    preferencias.filtros = { texto: campos.texto.value, rol: campos.rol.value, estado: campos.estado.value };
    redibujar();
  };
  formulario.addEventListener('input', leer);
  formulario.addEventListener('change', leer);
  formulario.addEventListener('submit', (evento) => evento.preventDefault());
  formulario.addEventListener('reset', () => {
    // El "reset" del navegador vuelve a los valores con que se dibujó el formulario;
    // por eso se limpian a mano.
    setTimeout(() => {
      for (const campo of formulario.querySelectorAll('input')) campo.value = '';
      for (const campo of formulario.querySelectorAll('select')) campo.selectedIndex = 0;
      leer();
    });
  });
}

/**
 * Dibuja el resumen y la tabla con los usuarios que pasan los filtros.
 * 🔒 SEGURIDAD: todos los datos que vienen de Firestore pasan por escaparHtml.
 * @param {HTMLElement} principal
 * @param {import('../../data/modelos.js').Usuario[]} usuarios - Todos los usuarios.
 */
function dibujarResultados(principal, usuarios) {
  const visibles = filtrarUsuarios(usuarios, preferencias.filtros);
  const activos = usuarios.filter((u) => u.activo).length;
  principal.querySelector('#resumen').textContent =
    `Mostrando ${visibles.length} de ${usuarios.length} usuarios (${activos} activos).`;

  const resultados = principal.querySelector('#resultados');
  if (visibles.length === 0) {
    resultados.innerHTML = '<p class="vacio">Ningún usuario coincide con los filtros.</p>';
    return;
  }

  const porId = new Map(usuarios.map((u) => [u.id, u]));
  const filas = visibles
    .map((u) => {
      const estado = u.activo
        ? '<span class="etiqueta etiqueta--ok">Activo</span>'
        : '<span class="etiqueta etiqueta--neutra">Dado de baja</span>';
      return `
        <tr data-id="${escaparHtml(u.id)}">
          <td><a href="${rutaFichaUsuario(u.id)}">${escaparHtml(u.nombre)}</a></td>
          <td>${escaparHtml(u.email)}</td>
          <td>${escaparHtml(nombreRol(u.rol))}</td>
          <td>${escaparHtml(u.area)}</td>
          <td>${escaparHtml(porId.get(u.supervisorId)?.nombre ?? '—')}</td>
          <td>${estado}</td>
        </tr>`;
    })
    .join('');

  resultados.innerHTML = `
    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Área</th><th>Supervisor</th><th>Estado</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;

  // Toda la fila abre la ficha (el nombre sigue siendo un enlace accesible).
  for (const fila of resultados.querySelectorAll('tbody tr[data-id]')) {
    fila.addEventListener('click', (evento) => {
      if (evento.target.closest('a')) return;
      navegar(rutaFichaUsuario(fila.dataset.id));
    });
  }
}
