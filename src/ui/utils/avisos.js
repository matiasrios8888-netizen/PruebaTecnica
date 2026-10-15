/**
 * =============================================================
 * Capa: UI (utilidad compartida)
 * Archivo: src/ui/utils/avisos.js
 *
 * Responsabilidad: mostrar avisos breves ("toast") que sobreviven a un
 *   cambio de pantalla, por ejemplo "Solicitud SOL-0011 creada" al pasar
 *   del formulario al detalle.
 *
 * Depende de: nada.
 * =============================================================
 */

const DURACION_MS = 4000;

/**
 * Muestra un aviso flotante que se oculta solo.
 * @param {string} texto - Se inserta como texto (nunca como HTML).
 * @param {'ok'|'error'} [tipo]
 */
export function mostrarAviso(texto, tipo = 'ok') {
  let zona = document.getElementById('zonaAvisos');
  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'zonaAvisos';
    zona.className = 'zona-avisos';
    zona.setAttribute('aria-live', 'polite'); // lectores de pantalla anuncian el aviso
    document.body.append(zona);
  }
  const aviso = document.createElement('div');
  aviso.className = `aviso aviso--${tipo}`;
  aviso.textContent = texto;
  zona.append(aviso);
  setTimeout(() => aviso.remove(), DURACION_MS);
}
