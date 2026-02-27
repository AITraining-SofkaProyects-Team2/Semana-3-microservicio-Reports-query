/**
 * Re-exporta todos los tipos y constantes desde Ticket.ts
 * Esta es la única fuente de verdad para tipos en reports-query
 */
export type {
  IncidentType,
  TicketPriority,
  TicketStatus,
  Ticket,
  PaginationMetadata,
  PaginatedResponse,
  TicketFilters,
} from './Ticket';

export {
  VALID_INCIDENT_TYPES,
  VALID_STATUSES,
} from './Ticket';

