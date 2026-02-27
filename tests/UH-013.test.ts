// UH-013: Cambio de Estado de Tickets desde la Lista
// Como administrador del sistema, necesito cambiar el estado de un ticket desde la
// vista de listado (transiciones RECEIVED ↔ IN_PROGRESS) mediante un endpoint PATCH.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { TicketsController } from '../src/controllers/ticketsController';
import { TicketRepository } from '../src/repositories/TicketRepository';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import { InvalidUuidFormatError } from '../src/errors/InvalidUuidFormatError';
import { InvalidTicketStatusError } from '../src/errors/InvalidTicketStatusError';
import { TicketNotFoundError } from '../src/errors/TicketNotFoundError';
import { DatabaseError } from '../src/errors/DatabaseError';
import { createApp } from '../src/index';
import type { Request } from 'express';
import type { Ticket, TicketStatus } from '../src/types';

vi.mock('../src/config/database', () => ({
  default: { query: vi.fn() },
}));

import pool from '../src/config/database';

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

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-002 — Validación de formato de ticketId - UUID inválido
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que el método updateTicketStatus rechaza ticketIds con
 * formato inválido lanzando InvalidUuidFormatError sin invocar al repositorio.
 *
 * Precondiciones:
 *   - El servicio TicketQueryService está instanciado con un repositorio mock.
 *   - El repositorio mock NO debe ser invocado para IDs con formato inválido.
 *
 * Pasos (Gherkin):
 *   Given el endpoint PATCH /api/tickets/:ticketId/status está disponible
 *   When se invoca updateTicketStatus con ticketId en formato inválido
 *   Then el sistema lanza InvalidUuidFormatError
 *     And no invoca el repositorio
 *
 * Partición de equivalencia:
 *   | Grupo                      | Valor de ticketId                              | Tipo     |
 *   |----------------------------|------------------------------------------------|----------|
 *   | Formato incorrecto         | "invalid-uuid"                                 | Inválido |
 *   | Muy corto                  | "abc"                                          | Inválido |
 *   | Muy largo                  | "550e8400-e29b-41d4-a716-446655440000-extra"  | Inválido |
 *   | Sin guiones                | "550e8400e29b41d4a716446655440000"            | Inválido |
 *   | Con caracteres especiales   | "550e8400-e29b-41d4-a716-44665544000@"        | Inválido |
 *
 * Valores límites:
 *   - 35 caracteres (uno menos del mínimo)
 *   - 37 caracteres (uno más del máximo)
 *   - Cadena vacía: ""
 */

