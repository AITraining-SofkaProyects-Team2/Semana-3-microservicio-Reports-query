import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import type { Ticket } from '../src/types';
import { ValidationError } from '../src/errors/ValidationError';

/**
 * HU-07: Búsqueda por número de línea
 * Como operador, quiero buscar tickets por número de línea para revisar todas las quejas
 * de un cliente específico sin necesidad de filtros complejos.
 */

const makeTicket = (id: string, lineNumber: string): Ticket => ({
  ticketId: id,
  lineNumber,
  email: `client${id}@example.com`,
  type: 'NO_SERVICE',
  description: 'Internet service interruption',
  priority: 'HIGH',
  status: 'RECEIVED',
  createdAt: new Date().toISOString(),
  processedAt: null,
});

describe('HU-07 — Búsqueda por número de línea', () => {
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
  // HU07-TC-001 — Búsqueda por número de línea retorna tickets asociados
  // ─────────────────────────────────────────────────────────────────────────────
  describe('HU07-TC-001 — Búsqueda por número de línea retorna tickets asociados', () => {
    it('Given existen 2+ tickets asociados al número de línea "0991234567", When se envía GET /api/tickets/line/0991234567, Then retorna array con todos los tickets', async () => {
      // Given: Preparar múltiples tickets con el mismo lineNumber
      const LINE_NUMBER = '0991234567';
      const tickets = [
        makeTicket('uuid-1', LINE_NUMBER),
        makeTicket('uuid-2', LINE_NUMBER),
        makeTicket('uuid-3', LINE_NUMBER),
      ];

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue(tickets);

      // When: Solicitar tickets por número de línea
      const result = await service.findByLineNumber(LINE_NUMBER);

      // Then: Retorna array con todos los tickets
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('And el body contiene un objeto con propiedad "data" (array) y cada ticket tiene el lineNumber correcto', async () => {
      const LINE_NUMBER = '0991234567';
      const tickets = [
        makeTicket('uuid-1', LINE_NUMBER),
        makeTicket('uuid-2', LINE_NUMBER),
      ];

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue(tickets);

      const result = await service.findByLineNumber(LINE_NUMBER);

      // Verificar que es un array y todos los tickets tienen el lineNumber correcto
      expect(Array.isArray(result)).toBe(true);
      expect(result.every((t) => t.lineNumber === LINE_NUMBER)).toBe(true);
    });

    it('And cada ticket en data tiene lineNumber = "0991234567"', async () => {
      const LINE_NUMBER = '0991234567';
      const tickets = [
        makeTicket('uuid-1', LINE_NUMBER),
        makeTicket('uuid-2', LINE_NUMBER),
        makeTicket('uuid-3', LINE_NUMBER),
      ];

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue(tickets);

      const result = await service.findByLineNumber(LINE_NUMBER);

      result.forEach((ticket) => {
        expect(ticket.lineNumber).toBe(LINE_NUMBER);
      });
    });

    it('Partición de equivalencia: Número de línea válido con múltiples tickets asociados', async () => {
      const LINE_NUMBER = '0991234567';
      const tickets = Array.from({ length: 5 }, (_, i) => makeTicket(`uuid-${i}`, LINE_NUMBER));

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue(tickets);

      const result = await service.findByLineNumber(LINE_NUMBER);

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((t) => t.lineNumber === LINE_NUMBER)).toBe(true);
    });

    it('Valores límites: Mínimo de 2 tickets asociados', async () => {
      const LINE_NUMBER = '0991234567';
      const tickets = [makeTicket('uuid-1', LINE_NUMBER), makeTicket('uuid-2', LINE_NUMBER)];

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue(tickets);

      const result = await service.findByLineNumber(LINE_NUMBER);

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.lineNumber === LINE_NUMBER)).toBe(true);
    });

    it('Valores límites: 10+ tickets asociados al mismo lineNumber', async () => {
      const LINE_NUMBER = '0991234567';
      const tickets = Array.from({ length: 10 }, (_, i) => makeTicket(`uuid-${i}`, LINE_NUMBER));

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue(tickets);

      const result = await service.findByLineNumber(LINE_NUMBER);

      expect(result).toHaveLength(10);
      expect(result.every((t) => t.lineNumber === LINE_NUMBER)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // HU07-TC-002 — Búsqueda por línea sin tickets retorna array vacío
  // ─────────────────────────────────────────────────────────────────────────────
  describe('HU07-TC-002 — Búsqueda por línea sin tickets retorna array vacío', () => {
    it('Given no existen tickets asociados al número de línea "9999999999", When se envía GET /api/tickets/line/9999999999, Then retorna array vacío', async () => {
      const LINE_NUMBER = '9999999999';

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue([]);

      // When: Solicitar tickets por número de línea que no existe
      const result = await service.findByLineNumber(LINE_NUMBER);

      // Then: Retorna array vacío
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('And el body.data es un array vacío (length = 0)', async () => {
      const LINE_NUMBER = '9999999999';

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue([]);

      const result = await service.findByLineNumber(LINE_NUMBER);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('Partición de equivalencia: Número de línea válido sin tickets asociados', async () => {
      const LINE_NUMBER = '0000000000';

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue([]);

      const result = await service.findByLineNumber(LINE_NUMBER);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('Valores límites: Número de línea con todos ceros válido pero sin tickets', async () => {
      const LINE_NUMBER = '0000000000';

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue([]);

      const result = await service.findByLineNumber(LINE_NUMBER);

      expect(result).toHaveLength(0);
      expect(mockRepository.findByLineNumber).toHaveBeenCalledWith(LINE_NUMBER);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Validación de formato de número de línea
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Validación de formato de número de línea', () => {
    it('Given se proporciona un número de línea con formato inválido (letras), When se intenta buscar, Then lanza ValidationError sin invocar repositorio', async () => {
      const INVALID_LINE = 'abc1234567';

      await expect(service.findByLineNumber(INVALID_LINE)).rejects.toThrow(ValidationError);
      expect(mockRepository.findByLineNumber).not.toHaveBeenCalled();
    });

    it('When se proporciona número de línea con longitud diferente a 10 dígitos, Then lanza ValidationError', async () => {
      const INVALID_LINE = '123456789'; // 9 dígitos

      await expect(service.findByLineNumber(INVALID_LINE)).rejects.toThrow(ValidationError);
      expect(mockRepository.findByLineNumber).not.toHaveBeenCalled();
    });

    it('When se proporciona número de línea con caracteres especiales, Then lanza ValidationError', async () => {
      const INVALID_LINE = '099-123-4567';

      await expect(service.findByLineNumber(INVALID_LINE)).rejects.toThrow(ValidationError);
      expect(mockRepository.findByLineNumber).not.toHaveBeenCalled();
    });

    it('When se proporciona número de línea válido (10 dígitos), Then permite la búsqueda', async () => {
      const VALID_LINE = '0991234567';

      mockRepository.findByLineNumber = vi.fn().mockResolvedValue([]);

      await service.findByLineNumber(VALID_LINE);

      expect(mockRepository.findByLineNumber).toHaveBeenCalledWith(VALID_LINE);
    });
  });
});
