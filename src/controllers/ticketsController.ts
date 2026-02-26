import { Request, Response } from 'express';
import { TicketQueryService } from '../services/TicketQueryService';
import { TicketFilters } from '../types';
import { TicketNotFoundError } from '../errors/TicketNotFoundError';
import { InvalidUuidFormatError } from '../errors/InvalidUuidFormatError';
import { InvalidTicketStatusError } from '../errors/InvalidTicketStatusError';

export class TicketsController {
  constructor(private readonly queryService: TicketQueryService) {}

  async getTickets(req: Request, res: Response): Promise<void> {
    try {
      const { status, priority, type, dateFrom, dateTo, page = '1', limit = '20' } = req.query;
      const filters: TicketFilters = {
        status: status as TicketFilters['status'],
        priority: priority as TicketFilters['priority'],
        type: type as TicketFilters['type'],
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      };
      const result = await this.queryService.getTickets(filters);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
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