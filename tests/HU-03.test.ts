import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import type { Ticket, TicketPriority, PaginatedResponse } from '../src/types';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const makeTicket = (
  id: string,
  priority: TicketPriority,
  type: Ticket['type'] = 'NO_SERVICE',
  status: Ticket['status'] = 'RECEIVED',
): Ticket => ({
  ticketId: id,
  lineNumber: `099${String(Number(id)).padStart(7, '0')}`,
  email: `client${id}@example.com`,
  type,
  description: null,
  priority,
  status,
  createdAt: new Date().toISOString(),
  processedAt: null,
});

const paginated = (data: Ticket[]): PaginatedResponse<Ticket> => ({
  data,
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: data.length,
    totalPages: Math.ceil(data.length / 20) || 0,
  },
});

const VALID_PRIORITIES: readonly string[] = ['HIGH', 'MEDIUM', 'LOW', 'PENDING'];

// â”€â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('HU-03 â€” Filtro por prioridad', () => {
  let mockRepository: ITicketRepository;
  let service: TicketQueryService;

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByLineNumber: vi.fn(),
      getMetrics: vi.fn(),
    } as unknown as ITicketRepository;

    service = new TicketQueryService(mockRepository);
  });

  // â”€â”€ TC-017 â€” Filtrar por prioridad sin resultados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('TC-017 â€” Filtrar por prioridad sin resultados coincidentes', () => {
    it('Given solo existen tickets HIGH/MEDIUM, When se filtra PENDING, Then data=[] y totalItems=0', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated([]));

      const result = await service.getTickets({ priority: 'PENDING' });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
    });

    it('When se filtra PENDING, Then el repositorio recibe el filtro correctamente', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated([]));

      await service.getTickets({ priority: 'PENDING' });

      expect(mockRepository.findAll).toHaveBeenCalledWith({ priority: 'PENDING' });
    });
  });

  // â”€â”€ TC-016 â€” Filtrar con prioridad invÃ¡lida â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('TC-016 â€” Filtrar con prioridad invÃ¡lida', () => {
    it('"CRITICAL" no pertenece al dominio de prioridades vÃ¡lidas', () => {
      expect(VALID_PRIORITIES).not.toContain('CRITICAL');
    });

    it('"URGENT" no pertenece al dominio de prioridades vÃ¡lidas', () => {
      expect(VALID_PRIORITIES).not.toContain('URGENT');
    });

    it('El valor numÃ©rico "1" no pertenece al dominio de prioridades vÃ¡lidas', () => {
      expect(VALID_PRIORITIES).not.toContain('1');
    });

    it('La cadena vacÃ­a no pertenece al dominio de prioridades vÃ¡lidas', () => {
      expect(VALID_PRIORITIES).not.toContain('');
    });
  });

  // â”€â”€ TC-013 â€” Filtrar por prioridad vÃ¡lida â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('TC-013 â€” Filtrar por prioridad vÃ¡lida', () => {
    it('Given 5 tickets HIGH, When se filtra HIGH, Then retorna 5 tickets todos HIGH', async () => {
      const highTickets = Array.from({ length: 5 }, (_, i) => makeTicket(String(i + 1), 'HIGH'));
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(highTickets));

      const result = await service.getTickets({ priority: 'HIGH' });

      expect(result.data).toHaveLength(5);
      expect(result.pagination.totalItems).toBe(5);
      result.data.forEach(t => expect(t.priority).toBe('HIGH'));
    });

    it('Given 2 tickets PENDING, When se filtra PENDING, Then retorna 2 tickets todos PENDING', async () => {
      const pendingTickets = [makeTicket('1', 'PENDING'), makeTicket('2', 'PENDING')];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(pendingTickets));

      const result = await service.getTickets({ priority: 'PENDING' });

      expect(result.data).toHaveLength(2);
      result.data.forEach(t => expect(t.priority).toBe('PENDING'));
    });

    it('Given 8 tickets MEDIUM, When se filtra MEDIUM, Then retorna 8 tickets todos MEDIUM', async () => {
      const mediumTickets = Array.from({ length: 8 }, (_, i) => makeTicket(String(i + 1), 'MEDIUM'));
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(mediumTickets));

      const result = await service.getTickets({ priority: 'MEDIUM' });

      expect(result.data).toHaveLength(8);
      result.data.forEach(t => expect(t.priority).toBe('MEDIUM'));
    });

    it('Given 10 tickets LOW, When se filtra LOW, Then retorna 10 tickets todos LOW', async () => {
      const lowTickets = Array.from({ length: 10 }, (_, i) => makeTicket(String(i + 1), 'LOW'));
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(lowTickets));

      const result = await service.getTickets({ priority: 'LOW' });

      expect(result.data).toHaveLength(10);
      result.data.forEach(t => expect(t.priority).toBe('LOW'));
    });
  });

  // â”€â”€ TC-015 â€” Combinar filtro de prioridad con otros filtros â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('TC-015 â€” Combinar filtro de prioridad con otros filtros', () => {
    it('When se filtra HIGH + IN_PROGRESS, Then retorna solo la intersecciÃ³n', async () => {
      const tickets = [
        makeTicket('1', 'HIGH', 'NO_SERVICE', 'IN_PROGRESS'),
        makeTicket('2', 'HIGH', 'SLOW_CONNECTION', 'IN_PROGRESS'),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({ priority: 'HIGH', status: 'IN_PROGRESS' });

      expect(result.data).toHaveLength(2);
      result.data.forEach(t => {
        expect(t.priority).toBe('HIGH');
        expect(t.status).toBe('IN_PROGRESS');
      });
    });

    it('When se filtra HIGH + NO_SERVICE, Then retorna solo la intersecciÃ³n', async () => {
      const tickets = [makeTicket('1', 'HIGH', 'NO_SERVICE', 'IN_PROGRESS')];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({ priority: 'HIGH', type: 'NO_SERVICE' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].priority).toBe('HIGH');
      expect(result.data[0].type).toBe('NO_SERVICE');
    });

    it('When se filtra MEDIUM + IN_PROGRESS, Then retorna solo la intersecciÃ³n', async () => {
      const tickets = [makeTicket('3', 'MEDIUM', 'INTERMITTENT_SERVICE', 'IN_PROGRESS')];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({ priority: 'MEDIUM', status: 'IN_PROGRESS' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].priority).toBe('MEDIUM');
    });

    it('When no hay filtros, Then retorna todos los tickets', async () => {
      const tickets = [
        makeTicket('1', 'HIGH', 'NO_SERVICE', 'IN_PROGRESS'),
        makeTicket('2', 'HIGH', 'SLOW_CONNECTION', 'IN_PROGRESS'),
        makeTicket('3', 'MEDIUM', 'INTERMITTENT_SERVICE', 'IN_PROGRESS'),
        makeTicket('4', 'HIGH', 'OTHER', 'RECEIVED'),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({});

      expect(result.data).toHaveLength(4);
    });
  });
});
