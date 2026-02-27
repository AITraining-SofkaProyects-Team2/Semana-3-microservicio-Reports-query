import { Request, Response, NextFunction } from 'express';
import { TicketNotFoundError } from '../errors/TicketNotFoundError';
import { InvalidUuidFormatError } from '../errors/InvalidUuidFormatError';
import { ValidationError } from '../errors/ValidationError';

/**
 * Middleware centralizado de manejo de errores (Chain of Responsibility).
 *
 * Cada tipo de error conocido se maneja con su código HTTP semántico.
 * Los errores desconocidos se responden con 500.
 *
 * Flujo (cadena de responsabilidad):
 *   ValidationError        → 400 (con responseBody personalizado)
 *   InvalidUuidFormatError → 400
 *   TicketNotFoundError    → 404
 *   Error con .status      → status dinámico
 *   Error genérico         → 500
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 400 — Errores de validación con cuerpo personalizado
  if (err instanceof ValidationError) {
    res.status(400).json(err.responseBody);
    return;
  }

  // 400 — Formato de UUID inválido
  if (err instanceof InvalidUuidFormatError) {
    res.status(400).json({ error: err.message });
    return;
  }

  // 404 — Recurso no encontrado
  if (err instanceof TicketNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  // N — Errores con propiedad `status` inyectada (validaciones de servicio legacy)
  if ('status' in err && typeof (err as any).status === 'number') {
    res.status((err as any).status).json({ error: err.message });
    return;
  }

  // 500 — Error genérico / no controlado
  res.status(500).json({ error: 'Internal server error' });
}
