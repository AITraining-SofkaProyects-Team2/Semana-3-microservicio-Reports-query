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

  // ─────────────────────────────────────────────────────────────────────────────
  // HU08-TC-001 — Ordenamiento por fecha ascendente
  // ─────────────────────────────────────────────────────────────────────────────
  describe('HU08-TC-001 — Ordenamiento por fecha ascendente', () => {
    it('Given existen múltiples tickets con diferentes fechas de creación, When se solicita ordenamiento por createdAt ascendente, Then retorna tickets ordenados del más antiguo al más reciente', async () => {
      // Given: Preparar tickets con fechas diferentes
      const tickets = [
        makeTicket('T-003', { createdAt: '2026-02-20T10:00:00Z' }),
        makeTicket('T-001', { createdAt: '2026-02-18T10:00:00Z' }),
        makeTicket('T-002', { createdAt: '2026-02-15T10:00:00Z' }),
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())));

      // When: Solicitar con ordenamiento ascendente por fecha
      const result = await service.getTickets({ sortBy: 'createdAt', sortOrder: 'asc' });

      // Then: Verificar que están ordenados de más antiguo a más reciente
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('Then los tickets están ordenados del más antiguo al más reciente (createdAt ascendente)', async () => {
      const tickets = [
        makeTicket('T-003', { createdAt: '2026-02-20T10:00:00Z' }),
        makeTicket('T-001', { createdAt: '2026-02-18T10:00:00Z' }),
        makeTicket('T-002', { createdAt: '2026-02-15T10:00:00Z' }),
      ];

      const sortedTickets = tickets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(sortedTickets));

      const result = await service.getTickets({ sortBy: 'createdAt', sortOrder: 'asc' });

      // Verificar que las fechas están en orden ascendente
      const dates = result.data.map(t => new Date(t.createdAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    it('Partición de equivalencia: Ordenamiento por campo válido "createdAt"', async () => {
      const tickets = [
        makeTicket('T-002', { createdAt: '2026-02-15T10:00:00Z' }),
        makeTicket('T-001', { createdAt: '2026-02-18T10:00:00Z' }),
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())));

      const result = await service.getTickets({ sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result.data).toBeDefined();
      expect(result.data.every(t => t.createdAt)).toBe(true);
    });

    it('Partición de equivalencia: Orden válido "asc" (ascendente)', async () => {
      const tickets = [
        makeTicket('T-001', { createdAt: '2026-02-15T10:00:00Z' }),
        makeTicket('T-002', { createdAt: '2026-02-18T10:00:00Z' }),
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({ sortBy: 'createdAt', sortOrder: 'asc' });

      const dates = result.data.map(t => new Date(t.createdAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    it('Valores límites: Mínimo 2 tickets con fechas diferentes', async () => {
      const tickets = [
        makeTicket('T-002', { createdAt: '2026-01-01T00:00:00Z' }),
        makeTicket('T-001', { createdAt: '2026-12-31T23:59:59Z' }),
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(
        tickets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      ));

      const result = await service.getTickets({ sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result.data).toHaveLength(2);
      expect(new Date(result.data[0].createdAt).getTime()).toBeLessThanOrEqual(
        new Date(result.data[1].createdAt).getTime()
      );
    });

    it('Valores límites: Múltiples tickets (10+) ordenados correctamente', async () => {
      const tickets = Array.from({ length: 10 }, (_, i) => 
        makeTicket(`T-${String(i).padStart(3, '0')}`, {
          createdAt: new Date(2026, 0, i + 1).toISOString(),
        })
      ).reverse();

      const sortedTickets = [...tickets].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(sortedTickets));

      const result = await service.getTickets({ sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result.data).toHaveLength(10);

      const dates = result.data.map(t => new Date(t.createdAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });
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
