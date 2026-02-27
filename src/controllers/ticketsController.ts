import { Request, Response } from 'express';
import { TicketQueryService } from '../services/TicketQueryService';
import { TicketFilters } from '../types';
import { TicketNotFoundError } from '../errors/TicketNotFoundError';
import { InvalidUuidFormatError } from '../errors/InvalidUuidFormatError';
import { InvalidTicketStatusError } from '../errors/InvalidTicketStatusError';

/**
 * Controlador delgado para operaciones de lectura sobre tickets.
 *
 * Responsabilidades:
 * - Extraer parámetros del request HTTP.
 * - Delegar la lógica al servicio (TicketQueryService).
 * - Retornar la respuesta HTTP adecuada.
 *
 * NO incluye try-catch: los errores se propagan al middleware
 * centralizado de errores (errorHandler) via asyncHandler.
 */
export class TicketsController {
  constructor(private readonly queryService: TicketQueryService) {}

  /**
   * GET /api/tickets
   * Lista tickets con filtros, paginación y ordenamiento.
   */
  async getTickets(req: Request, res: Response): Promise<void> {
    const { status, priority, type, incidentType, dateFrom, dateTo, page = '1', limit = '20', sortBy, sortOrder } = req.query;
    const filters: TicketFilters = {
      status: status as TicketFilters['status'],
      priority: priority as TicketFilters['priority'],
      type: (incidentType || type) as TicketFilters['type'],
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as string | undefined,
    };
    const result = await this.queryService.getTickets(filters);
    res.status(200).json(result);
  }

  /**
   * GET /api/tickets/:ticketId
   * Obtiene un ticket específico por su UUID.
   */
  async getTicketById(req: Request, res: Response): Promise<void> {
    const { ticketId } = req.params;
    const ticket = await this.queryService.findById(ticketId);
    res.status(200).json(ticket);
  }

  /**
   * GET /api/tickets/line/:lineNumber
   * Busca todos los tickets asociados a un número de línea.
   */
  async getTicketsByLineNumber(req: Request, res: Response): Promise<void> {
    const { lineNumber } = req.params;
    const tickets = await this.queryService.findByLineNumber(lineNumber);
    res.status(200).json({ data: tickets });
  }

  async updateTicketStatus(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;
      const result = await this.queryService.updateTicketStatus(ticketId, status);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({ error: error.message });
      } else if (error instanceof InvalidUuidFormatError || error instanceof InvalidTicketStatusError) {
        res.status(400).json({ error: (error as Error).message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}