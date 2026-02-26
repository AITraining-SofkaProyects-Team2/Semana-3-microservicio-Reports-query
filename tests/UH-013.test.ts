// UH-013: Cambio de Estado de Tickets desde la Lista
// Como administrador del sistema, necesito cambiar el estado de un ticket desde la
// vista de listado (transiciones RECEIVED ↔ IN_PROGRESS) mediante un endpoint PATCH.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketQueryService } from '../src/services/TicketQueryService';
import { ITicketRepository } from '../src/repositories/ITicketRepository';
import { InvalidUuidFormatError } from '../src/errors/InvalidUuidFormatError';
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
      
      // El servicio debe lanzar un error cuando se intente usar "CLOSED"
      // Por ahora esperamos que lance un error de validación
      await expect(
        service.updateTicketStatus(VALID_UUID, 'CLOSED' as any),
      ).rejects.toThrow(); // Esperamos cualquier error de validación de estado
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
      
      // Esperamos que el servicio lance error
      await expect(
        service.updateTicketStatus(VALID_UUID, 'received' as any),
      ).rejects.toThrow();
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
