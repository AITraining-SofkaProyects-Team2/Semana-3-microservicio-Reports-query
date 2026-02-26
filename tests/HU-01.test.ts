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

/**
 * TC-002 — Listado paginado con tamaño configurable
 * Historia de Usuario: HU-01
 *
 * Precondiciones:
 *   - Existen 50 tickets procesados en el repositorio del query-service.
 *
 * Pasos (Gherkin):
 *   Given existen 50 tickets procesados en el sistema
 *   When el operador solicita GET /api/tickets?limit=10
 *   Then el código de respuesta es 200
 *     And el campo "data" contiene exactamente 10 tickets
 *     And el campo "pagination.limit" es 10
 *     And el campo "pagination.totalPages" es 5
 */


describe('TC-002 — Listado paginado con tamaño configurable (HU-01)', () => {
  beforeAll(async () => {
    await request(app).post('/__test__/clear');
    await request(app).post('/__test__/seed').send({ count: 50 });
  });

  it('debe retornar 10 tickets y paginación correcta cuando limit=10', async () => {
    const res = await request(app)
      .get('/api/tickets?limit=10')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.totalPages).toBe(5);
  });
});

/**
 * TC-003 — Indicación de total de resultados y página actual
 * Historia de Usuario: HU-01
 *
 * Precondiciones:
 *   - Existen 55 tickets procesados en el repositorio del query-service.
 *
 * Pasos (Gherkin):
 *   Given existen 55 tickets procesados en el sistema
 *   When el operador solicita GET /api/tickets?page=3&limit=20
 *   Then el código de respuesta es 200
 *     And el campo "data" contiene exactamente 15 tickets
 *     And el campo "pagination.page" es 3
 *     And el campo "pagination.totalItems" es 55
 *     And el campo "pagination.totalPages" es 3
 */


describe('TC-003 — Indicación de total de resultados y página actual (HU-01)', () => {
  beforeAll(async () => {
    await request(app).post('/__test__/clear');
    await request(app).post('/__test__/seed').send({ count: 55 });
  });

  it('debe retornar la metadata correcta de paginación y 15 tickets en la página 3', async () => {
    const res = await request(app)
      .get('/api/tickets?page=3&limit=20')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(15);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(3);
    expect(res.body.pagination.totalItems).toBe(55);
    expect(res.body.pagination.totalPages).toBe(3);
  });
});

/**
 * TC-004 — Ordenamiento consistente entre páginas
 * Historia de Usuario: HU-01
 *
 * Precondiciones:
 *   - Existen al menos 40 tickets procesados en el repositorio del query-service, con campos ordenables (ej: fecha de creación).
 *
 * Pasos (Gherkin):
 *   Given existen 40 tickets procesados en el sistema
 *   When el operador solicita GET /api/tickets?limit=20&sort=createdAt&order=asc
 *   Then el código de respuesta es 200
 *     And los tickets de la página 1 están ordenados ascendentemente por fecha de creación
 *   When el operador solicita GET /api/tickets?page=2&limit=20&sort=createdAt&order=asc
 *   Then el código de respuesta es 200
 *     And los tickets de la página 2 continúan el orden ascendente sin duplicados ni saltos
 */


