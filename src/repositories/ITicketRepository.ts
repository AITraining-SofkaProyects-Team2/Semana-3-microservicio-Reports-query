import { Ticket, TicketFilters, TicketStatus, PaginatedResponse } from '../types';

export interface ITicketRepository {
  findAll(filters: TicketFilters): Promise<PaginatedResponse<Ticket>>;
  findById(ticketId: string): Promise<Ticket | null>;
  findByLineNumber(lineNumber: string): Promise<Ticket[]>;
  getMetrics(): Promise<Record<string, unknown>>;
  updateStatus(ticketId: string, status: TicketStatus): Promise<Ticket>;
}

