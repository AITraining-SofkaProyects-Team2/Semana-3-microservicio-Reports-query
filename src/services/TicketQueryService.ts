import { ITicketRepository } from '../repositories/ITicketRepository';
import { Ticket, TicketFilters, TicketStatus, PaginatedResponse, VALID_STATUSES, VALID_INCIDENT_TYPES } from '../types';
import { TicketNotFoundError } from '../errors/TicketNotFoundError';
import { InvalidUuidFormatError } from '../errors/InvalidUuidFormatError';
import { InvalidTicketStatusError } from '../errors/InvalidTicketStatusError';
import { ValidationError } from '../errors/ValidationError';
import { VALID_PRIORITIES } from '../utils/priorityUtils';
import { ALLOWED_SORT_FIELDS } from '../types/allowedSortFields';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINE_NUMBER_REGEX = /^\d{10}$/;
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const VALID_SORT_ORDERS = ['asc', 'desc'] as const;

export class TicketQueryService {
  constructor(private readonly repository: ITicketRepository) {}

  async findById(ticketId: string): Promise<Ticket> {
    if (!UUID_V4_REGEX.test(ticketId)) {
      throw new InvalidUuidFormatError();
    }

    const ticket = await this.repository.findById(ticketId);

    if (ticket === null) {
      throw new TicketNotFoundError();
    }

    return ticket;
  }

  async getTickets(filters: TicketFilters): Promise<PaginatedResponse<Ticket>> {
    this.validateFilters(filters);
    return this.repository.findAll(filters);
  }

  async findByLineNumber(lineNumber: string): Promise<Ticket[]> {
    if (!LINE_NUMBER_REGEX.test(lineNumber)) {
      throw new ValidationError({
        error: `Número de línea inválido: debe tener exactamente 10 dígitos, se recibió "${lineNumber}"`,
      });
    }
    return this.repository.findByLineNumber(lineNumber);
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
    if (!UUID_V4_REGEX.test(ticketId)) {
      throw new InvalidUuidFormatError();
    }
    
    // Validar que el ticket existe antes de actualizar
    const ticket = await this.repository.findById(ticketId);
    if (ticket === null) {
      throw new TicketNotFoundError();
    }
    
    const VALID_STATUSES: TicketStatus[] = ['RECEIVED', 'IN_PROGRESS'];
    if (!VALID_STATUSES.includes(status)) {
      throw new InvalidTicketStatusError(status);
    }
    return this.repository.updateStatus(ticketId, status);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Validación exhaustiva de filtros de consulta
  // Cada parámetro inválido produce HTTP 400 con mensaje descriptivo.
  // ─────────────────────────────────────────────────────────────────────────

  private validateFilters(filters: TicketFilters): void {
    this.validatePriority(filters.priority);
    this.validateStatus(filters.status);
    this.validateIncidentType(filters.type);
    this.validateDates(filters.dateFrom, filters.dateTo);
    this.validatePagination(filters.page, filters.limit);
    this.validateSort(filters.sortBy, filters.sortOrder);
  }

  private validatePriority(priority: TicketFilters['priority']): void {
    if (priority === undefined) return;
    if (!(VALID_PRIORITIES as readonly string[]).includes(priority as string)) {
      throw new ValidationError({
        error: `La prioridad "${priority}" no es una prioridad válida. Prioridad válida: ${VALID_PRIORITIES.join(', ')}`,
      });
    }
  }

  private validateStatus(status: TicketFilters['status']): void {
    if (status === undefined) return;
    const statuses = Array.isArray(status) ? status : [status];
    for (const s of statuses) {
      if (!(VALID_STATUSES as readonly string[]).includes(s as string)) {
        throw new ValidationError({
          error: `"${s}" no es un estado válido`,
          message: `"${s}" no es un estado válido`,
          validValues: [...VALID_STATUSES],
        });
      }
    }
  }

  private validateIncidentType(type: TicketFilters['type']): void {
    if (type === undefined || (type as string) === '') return;
    if (!(VALID_INCIDENT_TYPES as readonly string[]).includes(type as string)) {
      throw new ValidationError({
        error: `El tipo de incidente "${type}" no es válido`,
        message: `El tipo de incidente "${type}" no es válido`,
      });
    }
  }

  private validateDates(dateFrom?: string, dateTo?: string): void {
    if (dateFrom !== undefined) {
      if (!ISO_8601_REGEX.test(dateFrom) || isNaN(new Date(dateFrom).getTime())) {
        throw new ValidationError({
          error: 'Formato de fecha inválido para dateFrom. Use formato ISO-8601.',
        });
      }
    }

    if (dateTo !== undefined) {
      if (!ISO_8601_REGEX.test(dateTo) || isNaN(new Date(dateTo).getTime())) {
        throw new ValidationError({
          error: 'Formato de fecha inválido para dateTo. Use formato ISO-8601.',
        });
      }
    }

    if (dateFrom && dateTo) {
      if (new Date(dateFrom) > new Date(dateTo)) {
        throw new ValidationError({
          error: 'dateTo debe ser mayor o igual a dateFrom',
        });
      }
    }
  }

  private validatePagination(page?: number, limit?: number): void {
    if (page !== undefined && (isNaN(page) || page < 1 || !Number.isInteger(page))) {
      throw new ValidationError({
        error: 'El parámetro "page" debe ser un entero positivo',
      });
    }
    if (limit !== undefined && (isNaN(limit) || limit < 1 || !Number.isInteger(limit))) {
      throw new ValidationError({
        error: 'El parámetro "limit" debe ser un entero positivo',
      });
    }
  }

  private validateSort(sortBy?: string, sortOrder?: string): void {
    if (sortBy !== undefined) {
      if (!(ALLOWED_SORT_FIELDS as readonly string[]).includes(sortBy)) {
        throw new ValidationError({
          error: `Campo de ordenamiento inválido: ${sortBy}. Campos válidos: ${ALLOWED_SORT_FIELDS.join(', ')}.`,
        });
      }
    }
    if (sortOrder !== undefined) {
      if (!(VALID_SORT_ORDERS as readonly string[]).includes(sortOrder as any)) {
        throw new ValidationError({
          error: `Orden de ordenamiento inválido: ${sortOrder}. Valores válidos: asc, desc.`,
        });
      }
    }
  }
}

