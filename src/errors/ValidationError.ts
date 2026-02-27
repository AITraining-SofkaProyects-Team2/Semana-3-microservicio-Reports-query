/**
 * Error de validación con cuerpo de respuesta personalizado.
 *
 * Permite que cada validación defina su propia estructura de respuesta HTTP,
 * manteniendo flexibilidad para distintos contratos de error
 * (ej: { error }, { error, message }, { message, validValues }).
 *
 * Usado por el errorHandler (Chain of Responsibility) → HTTP 400.
 */
export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly responseBody: Record<string, unknown>;

  constructor(responseBody: Record<string, unknown>) {
    super(String(responseBody.error || responseBody.message || 'Error de validación'));
    this.name = 'ValidationError';
    this.responseBody = responseBody;
  }
}
