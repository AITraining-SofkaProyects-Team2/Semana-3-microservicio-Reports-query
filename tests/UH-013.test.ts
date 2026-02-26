// UH-013: Cambio de Estado de Tickets desde la Lista
// Como administrador del sistema, necesito cambiar el estado de un ticket desde la
// vista de listado (transiciones RECEIVED ↔ IN_PROGRESS) mediante un endpoint PATCH.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import type { Ticket, TicketStatus } from '../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-001 — Validación de formato de ticketId - UUID válido
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que el método updateTicketStatus acepta ticketIds con
 * formato UUIDv4 válido y procede con la lógica de actualización sin lanzar
 * InvalidUuidFormatError.
 *
 * Precondiciones:
 *   - El servicio TicketQueryService está instanciado con un repositorio mock.
 *   - El repositorio mock implementa updateStatus().
 *   - El ticket existe en el repositorio mock.
 *
 * Pasos (Gherkin):
 *   Given el endpoint PATCH /api/tickets/:ticketId/status está disponible
 *   When se invoca updateTicketStatus con ticketId "550e8400-e29b-41d4-a716-446655440000" (UUID válido)
 *     And el nuevo estado es "IN_PROGRESS"
 *   Then el sistema valida el formato del ticketId exitosamente
 *     And llama al repositorio con el ticketId y el nuevo estado
 *     And no lanza InvalidUuidFormatError
 *
 * Partición de equivalencia:
 *   | Grupo                           | Valor de ticketId                          | Tipo    |
 *   |---------------------------------|--------------------------------------------|---------|
 *   | UUID v4 válido estándar         | "550e8400-e29b-41d4-a716-446655440000"     | Válido  |
 *   | UUID v4 válido en minúsculas    | "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"    | Válido  |
 *   | UUID v4 válido en mayúsculas    | "A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11"    | Válido  |
 *
 * Valores límites:
 *   - UUID con todos ceros: "00000000-0000-0000-0000-000000000000" (límite inferior)
 *   - UUID con todos F's:   "ffffffff-ffff-ffff-ffff-ffffffffffff" (límite superior)
 *   - UUID con longitud exacta: 36 caracteres (con guiones)
 */

