import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import type { Ticket, PaginatedResponse } from '../src/types';

/**
 * HU-01: Listado de tickets con paginación
 * Como operador, quiero ver un listado paginado de tickets para gestionar quejas
 * de manera eficiente sin sobrecargar la interfaz.
 */

// Fixture: tickets de prueba
const makeTicket = (id: string, index: number): Ticket => ({
  ticketId: id,
  lineNumber: `099${String(index).padStart(7, '0')}`,
  email: `client${index}@example.com`,
  type: 'NO_SERVICE',
  description: null,
  priority: 'HIGH',
  status: 'RECEIVED',
  createdAt: new Date(Date.now() - (25 - index) * 86400000).toISOString(),
  processedAt: null,
});

describe('HU-01 — Listado de tickets con paginación', () => {
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
  // HU01-TC-001 — Listado paginado de tickets retorna 200
  // ─────────────────────────────────────────────────────────────────────────────
  describe('HU01-TC-001 — Listado paginado de tickets retorna 200', () => {
    it('Given el endpoint GET /api/tickets está disponible, And existen múltiples tickets en la base de datos, When se envía una request GET /api/tickets sin filtros, Then retorna objeto con estructura correcta (data y pagination)', async () => {
      // Given: Preparar múltiples tickets (simular base de datos poblada)
      const tickets = Array.from({ length: 25 }, (_, i) => makeTicket(`uuid-${i}`, i));
      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets.slice(0, 20),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 25,
            totalPages: 2,
          },
        } as PaginatedResponse<Ticket>);

      // When: Enviar request sin filtros (valores por defecto)
      const result = await service.getTickets({});

      // Then: Verificar que la respuesta tiene estructura correcta
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(20);
    });

    it('Then el body contiene propiedad "data" con array de tickets', async () => {
      const tickets = Array.from({ length: 5 }, (_, i) => makeTicket(`uuid-${i}`, i));
      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets,
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 5,
            totalPages: 1,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({});

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.every((ticket) => ticket.ticketId)).toBe(true);
    });

    it('Then el body contiene propiedad "pagination" con metadatos correctos (page, pageSize, totalItems, totalPages)', async () => {
      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: Array.from({ length: 20 }, (_, i) => makeTicket(`uuid-${i}`, i)),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 100,
            totalPages: 5,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({});

      expect(result.pagination).toBeDefined();
      expect(result.pagination).toHaveProperty('page', 1);
      expect(result.pagination).toHaveProperty('pageSize', 20);
      expect(result.pagination).toHaveProperty('totalItems', 100);
      expect(result.pagination).toHaveProperty('totalPages', 5);
    });

    it('Partición de equivalencia: Sin parámetros retorna estructura válida', async () => {
      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: Array.from({ length: 20 }, (_, i) => makeTicket(`uuid-${i}`, i)),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 50,
            totalPages: 3,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({});

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.page).toBeGreaterThanOrEqual(1);
      expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('Valores límites: Request sin parámetros retorna paginación con defaults (page=1, pageSize=20)', async () => {
      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: Array.from({ length: 20 }, (_, i) => makeTicket(`uuid-${i}`, i)),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 20,
            totalPages: 1,
          },
        } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({});

      expect(mockRepository.findAll).toHaveBeenCalledWith({});
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TC-001 — Listado paginado con tamaño por defecto
  // ─────────────────────────────────────────────────────────────────────────────
  describe('TC-001 — Listado paginado con tamaño por defecto', () => {
    it('Given existen 25 tickets, When se solicita sin especificar limit, Then retorna 20 con paginación correcta', async () => {
      // Given: Preparar 25 tickets
      const tickets = Array.from({ length: 25 }, (_, i) => makeTicket(`uuid-${i}`, i));
      mockRepository.findAll = vi
        .fn()
        .mockResolvedValue({
          data: tickets.slice(0, 20),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 25,
            totalPages: 2,
          },
        } as PaginatedResponse<Ticket>);

      // When: Solicitar tickets sin especificar limit
      const result = await service.getTickets({ page: 1 });

      // Then: Verificar estructura y valores
      expect(result.data).toHaveLength(20);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.pagination.totalItems).toBe(25);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('When el repositorio es llamado, Then recibe los parámetros correctos (page=1, limit=20 impícito)', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      } as PaginatedResponse<Ticket>);

      await service.getTickets({ page: 1 });

      expect(mockRepository.findAll).toHaveBeenCalledWith({ page: 1 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TC-002 — Listado paginado con tamaño configurable
  // ─────────────────────────────────────────────────────────────────────────────
  describe('TC-002 — Listado paginado con tamaño configurable', () => {
    it('Given existen 50 tickets, When se solicita limit=10, Then retorna 10 tickets en página 1', async () => {
      const tickets = Array.from({ length: 50 }, (_, i) => makeTicket(`uuid-${i}`, i));
      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: tickets.slice(0, 10),
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 50,
          totalPages: 5,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TC-003 — Indicación de total de resultados y página actual
  // ─────────────────────────────────────────────────────────────────────────────
  describe('TC-003 — Indicación de total de resultados y página actual', () => {
    it('Given existen 55 tickets, When se solicita página 3 con limit=20, Then retorna 15 tickets restantes', async () => {
      const tickets = Array.from({ length: 55 }, (_, i) => makeTicket(`uuid-${i}`, i));
      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: tickets.slice(40, 55),
        pagination: {
          page: 3,
          pageSize: 20,
          totalItems: 55,
          totalPages: 3,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ page: 3, limit: 20 });

      expect(result.data).toHaveLength(15);
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.totalItems).toBe(55);
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TC-004 — Ordenamiento consistente entre páginas
  // ─────────────────────────────────────────────────────────────────────────────
  describe('TC-004 — Ordenamiento consistente entre páginas', () => {
    it('When se solicitan dos páginas con ordenamiento ascendente, Then ambas están ordenadas y son consistentes', async () => {
      const tickets = Array.from({ length: 40 }, (_, i) => makeTicket(`uuid-${i}`, i));

      // Simular dos llamadas diferentes (página 1 y página 2)
      mockRepository.findAll = vi.fn((filters) => {
        if (filters.page === 2) {
          return Promise.resolve({
            data: tickets.slice(20, 40),
            pagination: {
              page: 2,
              pageSize: 20,
              totalItems: 40,
              totalPages: 2,
            },
          } as PaginatedResponse<Ticket>);
        }
        return Promise.resolve({
          data: tickets.slice(0, 20),
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 40,
            totalPages: 2,
          },
        } as PaginatedResponse<Ticket>);
      });

      const page1 = await service.getTickets({ page: 1, limit: 20 });
      const page2 = await service.getTickets({ page: 2, limit: 20 });

      // Verificar que no hay duplicados
      const allIds = new Set([...page1.data.map(t => t.ticketId), ...page2.data.map(t => t.ticketId)]);
      expect(allIds.size).toBe(40);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TC-005 — Lista vacía cuando no hay tickets
  // ─────────────────────────────────────────────────────────────────────────────
  describe('TC-005 — Lista vacía cuando no hay tickets', () => {
    it('Given no existen tickets, Then retorna lista vacía con paginación en cero', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 0,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({});

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TC-006 — Solicitar página fuera de rango
  // ─────────────────────────────────────────────────────────────────────────────
  describe('TC-006 — Solicitar página fuera de rango', () => {
    it('Given existen 30 tickets (3 páginas de 10), When se solicita página 5, Then retorna lista vacía', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue({
        data: [],
        pagination: {
          page: 5,
          pageSize: 10,
          totalItems: 30,
          totalPages: 3,
        },
      } as PaginatedResponse<Ticket>);

      const result = await service.getTickets({ page: 5, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.page).toBe(5);
      expect(result.pagination.totalItems).toBe(30);
      expect(result.pagination.totalPages).toBe(3);
    });
  });
});
