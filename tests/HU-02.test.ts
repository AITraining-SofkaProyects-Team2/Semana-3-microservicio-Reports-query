import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import type { Ticket, PaginatedResponse } from '../src/types';
import request from 'supertest';
import { createApp } from '../src/index';

vi.mock('../src/config/database', () => ({
  default: { query: vi.fn() },
}));
import pool from '../src/config/database';

/**
 * HU-02: Filtro por estado
 * Como operador, quiero filtrar tickets por su estado (RECEIVED, IN_PROGRESS)
 * para enfocarse en tickets específicos según su etapa de resolución.
 */

const makeTicket = (id: string, status: 'RECEIVED' | 'IN_PROGRESS', priority: any): Ticket => ({
  ticketId: id,
  lineNumber: `099${String(Number(id)).padStart(7, '0')}`,
  email: `client${id}@example.com`,
  type: 'OTHER',
  description: null,
  priority,
  status,
  createdAt: new Date().toISOString(),
  processedAt: null,
});

describe('HU-02 — Filtro por estado', () => {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // HU02-TC-001 — Filtro por estado retorna tickets filtrados
  // ─────────────────────────────────────────────────────────────────────────────
  describe('HU02-TC-001 — Filtro por estado retorna tickets filtrados', () => {
    it('Given existen tickets con estados RECEIVED e IN_PROGRESS, When se envía GET /api/tickets?status=RECEIVED, Then el código de respuesta es 200 (simulado) y el array "data" contiene solo tickets con status = "RECEIVED"', async () => {
      // Given: Preparar tickets con diferentes estados
      const tickets = [
        makeTicket('1', 'RECEIVED', 'HIGH'),
        makeTicket('2', 'IN_PROGRESS', 'MEDIUM'),
        makeTicket('3', 'RECEIVED', 'LOW'),
        makeTicket('4', 'IN_PROGRESS', 'HIGH'),
      ];

      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets.filter(t => t.status === 'RECEIVED'),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 2,
            totalPages: 1,
          },
        } as PaginatedResponse<Ticket>);

      // When: Solicitar tickets filtrados por status=RECEIVED
      const result = await service.getTickets({ status: 'RECEIVED' });

      // Then: Verificar que la respuesta contiene solo RECEIVED
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('Then el array "data" contiene solo tickets con status = "RECEIVED"', async () => {
      const tickets = [
        makeTicket('1', 'RECEIVED', 'HIGH'),
        makeTicket('2', 'IN_PROGRESS', 'MEDIUM'),
        makeTicket('3', 'RECEIVED', 'LOW'),
      ];

      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets.filter(t => t.status === 'RECEIVED'),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 2,
            totalPages: 1,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: 'RECEIVED' });

      result.data.forEach(ticket => {
        expect(ticket.status).toBe('RECEIVED');
      });
      expect(result.data.every(t => t.status === 'RECEIVED')).toBe(true);
    });

    it('Partición de equivalencia: Status RECEIVED válido', async () => {
      const tickets = [makeTicket('1', 'RECEIVED', 'HIGH'), makeTicket('2', 'RECEIVED', 'LOW')];

      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets,
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 2,
            totalPages: 1,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: 'RECEIVED' });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every(t => t.status === 'RECEIVED')).toBe(true);
    });

    it('Partición de equivalencia: Status IN_PROGRESS válido', async () => {
      const tickets = [makeTicket('1', 'IN_PROGRESS', 'HIGH')];

      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets,
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: 'IN_PROGRESS' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('IN_PROGRESS');
    });

    it('Partición de equivalencia: Múltiples estados (RECEIVED,IN_PROGRESS)', async () => {
      const tickets = [
        makeTicket('1', 'RECEIVED', 'HIGH'),
        makeTicket('2', 'IN_PROGRESS', 'MEDIUM'),
      ];

      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets,
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 2,
            totalPages: 1,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: ['RECEIVED', 'IN_PROGRESS'] });

      expect(result.data).toHaveLength(2);
      const statuses = new Set(result.data.map(t => t.status));
      expect(statuses.has('RECEIVED') || statuses.has('IN_PROGRESS')).toBe(true);
    });

    it('Integration: GET /api/tickets?status=RECEIVED retorna solo RECEIVED via controller', async () => {
      const tickets = [
        makeTicket('1', 'RECEIVED', 'HIGH'),
        makeTicket('3', 'RECEIVED', 'LOW'),
      ];
      // data query
      (pool.query as any).mockResolvedValueOnce({ rows: tickets.map(t => ({ ...t })) });
      // count query
      (pool.query as any).mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const app = createApp();
      const res = await request(app).get('/api/tickets?status=RECEIVED').expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.every((t: any) => t.status === 'RECEIVED')).toBe(true);
      expect(res.body.pagination.totalItems).toBe(2);
    });

    it('Valores límites: Todos los tickets coinciden con el filtro', async () => {
      const tickets = Array.from({ length: 20 }, (_, i) => makeTicket(String(i), 'RECEIVED', 'HIGH'));

      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets,
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 20,
            totalPages: 1,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: 'RECEIVED' });

      expect(result.data).toHaveLength(20);
      expect(result.data.every(t => t.status === 'RECEIVED')).toBe(true);
    });
  });

  // TC-008 — Filtrar por un solo estado válido
  describe('TC-008 — Filtrar por un solo estado válido', () => {
    it('Given existen tickets con diferentes estados, When se solicita RECEIVED, Then retorna solo RECEIVED', async () => {
      const tickets = [
        makeTicket('1', 'RECEIVED', 'HIGH'),
        makeTicket('2', 'IN_PROGRESS', 'MEDIUM'),
        makeTicket('3', 'RECEIVED', 'LOW'),
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: tickets.filter(t => t.status === 'RECEIVED'),
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 2,
          totalPages: 1,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: 'RECEIVED' });

      expect(result.data).toHaveLength(2);
      result.data.forEach(t => expect(t.status).toBe('RECEIVED'));
    });

    it('When se solicita IN_PROGRESS, Then retorna solo IN_PROGRESS', async () => {
      const tickets = [
        makeTicket('1', 'RECEIVED', 'HIGH'),
        makeTicket('2', 'IN_PROGRESS', 'MEDIUM'),
        makeTicket('3', 'RECEIVED', 'LOW'),
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: tickets.filter(t => t.status === 'IN_PROGRESS'),
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: 'IN_PROGRESS' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('IN_PROGRESS');
    });
  });

  // TC-009 — Filtrar por múltiples estados
  describe('TC-009 — Filtrar por múltiples estados simultáneamente', () => {
    it('When se solicitan RECEIVED e IN_PROGRESS, Then retorna ambos', async () => {
      const tickets = [
        makeTicket('1', 'RECEIVED', 'HIGH'),
        makeTicket('2', 'IN_PROGRESS', 'MEDIUM'),
        makeTicket('3', 'RECEIVED', 'LOW'),
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: tickets,
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 3,
          totalPages: 1,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: ['RECEIVED', 'IN_PROGRESS'] });

      const statuses = result.data.map(t => t.status);
      expect(statuses).toContain('RECEIVED');
      expect(statuses).toContain('IN_PROGRESS');
    });
  });

  // TC-010 — Combinar con otros filtros
  describe('TC-010 — Combinar filtro de estado con otros filtros', () => {
    it('When se combina status=IN_PROGRESS y priority=HIGH, Then retorna intersección', async () => {
      const tickets = [
        makeTicket('1', 'IN_PROGRESS', 'HIGH'),
        makeTicket('2', 'IN_PROGRESS', 'MEDIUM'),
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: [tickets[0]],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: 'IN_PROGRESS', priority: 'HIGH' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('IN_PROGRESS');
      expect(result.data[0].priority).toBe('HIGH');
    });
  });

  // TC-012 — Sin resultados
  describe('TC-012 — Filtrar por estado sin resultados coincidentes', () => {
    it('When no hay coincidencias, Then retorna lista vacía', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 0,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ status: 'IN_PROGRESS', priority: 'HIGH' });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
    });
  });
});

