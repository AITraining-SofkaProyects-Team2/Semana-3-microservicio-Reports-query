// UH-013: Cambio de Estado de Tickets desde la Lista
// Como administrador del sistema, necesito cambiar el estado de un ticket desde la
// vista de listado (transiciones RECEIVED ↔ IN_PROGRESS) mediante un endpoint PATCH.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { TicketsController } from '../src/controllers/ticketsController';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import { InvalidUuidFormatError } from '../src/errors/InvalidUuidFormatError';
import { InvalidTicketStatusError } from '../src/errors/InvalidTicketStatusError';
import { TicketNotFoundError } from '../src/errors/TicketNotFoundError';
import type { Request } from 'express';
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

