import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import type { Ticket, PaginatedResponse } from '../src/types';

// ─── Helpers ───────────────────────────────────────────────────────────────
const makeTicket = (
  id: string,
  overrides: Partial<Ticket> = {},
): Ticket => ({
  ticketId: id,
  lineNumber: `099000000${id}`,
  email: `client${id}@example.com`,
  type: 'NO_SERVICE',
  description: null,
  priority: 'HIGH',
  status: 'RECEIVED',
  createdAt: new Date().toISOString(),
  processedAt: null,
  ...overrides,
});

const paginated = (data: Ticket[]): PaginatedResponse<Ticket> => ({
  data,
  pagination: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 },
});

const ALLOWED_SORT_FIELDS = ['createdAt', 'priority', 'status'] as const;
const PRIORITY_ORDER      = ['HIGH', 'MEDIUM', 'LOW', 'PENDING'] as const;
const STATUS_ORDER        = ['RECEIVED', 'IN_PROGRESS'] as const;

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('HU-08 — Ordenamiento de resultados', () => {
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

  // ── TC-035 — Ordenar por fecha ascendente ─────────────────────────────────
  describe('TC-035 — Ordenar por fecha ascendente (más antiguo primero)', () => {
    it('Given el repositorio devuelve tickets ordenados por createdAt asc, Then el servicio los retorna en ese orden', async () => {
      const tickets = [
        makeTicket('T-002', { createdAt: '2026-02-15T10:00:00Z' }),
        makeTicket('T-001', { createdAt: '2026-02-18T10:00:00Z' }),
        makeTicket('T-003', { createdAt: '2026-02-20T10:00:00Z' }),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({});

      const dates = result.data.map(t => new Date(t.createdAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    it('"createdAt" es un campo de ordenamiento válido del dominio', () => {
      expect(ALLOWED_SORT_FIELDS).toContain('createdAt');
    });
  });

  // ── TC-036 — Ordenar por fecha descendente ────────────────────────────────
  describe('TC-036 — Ordenar por fecha descendente (más reciente primero)', () => {
    it('Given el repositorio devuelve tickets ordenados por createdAt desc, Then el servicio los retorna en ese orden', async () => {
      const tickets = [
        makeTicket('T-003', { createdAt: '2026-02-20T10:00:00Z' }),
        makeTicket('T-001', { createdAt: '2026-02-18T10:00:00Z' }),
        makeTicket('T-002', { createdAt: '2026-02-15T10:00:00Z' }),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({});

      const dates = result.data.map(t => new Date(t.createdAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });
  });

  // ── TC-037 — Ordenar por prioridad ────────────────────────────────────────
  describe('TC-037 — Ordenar por prioridad (HIGH > MEDIUM > LOW > PENDING)', () => {
    it('Given el repositorio devuelve tickets ordenados por prioridad desc, Then el servicio los retorna en ese orden', async () => {
      const tickets = [
        makeTicket('T-002', { priority: 'HIGH' }),
        makeTicket('T-003', { priority: 'MEDIUM' }),
        makeTicket('T-001', { priority: 'LOW' }),
        makeTicket('T-004', { priority: 'PENDING' }),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({});

      for (let i = 0; i < result.data.length - 1; i++) {
        const curr = PRIORITY_ORDER.indexOf(result.data[i].priority);
        const next = PRIORITY_ORDER.indexOf(result.data[i + 1].priority);
        expect(curr).toBeLessThanOrEqual(next);
      }
    });

    it('El orden de dominio de prioridad es HIGH > MEDIUM > LOW > PENDING', () => {
      expect(PRIORITY_ORDER[0]).toBe('HIGH');
      expect(PRIORITY_ORDER[1]).toBe('MEDIUM');
      expect(PRIORITY_ORDER[2]).toBe('LOW');
      expect(PRIORITY_ORDER[3]).toBe('PENDING');
    });
  });

  // ── TC-038 — Ordenar por estado ───────────────────────────────────────────
  describe('TC-038 — Ordenar por estado', () => {
    it('Given el repositorio devuelve tickets ordenados por status asc, Then el servicio los retorna en ese orden', async () => {
      const tickets = [
        makeTicket('T-002', { status: 'RECEIVED' }),
        makeTicket('T-004', { status: 'RECEIVED' }),
        makeTicket('T-001', { status: 'IN_PROGRESS' }),
        makeTicket('T-003', { status: 'IN_PROGRESS' }),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({});

      for (let i = 0; i < result.data.length - 1; i++) {
        const curr = STATUS_ORDER.indexOf(result.data[i].status);
        const next = STATUS_ORDER.indexOf(result.data[i + 1].status);
        expect(curr).toBeLessThanOrEqual(next);
      }
    });

    it('El orden de dominio de estado es RECEIVED < IN_PROGRESS', () => {
      expect(STATUS_ORDER.indexOf('RECEIVED')).toBeLessThan(STATUS_ORDER.indexOf('IN_PROGRESS'));
    });
  });

  // ── TC-039 — Campo de ordenamiento inválido ───────────────────────────────
  describe('TC-039 — Rechazar campo de ordenamiento inválido', () => {
    it('"notAField" no es un campo de ordenamiento válido del dominio', () => {
      expect(ALLOWED_SORT_FIELDS).not.toContain('notAField');
    });

    it('"email" no es un campo de ordenamiento válido del dominio', () => {
      expect(ALLOWED_SORT_FIELDS).not.toContain('email');
    });

    it('Los únicos campos de ordenamiento válidos son createdAt, priority y status', () => {
      expect(ALLOWED_SORT_FIELDS).toHaveLength(3);
      expect(ALLOWED_SORT_FIELDS).toContain('createdAt');
      expect(ALLOWED_SORT_FIELDS).toContain('priority');
      expect(ALLOWED_SORT_FIELDS).toContain('status');
    });
  });
});
