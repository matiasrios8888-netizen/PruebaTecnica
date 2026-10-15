/**
 * =============================================================
 * Capa: UI
 * Archivo: src/ui/pantallas/nuevaSolicitudPantalla.js
 *
 * Responsabilidad:
 *   Formulario para que el iniciador cree una solicitud: tipo de permiso,
 *   fechas (con el cálculo de días en vivo), motivo y adjuntos.
 *   No valida reglas de negocio por su cuenta: muestra las pistas de
 *   CONFIG_TIPOS_PERMISO y delega la validación real en solicitudesServicio.
 *
 * Depende de: src/services/solicitudesServicio.js, src/services/flujoSolicitud.js,
 *   src/config/constantes.js, src/ui/componentes/marco.js, src/ui/router.js,
 *   src/ui/utils/*
 * =============================================================
 */

import { crearSolicitud } from '../../services/solicitudesServicio.js';
import { calcularCantidadDias, LARGO_MAXIMO_MOTIVO } from '../../services/flujoSolicitud.js';
import { CONFIG_TIPOS_PERMISO, LIMITES_ADJUNTO } from '../../config/constantes.js';
import { dibujarMarco } from '../componentes/marco.js';
import { navegar, rutaDetalle, RUTA_INICIO } from '../router.js';
import { escaparHtml } from '../utils/html.js';
import { formatearTamano } from '../utils/formato.js';
import { mostrarAviso } from '../utils/avisos.js';

/**
 * Dibuja la pantalla de nueva solicitud.
 * @param {HTMLElement} contenedor
 * @param {import('../../data/modelos.js').Usuario} usuario
 */
export function renderizarNuevaSolicitud(contenedor, usuario) {
  const principal = dibujarMarco(contenedor, usuario);
  const opcionesTipo = Object.entries(CONFIG_TIPOS_PERMISO)
    .map(([clave, tipo]) => `<option value="${clave}">${escaparHtml(tipo.nombre)}</option>`)
    .join('');

  principal.innerHTML = `
    <section class="tarjeta tarjeta--ancha">
      <h1 class="titulo">Nueva solicitud de permiso</h1>
      <p class="subtitulo">La solicitud se envía a tu supervisor para que la apruebe.</p>

      <form id="formSolicitud" class="formulario" novalidate>
        <label class="campo">
          <span>Tipo de permiso</span>
          <select name="tipoPermiso" required>
            <option value="">Elegí un tipo…</option>
            ${opcionesTipo}
          </select>
          <small class="ayuda" id="ayudaTipo"></small>
        </label>

        <div class="fila">
          <label class="campo">
            <span>Desde</span>
            <input type="date" name="fechaInicio" required />
          </label>
          <label class="campo">
            <span>Hasta (inclusive)</span>
            <input type="date" name="fechaFin" required />
          </label>
        </div>
        <p class="ayuda" id="cantidadDias"></p>

        <label class="campo">
          <span>Motivo</span>
          <textarea name="motivo" rows="4" maxlength="${LARGO_MAXIMO_MOTIVO}" required></textarea>
          <small class="ayuda"><span id="contadorMotivo">0</span>/${LARGO_MAXIMO_MOTIVO}</small>
        </label>

        <label class="campo">
          <span>Adjuntos</span>
          <input type="file" name="archivos" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
          <small class="ayuda">
            PDF, JPG o PNG · hasta ${LIMITES_ADJUNTO.maximoAlCrear} archivos de ${formatearTamano(LIMITES_ADJUNTO.tamanoMaximoBytes)} cada uno.
          </small>
          <ul class="lista-archivos" id="listaArchivos"></ul>
        </label>

        <p id="errorFormulario" class="mensaje-error" role="alert" hidden></p>

        <div class="acciones">
          <a href="${RUTA_INICIO}" class="boton">Cancelar</a>
          <button type="submit" class="boton boton--primario">Enviar solicitud</button>
        </div>
      </form>
    </section>
  `;

  const formulario = principal.querySelector('#formSolicitud');
  const campos = formulario.elements;
  const ayudaTipo = principal.querySelector('#ayudaTipo');
  const textoDias = principal.querySelector('#cantidadDias');
  const mensajeError = principal.querySelector('#errorFormulario');
  const boton = formulario.querySelector('button[type="submit"]');

  // Pistas en vivo: días máximos y si el tipo exige adjunto.
  const actualizarAyudas = () => {
    const tipo = CONFIG_TIPOS_PERMISO[campos.tipoPermiso.value];
    ayudaTipo.textContent = tipo
      ? `Máximo ${tipo.diasMaximos} días.${tipo.requiereAdjunto ? ' Requiere adjuntar documentación.' : ''}`
      : '';

    textoDias.textContent = '';
    if (campos.fechaInicio.value && campos.fechaFin.value) {
      try {
        const dias = calcularCantidadDias(campos.fechaInicio.value, campos.fechaFin.value);
        textoDias.textContent = dias >= 1 ? `Cantidad de días: ${dias}` : 'La fecha de fin es anterior a la de inicio.';
      } catch {
        // Fecha incompleta mientras se escribe: no se muestra nada.
      }
    }
  };
  campos.tipoPermiso.addEventListener('change', actualizarAyudas);
  campos.fechaInicio.addEventListener('change', () => {
    campos.fechaFin.min = campos.fechaInicio.value; // el calendario no ofrece días anteriores
    actualizarAyudas();
  });
  campos.fechaFin.addEventListener('change', actualizarAyudas);

  campos.motivo.addEventListener('input', () => {
    principal.querySelector('#contadorMotivo').textContent = String(campos.motivo.value.length);
  });

  campos.archivos.addEventListener('change', () => {
    principal.querySelector('#listaArchivos').innerHTML = [...campos.archivos.files]
      .map((archivo) => `<li>${escaparHtml(archivo.name)} · ${formatearTamano(archivo.size)}</li>`)
      .join('');
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mensajeError.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Enviando…';

    try {
      const { id, numero } = await crearSolicitud(
        {
          tipoPermiso: campos.tipoPermiso.value,
          fechaInicio: campos.fechaInicio.value,
          fechaFin: campos.fechaFin.value,
          motivo: campos.motivo.value,
        },
        [...campos.archivos.files],
      );
      mostrarAviso(`Solicitud ${numero} enviada a tu supervisor.`);
      navegar(rutaDetalle(id));
    } catch (error) {
      mensajeError.textContent = error.message;
      mensajeError.hidden = false;
      boton.disabled = false;
      boton.textContent = 'Enviar solicitud';
    }
  });
}