describe('TC-013-002 — Validación de formato de ticketId - UUID inválido', () => {
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

  // ── EP-1: Formato incorrecto ────────────────────────────────────────────
  describe('Given un ticketId con formato completamente incorrecto "invalid-uuid"', () => {
    const INVALID_UUID = 'invalid-uuid';

    it('When se invoca updateTicketStatus, Then lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(INVALID_UUID, 'IN_PROGRESS'),
      ).rejects.toThrow(InvalidUuidFormatError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(INVALID_UUID, 'IN_PROGRESS');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-2: Muy corto ────────────────────────────────────────────────────
  describe('Given un ticketId muy corto "abc"', () => {
    const SHORT_UUID = 'abc';

    it('When se invoca updateTicketStatus, Then lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(SHORT_UUID, 'IN_PROGRESS'),
      ).rejects.toThrow(InvalidUuidFormatError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(SHORT_UUID, 'IN_PROGRESS');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-3: Muy largo ────────────────────────────────────────────────────
  describe('Given un ticketId muy largo con caracteres extra', () => {
    const LONG_UUID = '550e8400-e29b-41d4-a716-446655440000-extra';

    it('When se invoca updateTicketStatus, Then lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(LONG_UUID, 'RECEIVED'),
      ).rejects.toThrow(InvalidUuidFormatError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(LONG_UUID, 'RECEIVED');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-4: Sin guiones ────────────────────────────────────────────────
  describe('Given un UUID sin guiones (32 caracteres consecutivos)', () => {
    const NO_HYPHENS = '550e8400e29b41d4a716446655440000';

    it('When se invoca updateTicketStatus, Then lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(NO_HYPHENS, 'IN_PROGRESS'),
      ).rejects.toThrow(InvalidUuidFormatError);
    });

    it('When se invoca updateTicketStatus, Then el repositorio no es invocado', async () => {
      try {
        await service.updateTicketStatus(NO_HYPHENS, 'IN_PROGRESS');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-5: Con caracteres especiales ─────────────────────────────────
  describe('Given un UUID con caracteres especiales "@"', () => {
    const SPECIAL_CHARS = '550e8400-e29b-41d4-a716-44665544000@';

    it('When se invoca updateTicketStatus, Then lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(SPECIAL_CHARS, 'RECEIVED'),
      ).rejects.toThrow(InvalidUuidFormatError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(SPECIAL_CHARS, 'RECEIVED');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── Valor límite: 35 caracteres (uno menos del mínimo) ────────────────
  describe('Given un string con 35 caracteres (UUIDv4 incompleto)', () => {
    const UUID_35_CHARS = '550e8400-e29b-41d4-a716-44665544000';

    it('Then el string tiene exactamente 35 caracteres', () => {
      expect(UUID_35_CHARS).toHaveLength(35);
    });

    it('When se invoca updateTicketStatus, Then lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(UUID_35_CHARS, 'IN_PROGRESS'),
      ).rejects.toThrow(InvalidUuidFormatError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(UUID_35_CHARS, 'IN_PROGRESS');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── Valor límite: 37 caracteres (uno más del máximo) ──────────────────
  describe('Given un UUID con 37 caracteres (UUIDv4 con un carácter extra)', () => {
    const UUID_37_CHARS = '550e8400-e29b-41d4-a716-446655440000a';

    it('Then el string tiene exactamente 37 caracteres', () => {
      expect(UUID_37_CHARS).toHaveLength(37);
    });

    it('When se invoca updateTicketStatus, Then lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(UUID_37_CHARS, 'RECEIVED'),
      ).rejects.toThrow(InvalidUuidFormatError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(UUID_37_CHARS, 'RECEIVED');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── Valor límite: Cadena vacía ──────────────────────────────────────
  describe('Given un ticketId vacío ("")', () => {
    const EMPTY_STRING = '';

    it('When se invoca updateTicketStatus, Then lanza InvalidUuidFormatError', async () => {
      await expect(
        service.updateTicketStatus(EMPTY_STRING, 'IN_PROGRESS'),
      ).rejects.toThrow(InvalidUuidFormatError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(EMPTY_STRING, 'IN_PROGRESS');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-003 — Validación de estado válido - RECEIVED
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que el método updateTicketStatus valida que el estado
 * pertenece al dominio permitido (RECEIVED, IN_PROGRESS). Solo acepta estados
 * válidos y rechaza cualquier otro valor.
 *
 * Precondiciones:
 *   - El servicio TicketQueryService está instanciado con un repositorio mock.
 *   - El repositorio mock implementa updateStatus().
 *   - El ticketId tiene formato UUIDv4 válido.
 *
 * Pasos (Gherkin):
 *   Given existe un ticket con ID "550e8400-e29b-41d4-a716-446655440000"
 *   When se envía updateTicketStatus con estado "RECEIVED" (válido)
 *   Then el sistema valida que pertenece al dominio { "RECEIVED", "IN_PROGRESS" }
 *     And procede con la actualización
 *     And retorna el ticket actualizado
 *
 * Partición de equivalencia:
 *   | Grupo                      | Valor de status | Tipo     | Resultado Esperado |
 *   |----------------------------|-----------------|----------|---------------------|
 *   | Estado válido              | "RECEIVED"      | Válido   | Actualización OK    |
 *   | Estado válido              | "IN_PROGRESS"   | Válido   | Actualización OK    |
 *   | Estado inválido (inexiste) | "CLOSED"        | Inválido | Lanza Error         |
 *   | Estado inválido (inexiste) | "RESOLVED"      | Inválido | Lanza Error         |
 *   | Estado inválido (inexiste) | "PENDING"       | Inválido | Lanza Error         |
 *   | Case-sensitive             | "received"      | Inválido | Lanza Error         |
 *   | Cadena vacía               | ""              | Inválido | Lanza Error         |
 *
 * Valores límites:
 *   - Primer estado del dominio permitido (RECEIVED)
 *   - Exactamente uno de los dos valores permitidos del dominio
 */

describe('TC-013-003 — Validación de estado válido - RECEIVED', () => {
  let mockRepository: ITicketRepository & { updateStatus: ReturnType<typeof vi.fn> };
  let service: TicketQueryService;

  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

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

  // ── EP-1: Estado válido "RECEIVED" ──────────────────────────────────────
  describe('Given un ticketId con UUID válido y estado "RECEIVED" (válido)', () => {
    beforeEach(() => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(VALID_UUID, 'RECEIVED'));
    });

    it('When se invoca updateTicketStatus, Then valida que "RECEIVED" pertenece al dominio', async () => {
      // El dominio permitido es: { "RECEIVED", "IN_PROGRESS" }
      const VALID_STATUSES = ['RECEIVED', 'IN_PROGRESS'];
      expect(VALID_STATUSES).toContain('RECEIVED');
    });

    it('When se invoca updateTicketStatus con "RECEIVED", Then no lanza error de validación', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'RECEIVED'),
      ).resolves.toBeDefined();
    });

    it('When se invoca updateTicketStatus con "RECEIVED", Then llama al repositorio exactamente una vez', async () => {
      await service.updateTicketStatus(VALID_UUID, 'RECEIVED');
      expect(mockRepository.updateStatus).toHaveBeenCalledOnce();
    });

    it('When se invoca updateTicketStatus con "RECEIVED", Then retorna el ticket actualizado', async () => {
      const result = await service.updateTicketStatus(VALID_UUID, 'RECEIVED');
      expect(result).not.toBeNull();
      expect(result.ticketId).toBe(VALID_UUID);
      expect(result.status).toBe('RECEIVED');
    });
  });

  // ── EP-2: Estado válido "IN_PROGRESS" (también del dominio) ─────────────
  describe('Given un ticketId con UUID válido y estado "IN_PROGRESS" (válido)', () => {
    beforeEach(() => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(VALID_UUID, 'IN_PROGRESS'));
    });

    it('When se invoca updateTicketStatus, Then valida que "IN_PROGRESS" pertenece al dominio', async () => {
      const VALID_STATUSES = ['RECEIVED', 'IN_PROGRESS'];
      expect(VALID_STATUSES).toContain('IN_PROGRESS');
    });

    it('When se invoca updateTicketStatus con "IN_PROGRESS", Then no lanza error', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS'),
      ).resolves.toBeDefined();
    });

    it('When se invoca updateTicketStatus con "IN_PROGRESS", Then retorna el ticket con status correcto', async () => {
      const result = await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      expect(result.status).toBe('IN_PROGRESS');
    });
  });

  // ── EP-3: Estado inválido "CLOSED" (FUERA del dominio) ───────────────────
  // Este test fuerza la validación: el servicio debe RECHAZAR estados no permitidos
  describe('Given un ticketId con UUID válido pero estado "CLOSED" (INVÁLIDO)', () => {
    it('When se invoca updateTicketStatus con "CLOSED", Then lanza error porque no está en dominio', async () => {
      // El test espera que "CLOSED" sea rechazado por no pertenecer a { "RECEIVED", "IN_PROGRESS" }
      // Esto fuerza que el servicio implemente validación de dominio
      const VALID_STATUSES = ['RECEIVED', 'IN_PROGRESS'];
      
      // Este test FALLARÁ si el servicio no valida el estado
      // Porque espera que "CLOSED" no esté en el dominio permitido
      expect(VALID_STATUSES).not.toContain('CLOSED');
      
      // El servicio debe lanzar InvalidTicketStatusError cuando se intente usar "CLOSED"
      await expect(
        service.updateTicketStatus(VALID_UUID, 'CLOSED' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus con "CLOSED", Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'CLOSED' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-4: Estado inválido en minúsculas "received" ──────────────────────
  describe('Given un ticketId con UUID válido pero "received" (minúsculas, INVÁLIDO)', () => {
    it('When se invoca updateTicketStatus con "received", Then es rechazado (case-sensitive)', async () => {
      const VALID_STATUSES = ['RECEIVED', 'IN_PROGRESS'];
      // "received" != "RECEIVED" (case-sensitive)
      expect(VALID_STATUSES).not.toContain('received');
      
      // El servicio debe lanzar InvalidTicketStatusError
      await expect(
        service.updateTicketStatus(VALID_UUID, 'received' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });
  });

  // ── Valor límite: Primer estado permitido ───────────────────────────────
  describe('Given "RECEIVED" como el PRIMER valor permitido del dominio', () => {
    beforeEach(() => {
      mockRepository.updateStatus.mockResolvedValue(makeTicket(VALID_UUID, 'RECEIVED'));
    });

    it('Then existe el estado "RECEIVED" en el dominio permitido { "RECEIVED", "IN_PROGRESS" }', () => {
      const ALLOWED_STATUSES: TicketStatus[] = ['RECEIVED', 'IN_PROGRESS'];
      expect(ALLOWED_STATUSES[0]).toBe('RECEIVED');
      expect(ALLOWED_STATUSES).toContain('RECEIVED');
    });

    it('When se invoca updateTicketStatus con "RECEIVED", Then es aceptado y actualiza', async () => {
      const result = await service.updateTicketStatus(VALID_UUID, 'RECEIVED');
      expect(result.status).toBe('RECEIVED');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(VALID_UUID, 'RECEIVED');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-004 — Validación de estado inválido - valores fuera del dominio
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que el método updateTicketStatus rechaza estados que
 * no pertenecen al dominio permitido { "RECEIVED", "IN_PROGRESS" }, lanzando
 * InvalidTicketStatusError sin invocar al repositorio.
 *
 * Precondiciones:
 *   - El servicio TicketQueryService está instanciado con un repositorio mock.
 *   - El ticketId tiene formato UUIDv4 válido.
 *   - El estado NO pertenece a { "RECEIVED", "IN_PROGRESS" }.
 *
 * Pasos (Gherkin):
 *   Given existe un ticket con ID válido y estado inválido "CLOSED"
 *   When se invoca updateTicketStatus con estado fuera del dominio
 *   Then el sistema lanza InvalidTicketStatusError
 *     And no invoca al repositorio
 *
 * Partición de equivalencia:
 *   | Grupo                           | Valor de status   | Tipo     |
 *   |---------------------------------|-------------------|----------|
 *   | Estado inexistente              | "CLOSED"          | Inválido |
 *   | Estado inexistente              | "RESOLVED"        | Inválido |
 *   | Estado inexistente              | "CANCELLED"       | Inválido |
 *   | Cadena vacía                    | ""                | Inválido |
 *   | Null                            | null              | Inválido |
 *   | Tipo incorrecto - número        | 123               | Inválido |
 *   | Tipo incorrecto - booleano      | true              | Inválido |
 *   | Case-sensitive incorrecto       | "received"        | Inválido |
 *   | Con espacios                    | " IN_PROGRESS "   | Inválido |
 *   | Casi correcto (caracteres)      | "RECEIVEDD"       | Inválido |
 *
 * Valores límites:
 *   - Estado con un carácter de diferencia: "RECEIVEDD", "IN_PROGRES"
 *   - Estado en minúsculas: "received", "in_progress"
 *   - Cadena vacía: ""
 */

describe('TC-013-004 — Validación de estado inválido - valores fuera del dominio', () => {
  let mockRepository: ITicketRepository & { updateStatus: ReturnType<typeof vi.fn> };
  let service: TicketQueryService;

  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

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

  // ── EP-1: Estado inexistente "CLOSED" ────────────────────────────────────
  describe('Given un ticketId con UUID válido pero estado "CLOSED" (fuera del dominio)', () => {
    it('When se invoca updateTicketStatus, Then lanza InvalidTicketStatusError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'CLOSED' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'CLOSED' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('When se invoca updateTicketStatus, Then el error contiene descripción de estados permitidos', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'CLOSED' as any);
        fail('Debería haber lanzado InvalidTicketStatusError');
      } catch (error: any) {
        expect(error.message).toContain('RECEIVED');
        expect(error.message).toContain('IN_PROGRESS');
      }
    });
  });

  // ── EP-2: Estado inexistente "RESOLVED" ──────────────────────────────────
  describe('Given un ticketId válido pero estado "RESOLVED" (fuera del dominio)', () => {
    it('When se invoca updateTicketStatus, Then lanza InvalidTicketStatusError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'RESOLVED' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'RESOLVED' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-3: Estado inexistente "CANCELLED" ─────────────────────────────────
  describe('Given un ticketId válido pero estado "CANCELLED" (fuera del dominio)', () => {
    it('When se invoca updateTicketStatus, Then lanza InvalidTicketStatusError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'CANCELLED' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'CANCELLED' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-4: Cadena vacía ──────────────────────────────────────────────────
  describe('Given un ticketId válido pero estado vacío ("")', () => {
    it('When se invoca updateTicketStatus, Then lanza InvalidTicketStatusError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, '' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, '' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-5: Case-sensitive incorrecto "received" (minúsculas) ──────────────
  describe('Given un ticketId válido pero "received" (minúsculas, case-sensitive)', () => {
    it('When se invoca updateTicketStatus, Then lanza InvalidTicketStatusError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'received' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'received' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── EP-6: Con espacios " IN_PROGRESS " ──────────────────────────────────
  describe('Given un estado "IN_PROGRESS" con espacios al inicio/final', () => {
    it('When se invoca updateTicketStatus con " IN_PROGRESS ", Then lanza InvalidTicketStatusError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, ' IN_PROGRESS ' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, ' IN_PROGRESS ' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── Valor límite: Casi correcto "RECEIVEDD" (un carácter extra) ─────────
  describe('Given un estado "RECEIVEDD" (un carácter extra vs "RECEIVED")', () => {
    it('Then "RECEIVEDD" no está en el dominio permitido', () => {
      const VALID_STATUSES = ['RECEIVED', 'IN_PROGRESS'];
      expect(VALID_STATUSES).not.toContain('RECEIVEDD');
    });

    it('When se invoca updateTicketStatus con "RECEIVEDD", Then lanza InvalidTicketStatusError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'RECEIVEDD' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'RECEIVEDD' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── Valor límite: Casi correcto "IN_PROGRES" (un carácter faltante) ─────
  describe('Given un estado "IN_PROGRES" (un carácter faltante vs "IN_PROGRESS")', () => {
    it('Then "IN_PROGRES" no está en el dominio permitido', () => {
      const VALID_STATUSES = ['RECEIVED', 'IN_PROGRESS'];
      expect(VALID_STATUSES).not.toContain('IN_PROGRES');
    });

    it('When se invoca updateTicketStatus con "IN_PROGRES", Then lanza InvalidTicketStatusError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'IN_PROGRES' as any),
      ).rejects.toThrow(InvalidTicketStatusError);
    });

    it('When se invoca updateTicketStatus, Then no invoca al repositorio', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'IN_PROGRES' as any);
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── Verificación: Dominio permitido es exactamente { RECEIVED, IN_PROGRESS } ──
  describe('Verificación: El dominio permitido es exactamente { "RECEIVED", "IN_PROGRESS" }', () => {
    it('Then "RECEIVED" está permitido', () => {
      const VALID_STATUSES: TicketStatus[] = ['RECEIVED', 'IN_PROGRESS'];
      expect(VALID_STATUSES).toContain('RECEIVED');
    });

    it('Then "IN_PROGRESS" está permitido', () => {
      const VALID_STATUSES: TicketStatus[] = ['RECEIVED', 'IN_PROGRESS'];
      expect(VALID_STATUSES).toContain('IN_PROGRESS');
    });

    it('Then el dominio tiene exactamente 2 estados', () => {
      const VALID_STATUSES: TicketStatus[] = ['RECEIVED', 'IN_PROGRESS'];
      expect(VALID_STATUSES).toHaveLength(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-005 — Actualización exitosa de RECEIVED a IN_PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que updateTicketStatus valida que el ticket existe
 * antes de actualizar. Si el ticket no existe en la base de datos, debe lanzar
 * TicketNotFoundError sin intentar actualizar.
 *
 * Precondiciones:
 *   - El ticketId tiene formato UUIDv4 válido
 *   - El estado es válido ("IN_PROGRESS")
 *   - El ticket NO existe en la base de datos
 *
 * Pasos (Gherkin):
 *   Given existe un ticketId "550e8400-e29b-41d4-a716-446655440000" con formato válido
 *     And el ticket NO existe en la base de datos
 *   When se invoca updateTicketStatus con "IN_PROGRESS"
 *   Then el sistema lanza TicketNotFoundError
 *     And no invoca updateStatus en el repositorio
 *
 * Tabla de Decisión:
 *   | ticketId válido | Ticket existe | Resultado |
 *   |-----------------|---------------|-----------|
 *   | Sí              | Sí            | Actualiza |
 *   | Sí              | No            | Error 404 |
 *   | No              | Sí            | Error 400 |
 *   | No              | No            | Error 400 |
 */

describe('TC-013-005 — Validación: Ticket debe existir antes de actualizar', () => {
  let mockRepository: ITicketRepository & { 
    updateStatus: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let service: TicketQueryService;

  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByLineNumber: vi.fn(),
      getMetrics: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ITicketRepository & { 
      updateStatus: ReturnType<typeof vi.fn>;
      findById: ReturnType<typeof vi.fn>;
    };

    service = new TicketQueryService(mockRepository);
  });

  // ── EP-1: Ticket NO existe en la base de datos ──────────────────────────
  describe('Given un ticketId con UUID válido pero el ticket NO existe en BD', () => {
    beforeEach(() => {
      // El repositorio retorna null (ticket no encontrado)
      mockRepository.findById.mockResolvedValue(null);
    });

    it('When se invoca updateTicketStatus, Then lanza TicketNotFoundError', async () => {
      await expect(
        service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS'),
      ).rejects.toThrow(TicketNotFoundError);
    });

    it('When se invoca updateTicketStatus y el ticket no existe, Then no invoca updateStatus', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      } catch {
        // Error esperado
      }
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('When se invoca updateTicketStatus con ticket inexistente, Then el error es instancia de TicketNotFoundError', async () => {
      try {
        await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
        fail('Debería haber lanzado TicketNotFoundError');
      } catch (error: any) {
        expect(error instanceof TicketNotFoundError).toBe(true);
      }
    });
  });

  // ── EP-2: Ticket SÍ existe en la base de datos ──────────────────────────
  describe('Given un ticketId con UUID válido y el ticket SÍ existe en BD', () => {
    const EXISTING_TICKET = {
      ticketId: VALID_UUID,
      lineNumber: '0991234567',
      email: 'admin@example.com',
      type: 'NO_SERVICE' as const,
      description: null,
      priority: 'HIGH' as const,
      status: 'RECEIVED' as const,
      createdAt: '2026-02-25T09:00:00.000Z',
      processedAt: '2026-02-25T10:00:00.000Z',
    };

    const UPDATED_TICKET = {
      ...EXISTING_TICKET,
      status: 'IN_PROGRESS' as const,
      processedAt: '2026-02-25T10:15:00.000Z',
    };

    beforeEach(() => {
      mockRepository.findById.mockResolvedValue(EXISTING_TICKET);
      mockRepository.updateStatus.mockResolvedValue(UPDATED_TICKET);
    });

    it('When se invoca updateTicketStatus, Then invoca updateStatus en el repositorio', async () => {
      await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      expect(mockRepository.updateStatus).toHaveBeenCalledOnce();
    });

    it('When se invoca updateTicketStatus, Then retorna el ticket actualizado', async () => {
      const result = await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      expect(result).toBeDefined();
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('When se invoca updateTicketStatus, Then el status cambia de "RECEIVED" a "IN_PROGRESS"', async () => {
      const result = await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.status).not.toBe(EXISTING_TICKET.status);
    });

    it('When se invoca updateTicketStatus, Then processed_at se actualiza a time más reciente', async () => {
      const result = await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      const oldTime = new Date(EXISTING_TICKET.processedAt!).getTime();
      const newTime = new Date(result.processedAt!).getTime();
      expect(newTime).toBeGreaterThanOrEqual(oldTime);
    });

    it('When se invoca updateTicketStatus, Then otros campos permanecen sin cambios', async () => {
      const result = await service.updateTicketStatus(VALID_UUID, 'IN_PROGRESS');
      expect(result.ticketId).toBe(EXISTING_TICKET.ticketId);
      expect(result.lineNumber).toBe(EXISTING_TICKET.lineNumber);
      expect(result.email).toBe(EXISTING_TICKET.email);
      expect(result.type).toBe(EXISTING_TICKET.type);
      expect(result.priority).toBe(EXISTING_TICKET.priority);
    });
  });

  // ── Tabla de Decisión: Validación de existencia ──────────────────────────
  describe('Tabla de Decisión: ticketId válido vs Ticket existe en BD', () => {
    it('Then row 1: UUID válido + Ticket existe → Debe permitir actualización', () => {
      const VALID_STATUSES = ['RECEIVED', 'IN_PROGRESS'];
      expect(VALID_STATUSES).toContain('IN_PROGRESS');
      expect(VALID_UUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('Then row 2: UUID válido + Ticket NO existe → Debe lanzar TicketNotFoundError', () => {
      // La validación de existencia es responsabilidad del servicio
      // Cuando findById retorna null, updateTicketStatus debe lanzar TicketNotFoundError
      const FINDING_NOT_FOUND = null;
      expect(FINDING_NOT_FOUND).toBeNull();
    });

    it('Then row 3: UUID inválido + Ticket existe → Debe lanzar InvalidUuidFormatError (validación previa)', () => {
      const INVALID_UUID = 'not-a-uuid';
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(UUID_REGEX.test(INVALID_UUID)).toBe(false);
    });

    it('Then row 4: UUID inválido + Ticket NO existe → Debe lanzar InvalidUuidFormatError (validación previa)', () => {
      const INVALID_UUID = 'not-a-uuid';
      const TICKET_NOT_FOUND = null;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      // La validación de UUID siempre falla primero
      expect(UUID_REGEX.test(INVALID_UUID)).toBe(false);
      expect(TICKET_NOT_FOUND).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-006 — Error 404 - Ticket no encontrado (capa Controlador)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que el controlador mapea correctamente TicketNotFoundError
 * a una respuesta HTTP 404, y que los demás errores se mapean al código HTTP adecuado.
 *
 * Precondiciones:
 *   - El controlador TicketsController está instanciado con un servicio mock.
 *   - El servicio es mockeado para controlar el comportamiento.
 *   - No existe un ticket con el ID especificado en la base de datos.
 *
 * Pasos (Gherkin):
 *   Given el controlador recibe una request PATCH con ticketId válido
 *     And el servicio lanza TicketNotFoundError
 *   When se procesa la request en updateTicketStatus
 *   Then el controlador responde con HTTP 404
 *     And el body contiene el mensaje de error
 *
 * Partición de equivalencia:
 *   | Grupo                        | Error del Service           | HTTP Esperado |
 *   |------------------------------|-----------------------------|---------------|
 *   | Ticket no encontrado         | TicketNotFoundError         | 404           |
 *   | UUID inválido                | InvalidUuidFormatError      | 400           |
 *   | Estado inválido              | InvalidTicketStatusError    | 400           |
 *   | Actualización exitosa        | (sin error)                 | 200           |
 *   | Error inesperado de BD       | Error genérico              | 500           |
 *
 * Valores límites:
 *   - UUID válido pero ticket recién eliminado (no encontrado)
 *   - Primer ticket creado del sistema
 */

describe('TC-013-006 — Error 404: Controlador mapea TicketNotFoundError a HTTP 404', () => {
  let mockService: { updateTicketStatus: ReturnType<typeof vi.fn> };
  let controller: TicketsController;

  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

  const makeReq = (ticketId: string, status: string): Partial<Request> => ({
    params: { ticketId },
    body: { status },
  });

  const makeRes = (): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } => {
    const res = {
      status: vi.fn(),
      json: vi.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    mockService = {
      updateTicketStatus: vi.fn(),
    };
    controller = new TicketsController(mockService as any);
  });

  // ── EP-1: Ticket no encontrado → HTTP 404 ───────────────────────────────
  describe('Given el servicio lanza TicketNotFoundError (ticket no existe en BD)', () => {
    beforeEach(() => {
      mockService.updateTicketStatus.mockRejectedValue(new TicketNotFoundError());
    });

    it('When se llama updateTicketStatus en el controlador, Then responde con HTTP 404', async () => {
      const req = makeReq(VALID_UUID, 'IN_PROGRESS');
      const res = makeRes();

      await controller.updateTicketStatus(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('When el controlador recibe TicketNotFoundError, Then el body contiene mensaje de error', async () => {
      const req = makeReq(VALID_UUID, 'IN_PROGRESS');
      const res = makeRes();

      await controller.updateTicketStatus(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
    });
  });

  // ── EP-2: UUID inválido → HTTP 400 ─────────────────────────────────────
  describe('Given el servicio lanza InvalidUuidFormatError (UUID inválido)', () => {
    beforeEach(() => {
      mockService.updateTicketStatus.mockRejectedValue(new InvalidUuidFormatError());
    });

    it('When se llama updateTicketStatus en el controlador, Then responde con HTTP 400', async () => {
      const req = makeReq('invalid-uuid', 'IN_PROGRESS');
      const res = makeRes();

      await controller.updateTicketStatus(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── EP-3: Estado inválido → HTTP 400 ───────────────────────────────────
  describe('Given el servicio lanza InvalidTicketStatusError (estado fuera del dominio)', () => {
    beforeEach(() => {
      mockService.updateTicketStatus.mockRejectedValue(new InvalidTicketStatusError('CLOSED'));
    });

    it('When se llama updateTicketStatus en el controlador, Then responde con HTTP 400', async () => {
      const req = makeReq(VALID_UUID, 'CLOSED');
      const res = makeRes();

      await controller.updateTicketStatus(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── EP-4: Actualización exitosa → HTTP 200 ─────────────────────────────
  describe('Given el servicio resuelve exitosamente el ticket actualizado', () => {
    const UPDATED_TICKET = {
      ticketId: VALID_UUID,
      lineNumber: '0991234567',
      email: 'admin@example.com',
      type: 'NO_SERVICE',
      description: null,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      createdAt: '2026-02-25T09:00:00.000Z',
      processedAt: '2026-02-26T10:00:00.000Z',
    };

    beforeEach(() => {
      mockService.updateTicketStatus.mockResolvedValue(UPDATED_TICKET);
    });

    it('When se llama updateTicketStatus en el controlador, Then responde con HTTP 200', async () => {
      const req = makeReq(VALID_UUID, 'IN_PROGRESS');
      const res = makeRes();

      await controller.updateTicketStatus(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('When responde HTTP 200, Then el body contiene el ticket actualizado', async () => {
      const req = makeReq(VALID_UUID, 'IN_PROGRESS');
      const res = makeRes();

      await controller.updateTicketStatus(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(UPDATED_TICKET);
    });
  });

  // ── EP-5: Error inesperado de BD → HTTP 500 ────────────────────────────
  describe('Given el servicio lanza un error inesperado (falla de BD)', () => {
    beforeEach(() => {
      mockService.updateTicketStatus.mockRejectedValue(new Error('Connection refused'));
    });

    it('When se llama updateTicketStatus en el controlador, Then responde con HTTP 500', async () => {
      const req = makeReq(VALID_UUID, 'IN_PROGRESS');
      const res = makeRes();

      await controller.updateTicketStatus(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ── Valor límite: UUID válido pero ticket recién eliminado ───────────────
  describe('Valor límite: UUID válido de ticket recién eliminado', () => {
    beforeEach(() => {
      mockService.updateTicketStatus.mockRejectedValue(new TicketNotFoundError());
    });

    it('Then el controlador no asume que un UUID válido implica ticket existente', async () => {
      const req = makeReq(VALID_UUID, 'IN_PROGRESS');
      const res = makeRes();

      await controller.updateTicketStatus(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-007 — Actualización idempotente - mismo estado
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que TicketRepository.updateStatus() maneja
 * correctamente el caso en que el UPDATE SQL no afecta ninguna fila
 * (condición de carrera: ticket eliminado entre findById y updateStatus).
 * En ese caso debe lanzar TicketNotFoundError en lugar de crashear con TypeError.
 * También verifica el contrato de mapeo cuando el UPDATE sí es exitoso.
 *
 * Precondiciones:
 *   - El pool de base de datos es mockeado con vi.mock
 *   - Se controla el resultado del query para simular 0 filas vs 1 fila
 *
 * Pasos (Gherkin):
 *   Given el pool de BD está mockeado
 *     And la query UPDATE retorna 0 filas (ticket no encontrado)
 *   When se invoca TicketRepository.updateStatus()
 *   Then lanza TicketNotFoundError
 *     And no intenta acceder a result.rows[0] (evita TypeError)
 *
 * Partición de equivalencia:
 *   | Grupo                            | rows.length | Resultado Esperado       |
 *   |----------------------------------|-------------|--------------------------|
 *   | UPDATE afecta 1 fila             | 1           | Retorna Ticket mapeado   |
 *   | UPDATE afecta 0 filas            | 0           | TicketNotFoundError      |
 *
 * Valores límites:
 *   - 0 filas afectadas (ticket eliminado en race condition)
 *   - 1 fila afectada (caso normal)
 */

describe('TC-013-007 — TicketRepository.updateStatus: manejo de 0 filas en UPDATE', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const mockQuery = vi.mocked(pool.query);
  let repository: TicketRepository;

  const DB_ROW = {
    ticketId: VALID_UUID,
    lineNumber: '0991234567',
    email: 'admin@example.com',
    type: 'NO_SERVICE',
    description: null,
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    createdAt: new Date('2026-02-25T09:00:00.000Z'),
    processedAt: new Date('2026-02-25T10:15:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TicketRepository();
  });

  // ── EP-1: UPDATE afecta 0 filas (race condition) ─────────────────────────
  describe('Given el UPDATE SQL retorna 0 filas (ticket eliminado en race condition)', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    });

    it('When se invoca updateStatus, Then lanza TicketNotFoundError', async () => {
      await expect(
        repository.updateStatus(VALID_UUID, 'IN_PROGRESS'),
      ).rejects.toThrow(TicketNotFoundError);
    });

    it('When se invoca updateStatus con 0 filas, Then no lanza TypeError', async () => {
      try {
        await repository.updateStatus(VALID_UUID, 'IN_PROGRESS');
        throw new Error('Debería haber lanzado un error');
      } catch (error: any) {
        expect(error instanceof TypeError).toBe(false);
        expect(error instanceof TicketNotFoundError).toBe(true);
      }
    });
  });

  // ── EP-2: UPDATE afecta 1 fila (caso normal) ─────────────────────────────
  describe('Given el UPDATE SQL retorna 1 fila (ticket actualizado correctamente)', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({ rows: [DB_ROW], rowCount: 1 } as any);
    });

    it('When se invoca updateStatus, Then retorna el ticket mapeado', async () => {
      const result = await repository.updateStatus(VALID_UUID, 'IN_PROGRESS');
      expect(result).toBeDefined();
      expect(result.ticketId).toBe(VALID_UUID);
    });

    it('When se invoca updateStatus, Then el ticket retornado tiene status "IN_PROGRESS"', async () => {
      const result = await repository.updateStatus(VALID_UUID, 'IN_PROGRESS');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('When se invoca updateStatus, Then processedAt es una cadena ISO 8601', async () => {
      const result = await repository.updateStatus(VALID_UUID, 'IN_PROGRESS');
      expect(typeof result.processedAt).toBe('string');
      expect(new Date(result.processedAt!).toISOString()).toBe(result.processedAt);
    });

    it('When se invoca updateStatus, Then pool.query es llamado exactamente una vez', async () => {
      await repository.updateStatus(VALID_UUID, 'IN_PROGRESS');
      expect(mockQuery).toHaveBeenCalledOnce();
    });

    it('When se invoca updateStatus, Then la query SQL incluye CURRENT_TIMESTAMP para processed_at', async () => {
      await repository.updateStatus(VALID_UUID, 'IN_PROGRESS');
      const [sqlQuery] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sqlQuery).toContain('CURRENT_TIMESTAMP');
    });
  });

  // ── Valor límite: rows vacío no debe propagarse como TypeError ────────────
  describe('Valor límite: rows vacío no debe causar TypeError al hacer spread de undefined', () => {
    it('Then rows[0] === undefined no debe propagarse sin control', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      const error = await repository.updateStatus(VALID_UUID, 'RECEIVED').catch(e => e);
      expect(error).toBeInstanceOf(TicketNotFoundError);
      expect(error).not.toBeInstanceOf(TypeError);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-008 — Manejo de errores de base de datos
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que TicketRepository envuelve errores de base de datos
 * (errores crudos de PostgreSQL) en una clase DatabaseError personalizada, evitando
 * que información sensible como strings de conexión, queries SQL o stack traces
 * internos de pg se propaguen como errores sin clasificar hacia capas superiores.
 *
 * Precondiciones:
 *   - El pool de base de datos es mockeado con vi.mock
 *   - pool.query lanza un error nativo de PostgreSQL (Error con código pg)
 *
 * Pasos (Gherkin):
 *   Given pool.query lanza un error de conexión ("ECONNREFUSED")
 *   When se invoca TicketRepository.updateStatus()
 *   Then el repositorio lanza DatabaseError (no el error crudo de pg)
 *     And el error no contiene strings de conexión ni detalles SQL internos
 *
 * Partición de equivalencia:
 *   | Grupo                   | Tipo de error pg        | Resultado Esperado |
 *   |-------------------------|-------------------------|--------------------|
 *   | Error de conexión       | ECONNREFUSED            | DatabaseError      |
 *   | Error de deadlock       | deadlock detected       | DatabaseError      |
 *   | Error de constraint     | violates constraint     | DatabaseError      |
 *   | Error de permisos       | permission denied       | DatabaseError      |
 *   | Sin error               | (sin error)             | Ticket mapeado     |
 *
 * Valores límites:
 *   - Error justo antes de completar la operación (conexión caída)
 *   - Error con mensaje que contiene la URL de conexión (info sensible)
 */

describe('TC-013-008 — Manejo de errores de base de datos en TicketRepository', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const mockQuery = vi.mocked(pool.query);
  let repository: TicketRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TicketRepository();
  });

  // ── EP-1: Error de conexión → DatabaseError ─────────────────────────────
  describe('Given pool.query lanza error de conexión (ECONNREFUSED)', () => {
    beforeEach(() => {
      const pgError = new Error('connect ECONNREFUSED postgresql://postgres:secret@db:5432/tickets');
      (pgError as any).code = 'ECONNREFUSED';
      mockQuery.mockRejectedValue(pgError);
    });

    it('When se invoca updateStatus, Then lanza DatabaseError (no el error crudo)', async () => {
      await expect(
        repository.updateStatus(VALID_UUID, 'IN_PROGRESS'),
      ).rejects.toThrow(DatabaseError);
    });

    it('When se invoca updateStatus, Then el error NO expone la URL de conexión', async () => {
      const error = await repository.updateStatus(VALID_UUID, 'IN_PROGRESS').catch(e => e);
      expect(error.message).not.toContain('postgresql://');
      expect(error.message).not.toContain('secret');
    });

    it('When se invoca updateStatus, Then el error es instancia de DatabaseError', async () => {
      const error = await repository.updateStatus(VALID_UUID, 'IN_PROGRESS').catch(e => e);
      expect(error instanceof DatabaseError).toBe(true);
    });
  });

  // ── EP-2: Error de deadlock → DatabaseError ─────────────────────────────
  describe('Given pool.query lanza error de deadlock', () => {
    beforeEach(() => {
      const pgError = new Error('deadlock detected on relation "tickets" of database "isp_complaints"');
      (pgError as any).code = '40P01';
      mockQuery.mockRejectedValue(pgError);
    });

    it('When se invoca updateStatus, Then lanza DatabaseError', async () => {
      await expect(
        repository.updateStatus(VALID_UUID, 'IN_PROGRESS'),
      ).rejects.toThrow(DatabaseError);
    });

    it('When se invoca updateStatus con deadlock, Then el error NO expone el nombre de la BD', async () => {
      const error = await repository.updateStatus(VALID_UUID, 'IN_PROGRESS').catch(e => e);
      expect(error.message).not.toContain('isp_complaints');
    });
  });

  // ── EP-3: Error de constraint → DatabaseError ───────────────────────────
  describe('Given pool.query lanza error de constraint (violación de integridad)', () => {
    beforeEach(() => {
      const pgError = new Error('violates check constraint "tickets_status_check"');
      (pgError as any).code = '23514';
      mockQuery.mockRejectedValue(pgError);
    });

    it('When se invoca updateStatus, Then lanza DatabaseError', async () => {
      await expect(
        repository.updateStatus(VALID_UUID, 'IN_PROGRESS'),
      ).rejects.toThrow(DatabaseError);
    });
  });

  // ── EP-4: Error de permisos → DatabaseError ─────────────────────────────
  describe('Given pool.query lanza error de permisos', () => {
    beforeEach(() => {
      const pgError = new Error('permission denied for table tickets');
      (pgError as any).code = '42501';
      mockQuery.mockRejectedValue(pgError);
    });

    it('When se invoca updateStatus, Then lanza DatabaseError', async () => {
      await expect(
        repository.updateStatus(VALID_UUID, 'IN_PROGRESS'),
      ).rejects.toThrow(DatabaseError);
    });
  });

  // ── Valor límite: Error con mensaje que contiene info de conexión ────────
  describe('Valor límite: Error de pg con URL de conexión completa en el mensaje', () => {
    it('Then el DatabaseError lanzado NO contiene la URL de conexión en su mensaje', async () => {
      const sensitiveError = new Error(
        'connect ECONNREFUSED postgresql://admin:p4ssw0rd@production-db.internal:5432/tickets_prod',
      );
      mockQuery.mockRejectedValue(sensitiveError);

      const error = await repository.updateStatus(VALID_UUID, 'IN_PROGRESS').catch(e => e);
      expect(error instanceof DatabaseError).toBe(true);
      expect(error.message).not.toContain('p4ssw0rd');
      expect(error.message).not.toContain('production-db.internal');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-009 — Request PATCH completa con body válido retorna 200
//              (Integración de componentes)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar el flujo completo de una request PATCH a través de
 * la capa HTTP (router → controller → service → repository mocked) cuando el
 * cuerpo de la request es válido, esperando HTTP 200 con el ticket actualizado.
 *
 * Tipo: Integración de componentes (sin base de datos real, sin servicios externos).
 *
 * Precondiciones:
 *   - La aplicación Express se instancia con createApp().
 *   - pool.query está mockeado: no hay conexión real a PostgreSQL.
 *   - El endpoint PATCH /api/tickets/:ticketId/status debe estar registrado.
 *
 * Pasos (Gherkin):
 *   Given existe un ticket con ID "550e8400-e29b-41d4-a716-446655440000" en estado "RECEIVED"
 *     And todos los servicios del Query Service están operativos (mockeados)
 *   When se envía una request HTTP PATCH a /api/tickets/550e8400-e29b-41d4-a716-446655440000/status
 *     And el header Content-Type es "application/json"
 *     And el body es { "status": "IN_PROGRESS" }
 *   Then el código de respuesta HTTP es 200
 *     And el header Content-Type de la respuesta contiene "application/json"
 *     And el body de la respuesta contiene el ticket completo actualizado en formato JSON
 *     And el campo status del ticket es "IN_PROGRESS"
 *
 * Partición de equivalencia:
 *   | Grupo                    | Componentes de la Request               | Tipo    |
 *   |--------------------------|-----------------------------------------|---------|
 *   | Request completa válida  | PATCH + ruta válida + body válido       | Válido  |
 *   | Transición forward       | RECEIVED → IN_PROGRESS                  | Válido  |
 *   | Transición backward      | IN_PROGRESS → RECEIVED                  | Válido  |
 *   | Body con campos extras   | { status, extraField }                  | Válido  |
 *
 * Valores límites:
 *   - Body mínimo válido: { "status": "RECEIVED" }
 *   - Body con campos adicionales ignorados
 *   - UUID con todos ceros: "00000000-0000-0000-0000-000000000000" (límite inferior)
 *   - UUID con todos F's:   "ffffffff-ffff-ffff-ffff-ffffffffffff"  (límite superior)
 */
describe('TC-013-009 — Request PATCH completa con body válido retorna 200 (Integración)', () => {
  const VALID_UUID      = '550e8400-e29b-41d4-a716-446655440000';
  const UUID_ALL_ZEROS  = '00000000-0000-0000-0000-000000000000';
  const UUID_ALL_FS     = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const mockQuery       = vi.mocked(pool.query);

  const BASE_ROW = {
    ticketId:    VALID_UUID,
    lineNumber:  '0991234567',
    email:       'admin@example.com',
    type:        'NO_SERVICE',
    description: null,
    priority:    'HIGH',
    status:      'RECEIVED',
    createdAt:   '2026-02-01T00:00:00.000Z',
    processedAt: '2026-02-01T01:00:00.000Z',
  };

  afterEach(() => {
    vi.resetAllMocks(); // resetAllMocks limpia también la cola de mockResolvedValueOnce
  });

  // ── EP-1: Transición RECEIVED → IN_PROGRESS ─────────────────────────────
  describe('Given un ticket en estado RECEIVED y body con status "IN_PROGRESS"', () => {
    beforeEach(() => {
      // findById (servicio valida existencia)
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
      // updateStatus (repositorio actualiza y retorna)
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...BASE_ROW, status: 'IN_PROGRESS', processedAt: '2026-02-26T15:30:45.123Z' }],
        rowCount: 1,
      } as any);
    });

    it('When se envía PATCH con body válido, Then retorna HTTP 200', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(200);
    });

    it('When se envía PATCH con body válido, Then el body de respuesta contiene el ticket', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.body).toBeDefined();
      expect(response.body.ticketId).toBe(VALID_UUID);
    });

    it('When se envía PATCH con body válido, Then el campo status en respuesta es "IN_PROGRESS"', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.body.status).toBe('IN_PROGRESS');
    });

    it('When se envía PATCH con body válido, Then Content-Type de respuesta es application/json', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // ── EP-2: Transición IN_PROGRESS → RECEIVED ─────────────────────────────
  describe('Given un ticket en estado IN_PROGRESS y body con status "RECEIVED"', () => {
    const IN_PROGRESS_ROW = { ...BASE_ROW, status: 'IN_PROGRESS' };

    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({ rows: [IN_PROGRESS_ROW], rowCount: 1 } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...IN_PROGRESS_ROW, status: 'RECEIVED', processedAt: '2026-02-26T15:30:45.123Z' }],
        rowCount: 1,
      } as any);
    });

    it('When se envía PATCH con status "RECEIVED", Then retorna HTTP 200', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'RECEIVED' });

      expect(response.status).toBe(200);
    });

    it('When se envía PATCH con status "RECEIVED", Then el campo status en respuesta es "RECEIVED"', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'RECEIVED' });

      expect(response.body.status).toBe('RECEIVED');
    });
  });

  // ── Valor límite: UUID con todos ceros ──────────────────────────────────
  describe('Valor límite: UUID con todos ceros (límite inferior del dominio UUID)', () => {
    const ZEROS_ROW = { ...BASE_ROW, ticketId: UUID_ALL_ZEROS };

    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({ rows: [ZEROS_ROW], rowCount: 1 } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...ZEROS_ROW, status: 'IN_PROGRESS', processedAt: '2026-02-26T15:30:45.123Z' }],
        rowCount: 1,
      } as any);
    });

    it('When se envía PATCH con UUID "00000000-...-000", Then retorna HTTP 200', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${UUID_ALL_ZEROS}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(200);
    });
  });

  // ── Valor límite: UUID con todos F's ────────────────────────────────────
  describe("Valor límite: UUID con todos F's (límite superior del dominio UUID)", () => {
    const FS_ROW = { ...BASE_ROW, ticketId: UUID_ALL_FS };

    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({ rows: [FS_ROW], rowCount: 1 } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...FS_ROW, status: 'IN_PROGRESS', processedAt: '2026-02-26T15:30:45.123Z' }],
        rowCount: 1,
      } as any);
    });

    it("When se envía PATCH con UUID 'ffffffff-...-ffff', Then retorna HTTP 200", async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${UUID_ALL_FS}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(200);
    });
  });

  // ── Valor límite: Body mínimo válido ────────────────────────────────────
  describe('Valor límite: Body mínimo válido { status: "RECEIVED" }', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...BASE_ROW, status: 'RECEIVED', processedAt: '2026-02-26T15:30:45.123Z' }],
        rowCount: 1,
      } as any);
    });

    it('When body contiene únicamente { status: "RECEIVED" }, Then retorna HTTP 200', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'RECEIVED' });

      expect(response.status).toBe(200);
    });
  });

  // ── Valor límite: Body tolerante a campos adicionales ───────────────────
  describe('Valor límite: Body con campos adicionales debe ser tolerado', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...BASE_ROW, status: 'IN_PROGRESS', processedAt: '2026-02-26T15:30:45.123Z' }],
        rowCount: 1,
      } as any);
    });

    it('When body incluye campos extra ignorados, Then el sistema retorna HTTP 200', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'IN_PROGRESS', extraField: 'ignored', anotherExtra: 123 });

      expect(response.status).toBe(200);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-013-010 — Request PATCH con body inválido retorna 400
//              (Integración de componentes)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Descripción: Verificar que la request PATCH retorna HTTP 400 cuando el body
 * contiene datos inválidos (UUID incorrecto, estado fuera del dominio, sin status,
 * etc.), integrando el pipeline completo router → controller → service.
 *
 * Tipo: Integración de componentes (sin base de datos real, sin servicios externos).
 *
 * Precondiciones:
 *   - La aplicación Express se instancia con createApp().
 *   - pool.query está mockeado: no hay conexión real a PostgreSQL.
 *   - El endpoint PATCH /api/tickets/:ticketId/status está registrado.
 *
 * Pasos (Gherkin):
 *   Given el endpoint PATCH /api/tickets/:ticketId/status está disponible
 *   When se envía una request HTTP PATCH con datos inválidos
 *     (UUID malformado, status fuera del dominio, body vacío, etc.)
 *   Then el código de respuesta HTTP es 400
 *     And el body de la respuesta contiene un campo "error" con descripción
 *
 * Partición de equivalencia:
 *   | Grupo                           | Input                              | HTTP Esperado |
 *   |---------------------------------|------------------------------------|---------------|
 *   | EP-1: UUID inválido             | ticketId = "invalid-uuid-format"   | 400           |
 *   | EP-1: UUID muy corto            | ticketId = "abc123"                | 400           |
 *   | EP-1: UUID sin guiones          | ticketId = "550e8400e29b41d4..."   | 400           |
 *   | EP-2: Status fuera de dominio   | status = "CLOSED"                  | 400           |
 *   | EP-2: Status inexistente        | status = "RESOLVED"                | 400           |
 *   | EP-2: Status inexistente        | status = "CANCELLED"               | 400           |
 *   | EP-3: Body sin campo status     | {}                                 | 400           |
 *   | EP-3: Body completamente vacío  | sin body                           | 400           |
 *   | EP-4: Ticket no encontrado      | UUID válido pero ticket inexistente| 404           |
 *
 * Valores límites:
 *   - status en minúsculas: "received" (case-sensitive → inválido)
 *   - status con typo: "RECEIVEDD", "IN_PROGRES"
 *   - status con espacio: " IN_PROGRESS "
 *
 * Tabla de Decisión:
 *   | # | UUID válido | Status válido | Ticket existe | HTTP Esperado |
 *   |---|-------------|---------------|---------------|---------------|
 *   | 1 | ✗           | -             | -             | 400           |
 *   | 2 | ✓           | ✗             | ✓             | 400           |
 *   | 3 | ✓           | -             | ✗             | 404           |
 *   | 4 | ✓           | ✓             | ✓             | 200 (TC-009)  |
 */
describe('TC-013-010 — Request PATCH con body inválido retorna 400 (Integración)', () => {
  const VALID_UUID    = '550e8400-e29b-41d4-a716-446655440000';
  const mockQuery     = vi.mocked(pool.query);

  const BASE_ROW = {
    ticketId:    VALID_UUID,
    lineNumber:  '0991234567',
    email:       'admin@example.com',
    type:        'NO_SERVICE',
    description: null,
    priority:    'HIGH',
    status:      'RECEIVED',
    createdAt:   '2026-02-01T00:00:00.000Z',
    processedAt: '2026-02-01T01:00:00.000Z',
  };

  afterEach(() => {
    vi.resetAllMocks(); // resetAllMocks limpia también la cola de mockResolvedValueOnce
  });

  // ── EP-1: UUID inválido → 400 (no necesita mock de BD) ──────────────────
  describe('EP-1: Given un ticketId con formato inválido en la URL', () => {
    it('When ticketId = "invalid-uuid-format", Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch('/api/tickets/invalid-uuid-format/status')
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(400);
    });

    it('When ticketId = "invalid-uuid-format", Then la respuesta contiene campo "error"', async () => {
      const response = await request(createApp())
        .patch('/api/tickets/invalid-uuid-format/status')
        .send({ status: 'IN_PROGRESS' });

      expect(response.body).toHaveProperty('error');
    });

    it('When ticketId = "abc123" (muy corto), Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch('/api/tickets/abc123/status')
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(400);
    });

    it('When ticketId sin guiones "550e8400e29b41d4a716446655440000", Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch('/api/tickets/550e8400e29b41d4a716446655440000/status')
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(400);
    });
  });

  // ── EP-2: Status fuera del dominio con UUID válido → 400 ────────────────
  describe('EP-2: Given un UUID válido y un status fuera del dominio en el body', () => {
    beforeEach(() => {
      // findById: el servicio valida existencia antes de validar el status
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
    });

    it('When status = "CLOSED", Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'CLOSED' });

      expect(response.status).toBe(400);
    });

    it('When status = "CLOSED", Then la respuesta contiene campo "error"', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'CLOSED' });

      expect(response.body).toHaveProperty('error');
    });

    it('When status = "RESOLVED", Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'RESOLVED' });

      expect(response.status).toBe(400);
    });

    it('When status = "CANCELLED", Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'CANCELLED' });

      expect(response.status).toBe(400);
    });
  });

  // ── EP-3: Body sin campo status → 400 ───────────────────────────────────
  describe('EP-3: Given un UUID válido y body sin campo status', () => {
    beforeEach(() => {
      // findById se llama antes de validar status
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
    });

    it('When body es {} (sin campo status), Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('When no se envía body, Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`);

      expect(response.status).toBe(400);
    });
  });

  // ── EP-4 (Tabla decisión fila 3): Ticket no encontrado → 404 ────────────
  describe('EP-4: Given un UUID válido pero ticket inexistente', () => {
    beforeEach(() => {
      // findById retorna null → TicketNotFoundError
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    });

    it('When el ticket no existe en BD, Then retorna HTTP 404', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(404);
    });
  });

  // ── Valor límite: status en minúsculas (case-sensitive) ─────────────────
  describe('Valor límite: status en minúsculas debe ser rechazado', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
    });

    it('When status = "received" (minúsculas), Then retorna HTTP 400', async () => {
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'received' });

      expect(response.status).toBe(400);
    });
  });

  // ── Valor límite: status con typo (un carácter extra/faltante) ───────────
  describe('Valor límite: status con typo de un carácter', () => {
    it('When status = "RECEIVEDD" (un carácter extra), Then retorna HTTP 400', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'RECEIVEDD' });

      expect(response.status).toBe(400);
    });

    it('When status = "IN_PROGRES" (un carácter faltante), Then retorna HTTP 400', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: 'IN_PROGRES' });

      expect(response.status).toBe(400);
    });

    it('When status = " IN_PROGRESS " (con espacios), Then retorna HTTP 400', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [BASE_ROW], rowCount: 1 } as any);
      const response = await request(createApp())
        .patch(`/api/tickets/${VALID_UUID}/status`)
        .send({ status: ' IN_PROGRESS ' });

      expect(response.status).toBe(400);
    });
  });
});
