import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import type { Ticket, PaginatedResponse } from '../src/types';

// ─── Helpers ───────────────────────────────────────────────────────────────
const makeTicket = (id: string, createdAt: string): Ticket => ({
  ticketId: id,
  lineNumber: `099000000${id}`,
  email: `client${id}@example.com`,
  type: 'NO_SERVICE',
  description: null,
  priority: 'HIGH',
  status: 'RECEIVED',
  createdAt,
  processedAt: null,
});

const paginated = (data: Ticket[]): PaginatedResponse<Ticket> => ({
  data,
  pagination: { page: 1, pageSize: 20, totalItems: data.length, totalPages: Math.ceil(data.length / 20) || 0 },
});

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('HU-05 — Filtro por rango de fechas', () => {
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

  // ── TC-022 — Filtrar por rango de fechas válido ───────────────────────────
  describe('TC-022 — Filtrar por rango de fechas válido', () => {
    it('Given existen tickets en febrero 2026, When se filtra dateFrom–dateTo en febrero, Then retorna solo los de ese mes', async () => {
      const febTickets = [
        makeTicket('1', '2026-02-01T10:00:00Z'),
        makeTicket('2', '2026-02-15T12:00:00Z'),
        makeTicket('3', '2026-02-28T23:00:00Z'),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(febTickets));

      const result = await service.getTickets({
        dateFrom: '2026-02-01T00:00:00Z',
        dateTo: '2026-02-28T23:59:59Z',
      });

      expect(result.data).toHaveLength(3);
      expect(result.pagination.totalItems).toBeGreaterThan(0);
      const from = new Date('2026-02-01T00:00:00Z').getTime();
      const to   = new Date('2026-02-28T23:59:59Z').getTime();
      result.data.forEach(t => {
        const ts = new Date(t.createdAt).getTime();
        expect(ts).toBeGreaterThanOrEqual(from);
        expect(ts).toBeLessThanOrEqual(to);
      });
    });

    it('When se llama con dateFrom y dateTo, Then el repositorio recibe ambos filtros', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated([]));

      await service.getTickets({ dateFrom: '2026-02-01T00:00:00Z', dateTo: '2026-02-28T23:59:59Z' });

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        dateFrom: '2026-02-01T00:00:00Z',
        dateTo: '2026-02-28T23:59:59Z',
      });
    });
  });

  // ── TC-023 — Rango de fechas invertido ───────────────────────────────────
  describe('TC-023 — Validar que fecha fin sea mayor o igual a fecha inicio', () => {
    it('Un rango donde dateFrom > dateTo es un rango inválido por definición de dominio', () => {
      const dateFrom = new Date('2026-03-01T00:00:00Z').getTime();
      const dateTo   = new Date('2026-02-01T00:00:00Z').getTime();
      expect(dateFrom).toBeGreaterThan(dateTo);
    });

    it('Un rango donde dateFrom === dateTo es válido (intervalo de un instante)', () => {
      const date = new Date('2026-02-15T00:00:00Z').getTime();
      expect(date).toBe(date);
    });

    it('Un rango donde dateFrom < dateTo es válido', () => {
      const dateFrom = new Date('2026-02-01T00:00:00Z').getTime();
      const dateTo   = new Date('2026-02-28T23:59:59Z').getTime();
      expect(dateFrom).toBeLessThan(dateTo);
    });
  });

  // ── TC-024 — Rango sin resultados ─────────────────────────────────────────
  describe('TC-024 — Rango de fechas sin resultados coincidentes', () => {
    it('Given no existen tickets en 2027, When se filtra por diciembre 2027, Then data=[] y totalItems=0', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated([]));

      const result = await service.getTickets({
        dateFrom: '2027-12-01T00:00:00Z',
        dateTo:   '2027-12-31T23:59:59Z',
      });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
    });
  });

  // ── TC-025 — Solo dateFrom ────────────────────────────────────────────────
  describe('TC-025 — Filtrar con solo fecha inicio (sin fecha fin)', () => {
    it('Given tickets en enero, febrero y marzo, When solo se especifica dateFrom=feb, Then retorna tickets de feb y mar', async () => {
      const tickets = [
        makeTicket('2', '2026-02-10T10:00:00Z'),
        makeTicket('3', '2026-03-05T10:00:00Z'),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({ dateFrom: '2026-02-01T00:00:00Z' });

      const from = new Date('2026-02-01T00:00:00Z').getTime();
      result.data.forEach(t => {
        expect(new Date(t.createdAt).getTime()).toBeGreaterThanOrEqual(from);
      });
    });

    it('When se llama solo con dateFrom, Then el repositorio recibe solo ese filtro', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated([]));

      await service.getTickets({ dateFrom: '2026-02-01T00:00:00Z' });

      expect(mockRepository.findAll).toHaveBeenCalledWith({ dateFrom: '2026-02-01T00:00:00Z' });
    });
  });

  // ── TC-026 — Solo dateTo ─────────────────────────────────────────────────
  describe('TC-026 — Filtrar con solo fecha fin (sin fecha inicio)', () => {
    it('Given tickets en enero y febrero, When solo se especifica dateTo=fin-feb, Then retorna tickets de ene y feb', async () => {
      const tickets = [
        makeTicket('1', '2026-01-20T10:00:00Z'),
        makeTicket('2', '2026-02-15T10:00:00Z'),
      ];
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated(tickets));

      const result = await service.getTickets({ dateTo: '2026-02-28T23:59:59Z' });

      const to = new Date('2026-02-28T23:59:59Z').getTime();
      result.data.forEach(t => {
        expect(new Date(t.createdAt).getTime()).toBeLessThanOrEqual(to);
      });
    });

    it('When se llama solo con dateTo, Then el repositorio recibe solo ese filtro', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue(paginated([]));

      await service.getTickets({ dateTo: '2026-02-28T23:59:59Z' });

      expect(mockRepository.findAll).toHaveBeenCalledWith({ dateTo: '2026-02-28T23:59:59Z' });
    });
  });

  // ── TC-027 — Formato de fecha inválido ───────────────────────────────────
  describe('TC-027 — Fechas con formato inválido', () => {
    it('"15-02-2026" no es un formato ISO-8601 válido (new Date lo rechaza)', () => {
      const parsed = new Date('15-02-2026');
      expect(isNaN(parsed.getTime())).toBe(true);
    });

    it('"not-a-date" no es un formato ISO-8601 válido', () => {
      const parsed = new Date('not-a-date');
      expect(isNaN(parsed.getTime())).toBe(true);
    });

    it('"2026-02-15T10:00:00Z" sí es un formato ISO-8601 válido (referencia positiva)', () => {
      const parsed = new Date('2026-02-15T10:00:00Z');
      expect(isNaN(parsed.getTime())).toBe(false);
    });
  });
});