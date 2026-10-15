/**
 * =============================================================
 * Capa: UI (utilidad compartida)
 * Archivo: src/ui/utils/html.js
 *
 * Responsabilidad: funciones de ayuda para construir HTML de forma segura.
 *
 * Depende de: nada.
 * =============================================================
 */

/**
 * Escapa los caracteres especiales de HTML de un texto.
 *
 * 🔒 SEGURIDAD: las pantallas arman HTML con template strings. Cualquier dato que
 * venga de Firestore (nombres, motivos, notas) tiene que pasar por esta función.
 * Si no, un nombre como "<img src=x onerror=alert(1)>" se ejecutaría en el
 * navegador de quien lo vea (ataque XSS).
 *
 * @param {unknown} valor - Texto a escapar (null/undefined se convierten en "").
 * @returns {string} Texto seguro para insertar dentro de HTML.
 */
export function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Opciones de un <select> a partir de un objeto { clave: nombre }, marcando la elegida.
 * @param {Record<string, string>} nombres - Ej: NOMBRES_ESTADO.
 * @param {string} elegida - Clave seleccionada ("" = ninguna).
 * @param {string} [textoTodos] - Si se indica, agrega primero una opción vacía con ese texto (ej: "Todos").
 * @returns {string} HTML de las <option>.
 */
export function htmlOpciones(nombres, elegida, textoTodos) {
  const primera = textoTodos ? `<option value="">${escaparHtml(textoTodos)}</option>` : '';
  return (
    primera +
    Object.entries(nombres)
      .map(
        ([clave, nombre]) =>
          `<option value="${escaparHtml(clave)}" ${clave === elegida ? 'selected' : ''}>${escaparHtml(nombre)}</option>`,
      )
      .join('')
  );
}