describe('TC-013-001 — Validación de formato de ticketId - UUID válido', () => {
  let mockRepository: ITicketRepository & { updateStatus: ReturnType<typeof vi.fn> };
  let service: TicketQueryService;

  const makeTicket = (id: string, status: TicketStatus): Ticket => ({
    ticketId: id,
    lineNumber: '0991234567',
    email: 'admin@example.com',
    type: 'NO_SERVICE',
    description: null,
    priority: 'HIGH',
    status,
    createdAt: '2026-02-01T00:00:00.000Z',
    processedAt: '2026-02-01T01:00:00.000Z',
  });

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByLineNumber: vi.fn(),
      getMetrics: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ITicketRepository & { updateStatus: ReturnType<typeof vi.fn> };

    service = new TicketQueryService(mockRepository);
  });

  // ── EP-1: UUID v4 estándar en minúsculas ─────────────────────────────────
  describe('Given un ticketId con formato UUIDv4 estándar en minúsculas', () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(VALID_UUID, 'IN_PROGRESS'));
    });

    it('When se invoca updateTicketStatus, Then NO lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS'),
      ).resolves.toBeDefined();
    });

    it('When se invoca updateTicketStatus, Then llama al repositorio exactamente una vez', async () => {
      await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      expect(mockRepository.updateStatus).toHaveBeenCalledOnce();
    });

    it('When se invoca updateTicketStatus, Then llama al repositorio con el ticketId y estado correctos', async () => {
      await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(VALID_UUID, 'IN_PROGRESS');
    });

    it('When se invoca updateTicketStatus, Then retorna el ticket actualizado con el status correcto', async () => {
      const result = await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      expect(result).not.toBeNull();
      expect(result.ticketId).toBe(VALID_UUID);
      expect(result.status).toBe('IN_PROGRESS');
    });
  });

  // ── EP-2: UUID v4 válido en mayúsculas ───────────────────────────────────
  describe('Given un ticketId con formato UUIDv4 en mayúsculas', () => {
    const VALID_UUID_UPPER = 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11';

    beforeEach(() => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(VALID_UUID_UPPER, 'RECEIVED'));
    });

    it('When se invoca updateTicketStatus, Then NO lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID_UPPER, 'RECEIVED'),
      ).resolves.toBeDefined();
    });

    it('When se invoca updateTicketStatus, Then el repositorio es invocado con el UUID en mayúsculas', async () => {
      await service.updateTicketStatus(VALID_UUID_UPPER, 'RECEIVED');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(VALID_UUID_UPPER, 'RECEIVED');
    });
  });

  // ── EP-3: UUID v4 alternativo en minúsculas ──────────────────────────────
  describe('Given un ticketId con formato UUIDv4 alternativo en minúsculas', () => {
    const VALID_UUID_ALT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    beforeEach(() => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(VALID_UUID_ALT, 'IN_PROGRESS'));
    });

    it('When se invoca updateTicketStatus, Then NO lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID_ALT, 'IN_PROGRESS'),
      ).resolves.toBeDefined();
    });

    it('When se invoca updateTicketStatus, Then el repositorio recibe el ticketId correcto', async () => {
      await service.updateTicketStatus(VALID_UUID_ALT, 'IN_PROGRESS');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(VALID_UUID_ALT, 'IN_PROGRESS');
    });
  });

  // ── Valor límite inferior: UUID con todos ceros ──────────────────────────
  describe('Given un ticketId UUID con todos ceros (límite inferior del dominio)', () => {
    const UUID_ALL_ZEROS = '00000000-0000-0000-0000-000000000000';

    beforeEach(() => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(UUID_ALL_ZEROS, 'IN_PROGRESS'));
    });

    it('When se invoca updateTicketStatus, Then es aceptado como UUID válido', async () => {
      await expect(
        service.updateTicketStatus(UUID_ALL_ZEROS, 'IN_PROGRESS'),
      ).resolves.toBeDefined();
    });

    it('When se invoca updateTicketStatus, Then el repositorio es invocado con el UUID correcto', async () => {
      await service.updateTicketStatus(UUID_ALL_ZEROS, 'IN_PROGRESS');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(UUID_ALL_ZEROS, 'IN_PROGRESS');
    });
  });

  // ── Valor límite superior: UUID con todos F's ────────────────────────────
  describe("Given un ticketId UUID con todos F's (límite superior del dominio)", () => {
    const UUID_ALL_FS = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    beforeEach(() => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(UUID_ALL_FS, 'RECEIVED'));
    });

    it('When se invoca updateTicketStatus, Then es aceptado como UUID válido', async () => {
      await expect(
        service.updateTicketStatus(UUID_ALL_FS, 'RECEIVED'),
      ).resolves.toBeDefined();
    });

    it('When se invoca updateTicketStatus, Then el repositorio es invocado con el UUID correcto', async () => {
      await service.updateTicketStatus(UUID_ALL_FS, 'RECEIVED');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(UUID_ALL_FS, 'RECEIVED');
    });
  });

  // ── Valor límite: longitud exacta de 36 caracteres ──────────────────────
  describe('Given un ticketId con longitud exacta de UUID (36 caracteres con guiones)', () => {
    const UUID_EXACT = '550e8400-e29b-41d4-a716-446655440000';

    it('Then el ticketId tiene exactamente 36 caracteres', () => {
      expect(UUID_EXACT).toHaveLength(36);
    });

    it('When se invoca updateTicketStatus con ese UUID, Then el formato es aceptado', async () => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(UUID_EXACT, 'IN_PROGRESS'));
      await expect(
        service.updateTicketStatus(UUID_EXACT, 'IN_PROGRESS'),
      ).resolves.toBeDefined();
    });
  });
});
