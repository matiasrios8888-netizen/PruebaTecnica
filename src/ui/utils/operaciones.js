/**
 * =============================================================
 * Capa: UI (utilidad compartida)
 * Archivo: src/ui/utils/operaciones.js
 *
 * Responsabilidad: ejecutar una operación desde un botón (guardar, aprobar,
 *   dar de baja…) con el mismo comportamiento en todas las pantallas:
 *   botón deshabilitado mientras corre, aviso si sale bien y error si falla.
 *
 * Depende de: src/ui/router.js, src/ui/utils/avisos.js
 * =============================================================
 */

import { recargarPantalla } from '../router.js';
import { mostrarAviso } from './avisos.js';

/**
 * Deshabilita un botón mientras corre una operación y muestra el error si falla.
 * @param {HTMLButtonElement} boton
 * @param {HTMLElement} mensajeError
 * @param {() => Promise<void>} operacion
 * @param {string|(() => string)} textoExito - Aviso que se muestra si sale bien
 *   (después se recarga la pantalla con datos frescos).
 */
export async function ejecutarConEstado(boton, mensajeError, operacion, textoExito) {
  mensajeError.hidden = true;
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await operacion();
    mostrarAviso(typeof textoExito === 'function' ? textoExito() : textoExito);
    recargarPantalla();
  } catch (error) {
    mensajeError.textContent = error.message;
    mensajeError.hidden = false;
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}
