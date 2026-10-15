/**
 * =============================================================
 * Capa: SERVICIOS (utilidad compartida)
 * Archivo: src/services/errores.js
 *
 * Responsabilidad:
 *   Definir el error que los servicios lanzan cuando algo falla por una
 *   razón que el usuario tiene que entender (credenciales incorrectas,
 *   usuario dado de baja, transición no permitida, etc.).
 *   La UI muestra error.message tal cual: siempre está en español y
 *   nunca expone detalles técnicos.
 *
 * Depende de: nada.
 * =============================================================
 */

/**
 * Error con un mensaje apto para mostrar al usuario.
 */
export class ErrorAplicacion extends Error {
  /**
   * @param {string} mensaje - Texto en español para mostrar en pantalla.
   * @param {string} [codigo] - Código interno para lógica o logs (ej: "usuarioInactivo").
   * @param {unknown} [causa] - Error original (de Firebase u otro), para depurar en consola.
   */
  constructor(mensaje, codigo = 'desconocido', causa = undefined) {
    super(mensaje);
    this.name = 'ErrorAplicacion';
    this.codigo = codigo;
    this.causa = causa;
  }
}
