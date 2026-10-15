/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/bandejaPantalla.js
 *
 * Responsabilidad:
 *   Bandeja de tareas (pantalla principal):
 *   - pestañas Pendientes / Nuevas / Enviadas (/ Todas para RH y admin) con contadores;
 *   - búsqueda, filtros (estado, etapa, tipo, rango de fechas) y orden;
 *   - tabla de solicitudes; cada fila abre el detalle.
 *
 *   Cada pestaña es una ruta (#/bandeja/nuevas): funciona el botón "Atrás" y
 *   se puede compartir el link. Los datos se leen una vez al entrar; filtrar,
 *   ordenar y buscar solo redibuja la tabla (bandeja.js, sin consultar Firestore).
 *
 * Depende de: src/services/solicitudesServicio.js, src/services/bandeja.js,
 *   src/config/constantes.js, src/ui/componentes/*, src/ui/router.js, src/ui/utils/*
 * =============================================================
 */

import { cargarBandeja } from '../../services/solicitudesServicio.js';
import { filtrosVacios, hayFiltrosActivos, procesarBandeja } from '../../services/bandeja.js';
import {
  CONFIG_TIPOS_PERMISO,
  LIMITE_BANDEJA,
  NOMBRES_ESTADO,
  NOMBRES_ETAPA,
  NOMBRES_ORDEN,
  NOMBRES_PESTANA,
  ORDENES_BANDEJA,
  PESTANAS_BANDEJA,
  ROLES,
} from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { htmlTablaSolicitudes, conectarFilas } from '../componentes/tablaSolicitudes.js';
import { navegar, rutaBandeja, RUTA_NUEVA_SOLICITUD } from '../router.js';
import { escaparHtml, htmlOpciones } from '../utils/html.js';
import { nombreRol } from '../utils/formato.js';

/** Texto cuando una pestaña está vacía (sin filtros). */
const TEXTO_VACIO = {
  [PESTANAS_BANDEJA.PENDIENTES]: 'No tenés tareas pendientes.',
  [PESTANAS_BANDEJA.NUEVAS]: 'No tenés tareas nuevas.',
  [PESTANAS_BANDEJA.ENVIADAS]: 'Todavía no hay solicitudes que hayas enviado o gestionado.',
  [PESTANAS_BANDEJA.TODAS]: 'No hay solicitudes.',
};

/**
 * Filtros y orden elegidos. Se conservan al cambiar de pestaña o al volver del
 * detalle, y se reinician si cambia el usuario (otra sesión).
 */
let preferencias = { usuarioId: null, filtros: filtrosVacios(), orden: ORDENES_BANDEJA.RECIENTES };

/**
 * Dibuja la bandeja.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario
 * @param {{ pestana?: string }} parametros - Pestaña de la URL (por defecto, Pendientes).
 */
export async function renderizarBandeja(contenedor, usuario, { pestana = PESTANAS_BANDEJA.PENDIENTES } = {}) {
  if (preferencias.usuarioId !== usuario.id) {
    preferencias = { usuarioId: usuario.id, filtros: filtrosVacios(), orden: ORDENES_BANDEJA.RECIENTES };
  }

  const principal = dibujarMarco(contenedor, usuario);
  const botonNueva =
    usuario.rol === ROLES.INICIADOR ? `<a href="${RUTA_NUEVA_SOLICITUD}" class="boton boton--primario">Nueva solicitud</a>` : '';

  principal.innerHTML = `
    <section class="tarjeta tarjeta--ancha">
      <div class="cabecera-seccion">
        <div>
          <h1 class="titulo">Bandeja de tareas</h1>
          <p class="subtitulo">${escaparHtml(usuario.nombre)} · ${escaparHtml(nombreRol(usuario.rol))}</p>
        </div>
        ${botonNueva}
      </div>
      <nav class="pestanas" aria-label="Pestañas de la bandeja" id="pestanas"></nav>
    </section>
    <section class="tarjeta tarjeta--ancha">
      ${htmlFiltros()}
      <p class="ayuda" id="resumen" aria-live="polite">Cargando…</p>
      <div id="resultados"></div>
    </section>
  `;

  let bandeja;
  try {
    bandeja = await cargarBandeja();
  } catch (error) {
    if (!principal.isConnected) return; // la pantalla ya fue reemplazada (BUGS.md · BUG-004)
    principal.querySelector('#resumen').textContent = '';
    principal.querySelector('#resultados').innerHTML = `<p class="mensaje-error">${escaparHtml(error.message)}</p>`;
    return;
  }
  if (!principal.isConnected) return;

  // Pestaña inexistente o de otro rol (ej: un supervisor escribe #/bandeja/todas) → Pendientes.
  if (!bandeja.visibles.includes(pestana)) {
    navegar(rutaBandeja(PESTANAS_BANDEJA.PENDIENTES));
    return;
  }

  dibujarPestanas(principal, bandeja, pestana);
  conectarFiltros(principal, () => dibujarResultados(principal, bandeja, pestana, usuario));
  dibujarResultados(principal, bandeja, pestana, usuario);
}

// -------------------------------------------------------------
// Partes de la pantalla
// -------------------------------------------------------------

function dibujarPestanas(principal, bandeja, pestanaActual) {
  principal.querySelector('#pestanas').innerHTML = bandeja.visibles
    .map((clave) => {
      const actual = clave === pestanaActual ? 'aria-current="page"' : '';
      const cantidad = bandeja.pestanas[clave].length;
      const destacado = clave === PESTANAS_BANDEJA.NUEVAS && cantidad > 0 ? ' contador--destacado' : '';
      return `<a href="${rutaBandeja(clave)}" class="pestana" ${actual}>
                ${escaparHtml(NOMBRES_PESTANA[clave])} <span class="contador${destacado}">${cantidad}</span>
              </a>`;
    })
    .join('');
}

function htmlFiltros() {
  const { filtros, orden } = preferencias;
  const nombresTipo = Object.fromEntries(Object.entries(CONFIG_TIPOS_PERMISO).map(([clave, tipo]) => [clave, tipo.nombre]));
  return `
    <form class="filtros" id="formFiltros" role="search" novalidate>
      <label class="campo filtros__busqueda">
        <span>Buscar</span>
        <input type="search" name="texto" value="${escaparHtml(filtros.texto)}" placeholder="Número, persona, tipo o motivo" />
      </label>
      <label class="campo"><span>Estado</span>
        <select name="estado">${htmlOpciones(NOMBRES_ESTADO, filtros.estado, 'Todos')}</select></label>
      <label class="campo"><span>Etapa</span>
        <select name="etapa">${htmlOpciones(NOMBRES_ETAPA, filtros.etapa, 'Todas')}</select></label>
      <label class="campo"><span>Tipo</span>
        <select name="tipoPermiso">${htmlOpciones(nombresTipo, filtros.tipoPermiso, 'Todos')}</select></label>
      <label class="campo"><span>Permisos desde</span>
        <input type="date" name="desde" value="${escaparHtml(filtros.desde)}" /></label>
      <label class="campo"><span>hasta</span>
        <input type="date" name="hasta" value="${escaparHtml(filtros.hasta)}" /></label>
      <label class="campo"><span>Ordenar por</span>
        <select name="orden">${htmlOpciones(NOMBRES_ORDEN, orden)}</select></label>
      <div class="filtros__acciones">
        <button type="reset" class="boton boton--chico" id="limpiarFiltros">Limpiar filtros</button>
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
    preferencias.filtros = {
      texto: campos.texto.value,
      estado: campos.estado.value,
      etapa: campos.etapa.value,
      tipoPermiso: campos.tipoPermiso.value,
      desde: campos.desde.value,
      hasta: campos.hasta.value,
    };
    preferencias.orden = campos.orden.value;
    redibujar();
  };
  formulario.addEventListener('input', leer);
  formulario.addEventListener('change', leer);
  formulario.addEventListener('submit', (evento) => evento.preventDefault()); // Enter en la búsqueda no recarga
  formulario.addEventListener('reset', () => {
    // El "reset" del navegador vuelve a los valores con que se dibujó el formulario;
    // por eso se limpian a mano y se deja el orden por defecto.
    setTimeout(() => {
      for (const campo of formulario.querySelectorAll('input')) campo.value = '';
      for (const campo of formulario.querySelectorAll('select')) campo.selectedIndex = 0;
      leer();
    });
  });
}

function dibujarResultados(principal, bandeja, pestana, usuario) {
  const lista = bandeja.pestanas[pestana];
  const visibles = procesarBandeja(lista, preferencias.filtros, preferencias.orden);
  const filtrando = hayFiltrosActivos(preferencias.filtros);
  const resultados = principal.querySelector('#resultados');

  const aviso = bandeja.limiteAlcanzado
    ? ` Se muestran las ${LIMITE_BANDEJA} más recientes de cada lista.`
    : '';
  principal.querySelector('#resumen').textContent = filtrando
    ? `Mostrando ${visibles.length} de ${lista.length}.${aviso}`
    : `${lista.length} ${lista.length === 1 ? 'solicitud' : 'solicitudes'}.${aviso}`;

  if (visibles.length === 0) {
    resultados.innerHTML = `<p class="vacio">${
      filtrando ? 'Ninguna solicitud coincide con los filtros.' : TEXTO_VACIO[pestana]
    }</p>`;
    return;
  }
  resultados.innerHTML = htmlTablaSolicitudes(visibles, usuario);
  conectarFilas(resultados);
}
