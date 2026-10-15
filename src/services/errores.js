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

/** Mensajes en español para los códigos de error de Firestore más comunes. */
const MENSAJES_ERROR_FIRESTORE = {
  'permission-denied':
    'No tenés permiso para realizar esta acción. Puede que la solicitud haya cambiado: recargá la página.',
  unavailable: 'No hay conexión con el servidor. Revisá tu internet y volvé a intentar.',
  'deadline-exceeded': 'El servidor tardó demasiado en responder. Volvé a intentar.',
  aborted: 'Otra persona modificó la solicitud al mismo tiempo. Volvé a intentar.',
  'resource-exhausted': 'Se alcanzó un límite del servidor. Esperá unos minutos y volvé a intentar.',
  'invalid-argument': 'Los datos enviados no son válidos (por ejemplo, un archivo demasiado grande).',
};

/**
 * Convierte cualquier error en un ErrorAplicacion con mensaje para el usuario.
 * Los ErrorAplicacion (validaciones del negocio) pasan tal cual.
 * @param {unknown} error
 * @param {string} [mensajePorDefecto]
 * @returns {ErrorAplicacion}
 */
export function aErrorAplicacion(error, mensajePorDefecto = 'Ocurrió un error inesperado. Volvé a intentar.') {
  if (error instanceof ErrorAplicacion) return error;
  const codigo = error?.code ?? 'desconocido';
  console.error('[errores]', codigo, error); // detalle técnico solo en consola
  return new ErrorAplicacion(MENSAJES_ERROR_FIRESTORE[codigo] ?? mensajePorDefecto, codigo, error);
}
