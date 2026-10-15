/**
 * =============================================================
 * Capa: SERVICIOS (utilidad de archivos del navegador)
 * Archivo: src/services/archivos.js
 *
 * Responsabilidad:
 *   Convertir entre archivos del navegador (File / Blob) y el formato en que
 *   se guardan en Firestore (texto base64). Ver DECISIONES.md #11.
 *
 * Depende de: APIs del navegador (FileReader, Blob, URL).
 * =============================================================
 */

/**
 * Lee un archivo y devuelve su contenido en base64 (sin el prefijo "data:...;base64,").
 * @param {File} archivo
 * @returns {Promise<string>}
 * @throws {Error} Si el navegador no puede leer el archivo.
 */
export function leerComoBase64(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      // readAsDataURL devuelve "data:application/pdf;base64,JVBERi0..." → nos quedamos con lo que sigue a la coma.
      const resultado = String(lector.result);
      resolver(resultado.slice(resultado.indexOf(',') + 1));
    };
    lector.onerror = () => rechazar(new Error(`No se pudo leer el archivo "${archivo.name}".`));
    lector.readAsDataURL(archivo);
  });
}

/**
 * Crea una URL temporal para abrir o descargar un adjunto guardado en base64.
 * Quien la usa debe liberarla con URL.revokeObjectURL cuando ya no la necesite.
 * @param {{ contenidoBase64: string, tipoMime: string }} adjunto
 * @returns {string} URL "blob:..." que el navegador puede abrir.
 */
export function crearUrlDeAdjunto({ contenidoBase64, tipoMime }) {
  const binario = atob(contenidoBase64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: tipoMime }));
}