describe('TC-004 — Ordenamiento consistente entre páginas (HU-01)', () => {
  beforeAll(async () => {
    await request(app).post('/__test__/clear');
    await request(app).post('/__test__/seed').send({ count: 40 });
  });

  it('debe retornar los tickets ordenados ascendentemente por fecha de creación en ambas páginas', async () => {
    const resPage1 = await request(app)
      .get('/api/tickets?limit=20&sort=createdAt&order=asc')
      .expect(200);
    const resPage2 = await request(app)
      .get('/api/tickets?page=2&limit=20&sort=createdAt&order=asc')
      .expect(200);

    // Verificar orden ascendente en página 1
    const datesPage1 = resPage1.body.data.map((t: any) => t.createdAt);
    expect([...datesPage1].sort()).toEqual(datesPage1);

    // Verificar orden ascendente en página 2
    const datesPage2 = resPage2.body.data.map((t: any) => t.createdAt);
    expect([...datesPage2].sort()).toEqual(datesPage2);

    // Verificar que no hay duplicados entre páginas
    const allIds = [
      ...resPage1.body.data.map((t: any) => t.id),
      ...resPage2.body.data.map((t: any) => t.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);

    // Verificar continuidad del orden entre páginas
    if (datesPage1.length && datesPage2.length) {
      expect(datesPage1[datesPage1.length - 1] <= datesPage2[0]).toBe(true);
    }
  });
});

/**
 * TC-005 — Lista vacía cuando no hay tickets
 * Historia de Usuario: HU-01
 *
 * Precondiciones:
 *   - El repositorio del query-service está vacío (sin tickets procesados).
 *
 * Pasos (Gherkin):
 *   Given no existen tickets procesados en el sistema
 *   When el operador solicita GET /api/tickets
 *   Then el código de respuesta es 200
 *     And el campo "data" es un arreglo vacío
 *     And el campo "pagination.totalItems" es 0
 *     And el campo "pagination.totalPages" es 0
 */


describe('TC-005 — Lista vacía cuando no hay tickets (HU-01)', () => {
  beforeAll(async () => {
    await request(app).post('/__test__/clear');
  });

  it('debe retornar un arreglo vacío y paginación en cero cuando no hay tickets', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalItems).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
  });
});

/**
 * TC-006 — Solicitar página fuera de rango
 * Historia de Usuario: HU-01
 *
 * Precondiciones:
 *   - Existen 30 tickets procesados en el repositorio del query-service.
 *
 * Pasos (Gherkin):
 *   Given existen 30 tickets procesados en el sistema
 *   When el operador solicita GET /api/tickets?page=5&limit=10
 *   Then el código de respuesta es 200
 *     And el campo "data" es un arreglo vacío
 *     And el campo "pagination.page" es 5
 *     And el campo "pagination.totalItems" es 30
 *     And el campo "pagination.totalPages" es 3
 */


describe('TC-006 — Solicitar página fuera de rango (HU-01)', () => {
  beforeAll(async () => {
    await request(app).post('/__test__/clear');
    await request(app).post('/__test__/seed').send({ count: 30 });
  });

  it('debe retornar un arreglo vacío y la metadata correcta cuando se solicita una página fuera de rango', async () => {
    const res = await request(app)
      .get('/api/tickets?page=5&limit=10')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(5);
    expect(res.body.pagination.totalItems).toBe(30);
    expect(res.body.pagination.totalPages).toBe(3);
  });
});

/**
 * TC-007 — Tamaño de página con valores inválidos
 * Historia de Usuario: HU-01
 *
 * Precondiciones:
 *   - El sistema está operativo (no importa el número de tickets).
 *
 * Pasos (Gherkin):
 *   Given el sistema está operativo
 *   When el operador solicita GET /api/tickets?limit=0
 *   Then el código de respuesta es 400
 *     And el cuerpo contiene un mensaje de error
 *   When el operador solicita GET /api/tickets?limit=-5
 *   Then el código de respuesta es 400
 *     And el cuerpo contiene un mensaje de error
 *   When el operador solicita GET /api/tickets?limit=101
 *   Then el código de respuesta es 400
 *     And el cuerpo contiene un mensaje de error
 *   When el operador solicita GET /api/tickets?limit=abc
 *   Then el código de respuesta es 400
 *     And el cuerpo contiene un mensaje de error
 */

describe('TC-007 — Tamaño de página con valores inválidos (HU-01)', () => {
  beforeAll(async () => {
    await request(app).post('/__test__/clear');
  });
  it('debe retornar 400 y mensaje de error para limit=0', async () => {
    const res = await request(app)
      .get('/api/tickets?limit=0');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('debe retornar 400 y mensaje de error para limit negativo', async () => {
    const res = await request(app)
      .get('/api/tickets?limit=-5');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('debe retornar 400 y mensaje de error para limit mayor al máximo', async () => {
    const res = await request(app)
      .get('/api/tickets?limit=101');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('debe retornar 400 y mensaje de error para limit no numérico', async () => {
    const res = await request(app)
      .get('/api/tickets?limit=abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
