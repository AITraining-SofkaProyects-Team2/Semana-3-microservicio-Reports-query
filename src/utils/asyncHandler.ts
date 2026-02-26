import { Request, Response, NextFunction } from 'express';

/**
 * Wrapper para handlers async de Express.
 * Captura errores de funciones async y los delega a next()
 * para que sean procesados por el middleware centralizado de errores.
 *
 * Esto permite que los controladores NO usen try-catch,
 * delegando el manejo de errores al Chain of Responsibility (errorHandler).
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};
