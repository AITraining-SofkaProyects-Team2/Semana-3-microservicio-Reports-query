import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import type { Ticket } from '../src/types';
import { TicketNotFoundError } from '../src/errors/TicketNotFoundError';
import { InvalidUuidFormatError } from '../src/errors/InvalidUuidFormatError';

/**
 * HU-06: Búsqueda por ID de ticket
 * Como operador, quiero buscar un ticket por ID para acceder rápidamente a un caso específico
 * sin necesidad de filtros o búsquedas complejas.
 */

const makeTicket = (id: string): Ticket => ({
  ticketId: id,
  lineNumber: '0991234567',
  email: 'client@example.com',
  type: 'NO_SERVICE',
  description: 'Internet service interruption',
  priority: 'HIGH',
  status: 'RECEIVED',
  createdAt: new Date().toISOString(),
  processedAt: null,
});

describe('HU-06 — Búsqueda por ID de ticket', () => {
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
  // HU06-TC-001 — Búsqueda por ID exitosa retorna el ticket
  // ─────────────────────────────────────────────────────────────────────────────
  describe('HU06-TC-001 — Búsqueda por ID exitosa retorna el ticket', () => {
    it('Given existe un ticket con ID "550e8400-e29b-41d4-a716-446655440000", When se envía GET /api/tickets/550e8400-e29b-41d4-a716-446655440000, Then retorna el ticket con código 200 (simulado) y el body contiene el ticket con todos sus campos', async () => {
      // Given: Existe un ticket con ID válido
      const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
      const ticket = makeTicket(VALID_UUID);

      mockRepository.findById = vi.fn().mockResolvedValue(ticket);

      // When: Se busca el ticket por su ID
      const result = await service.findById(VALID_UUID);

      // Then: Retorna el ticket con todos sus campos
      expect(result).toBeDefined();
      expect(result).toHaveProperty('ticketId');
      expect(result).toHaveProperty('lineNumber');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('processedAt');
    });

    it('Then ticket.ticketId = "550e8400-e29b-41d4-a716-446655440000" (coincide exactamente)', async () => {
      const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
      const ticket = makeTicket(VALID_UUID);

      mockRepository.findById = vi.fn().mockResolvedValue(ticket);

      const result = await service.findById(VALID_UUID);

      expect(result.ticketId).toBe(VALID_UUID);
      expect(result.ticketId).toEqual(VALID_UUID);
    });

    it('And el body contiene todos los campos del ticket con valores válidos', async () => {
      const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
      const ticket = makeTicket(VALID_UUID);

      mockRepository.findById = vi.fn().mockResolvedValue(ticket);

      const result = await service.findById(VALID_UUID);

      expect(result.ticketId).toBe(VALID_UUID);
      expect(result.lineNumber).toMatch(/^\d{10}$/);
      expect(result.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(['NO_SERVICE', 'INTERMITTENT_SERVICE', 'OTHER']).toContain(result.type);
      expect(['RECEIVED', 'IN_PROGRESS']).toContain(result.status);
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.priority);
      expect(typeof result.createdAt).toBe('string');
    });

    it('Partición de equivalencia: UUID válido, ticket existe', async () => {
      const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
      const ticket = makeTicket(VALID_UUID);

      mockRepository.findById = vi.fn().mockResolvedValue(ticket);

      const result = await service.findById(VALID_UUID);

      expect(result).toBeDefined();
      expect(result.ticketId).toBe(VALID_UUID);
    });

    it('Partición de equivalencia: UUID válido con minúsculas', async () => {
      const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const ticket = makeTicket(VALID_UUID);

      mockRepository.findById = vi.fn().mockResolvedValue(ticket);

      const result = await service.findById(VALID_UUID);

      expect(result.ticketId).toBe(VALID_UUID);
    });

    it('Valores límites: UUID con todos ceros válido', async () => {
      const VALID_UUID = '00000000-0000-0000-0000-000000000000';
      const ticket = makeTicket(VALID_UUID);

      mockRepository.findById = vi.fn().mockResolvedValue(ticket);

      const result = await service.findById(VALID_UUID);

      expect(result.ticketId).toBe(VALID_UUID);
      expect(mockRepository.findById).toHaveBeenCalledWith(VALID_UUID);
    });

    it('Valores límites: UUID con todos F válido', async () => {
      const VALID_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      const ticket = makeTicket(VALID_UUID);

      mockRepository.findById = vi.fn().mockResolvedValue(ticket);

      const result = await service.findById(VALID_UUID);

      expect(result.ticketId).toBe(VALID_UUID);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // HU06-TC-002 — Búsqueda por ID inexistente retorna 404
  // ─────────────────────────────────────────────────────────────────────────────
  describe('HU06-TC-002 — Búsqueda por ID inexistente retorna 404', () => {
    it('Given no existe un ticket con ID "ffffffff-ffff-ffff-ffff-ffffffffffff", When se envía GET /api/tickets/ffffffff-ffff-ffff-ffff-ffffffffffff, Then lanza TicketNotFoundError (simulando HTTP 404)', async () => {
      const NON_EXISTENT_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

      mockRepository.findById = vi.fn().mockResolvedValue(null);

      await expect(service.findById(NON_EXISTENT_UUID)).rejects.toThrow(TicketNotFoundError);
    });

    it('Then el error contiene descripción apropiada', async () => {
      const NON_EXISTENT_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

      mockRepository.findById = vi.fn().mockResolvedValue(null);

      try {
        await service.findById(NON_EXISTENT_UUID);
        expect.fail('Should have thrown TicketNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(TicketNotFoundError);
        expect((error as Error).message).toBeTruthy();
      }
    });

    it('Partición de equivalencia: UUID válido pero inexistente', async () => {
      const NON_EXISTENT_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';

      mockRepository.findById = vi.fn().mockResolvedValue(null);

      await expect(service.findById(NON_EXISTENT_UUID)).rejects.toThrow(TicketNotFoundError);
      expect(mockRepository.findById).toHaveBeenCalledWith(NON_EXISTENT_UUID);
    });

    it('Valores límites: UUID recién "eliminado" de la BD (no encontrado)', async () => {
      const UUID_JUST_DELETED = '550e8400-e29b-41d4-a716-446655440000';

      mockRepository.findById = vi.fn().mockResolvedValue(null);

      await expect(service.findById(UUID_JUST_DELETED)).rejects.toThrow(TicketNotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Validación de formato UUID (requisito implícito)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Validación de formato UUID', () => {
    it('Given se proporciona un UUID inválido, When se intenta buscar, Then lanza InvalidUuidFormatError antes de consultar repositorio', async () => {
      const INVALID_UUID = 'invalid-uuid-format';

      await expect(service.findById(INVALID_UUID)).rejects.toThrow(InvalidUuidFormatError);
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('When se proporciona cadena vacía, Then lanza InvalidUuidFormatError', async () => {
      await expect(service.findById('')).rejects.toThrow(InvalidUuidFormatError);
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('When se proporciona string sin formato UUID (abc123), Then lanza InvalidUuidFormatError', async () => {
      await expect(service.findById('abc123')).rejects.toThrow(InvalidUuidFormatError);
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });
  });
});
