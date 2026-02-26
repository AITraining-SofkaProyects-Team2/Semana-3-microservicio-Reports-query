import { Router } from 'express';
import { TicketsController } from '../controllers/ticketsController';
import { TicketQueryService } from '../services/TicketQueryService';
import { TicketRepository } from '../repositories/TicketRepository';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const repository = new TicketRepository();
const service = new TicketQueryService(repository);
const controller = new TicketsController(service);

/**
 * Rutas de Tickets (montadas bajo /api/tickets)
 *
 * Todos los endpoints son de LECTURA (GET) ya que este es un
 * microservicio de consulta (Query Service / CQRS read-side).
 *
 * Orden de declaración importante:
 *   1. Rutas con path fijo (/, /line/:lineNumber) primero.
 *   2. Ruta con parámetro dinámico (/:ticketId) al FINAL
 *      para evitar que capture paths como "/line" o "/metrics".
 */

// GET /api/tickets — Listado paginado con filtros opcionales
router.get('/', asyncHandler((req, res, next) => controller.getTickets(req, res)));

// GET /api/tickets/line/:lineNumber — Búsqueda por número de línea del cliente
router.get('/line/:lineNumber', asyncHandler((req, res, next) => controller.getTicketsByLineNumber(req, res)));

// GET /api/tickets/:ticketId — Búsqueda por ID único (UUID) del ticket
router.get('/:ticketId', asyncHandler((req, res, next) => controller.getTicketById(req, res)));

export default router;
