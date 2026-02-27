# ARCHITECTURE.md — Refactorización de Endpoints y Verbos HTTP

**Proyecto:** Reports Query Service (Microservicio de consultas de tickets ISP)  
**Fecha:** 26 de febrero de 2026  
**Realizado por:** SoftwareArchitect Agent  

---

## 1. Resumen Ejecutivo

Se refactorizaron todos los endpoints del microservicio de consulta para garantizar el uso correcto y semántico de los verbos HTTP. Al ser un **Query Service** (lado de lectura en CQRS), todos los endpoints de dominio deben usar exclusivamente `GET`. Se detectaron endpoints faltantes (búsqueda por ID y por número de línea), un controlador con `try-catch` embebido (violando el principio de controladores delgados), ausencia de middleware centralizado de errores, y un riesgo de colisión de rutas entre `/api/tickets/metrics` y `/:ticketId`.

---

## 2. Estado Anterior (ANTES de la refactorización)

### 2.1 Endpoints registrados

| Verbo  | Ruta                      | Ubicación              | Propósito                          |
|--------|---------------------------|------------------------|------------------------------------|
| `GET`  | `/health`                 | `src/index.ts`         | Health check                       |
| `GET`  | `/api/tickets`            | `src/routes/tickets.routes.ts` | Listado paginado con filtros |
| `GET`  | `/api/tickets/metrics`    | `src/index.ts`         | Métricas agregadas                 |
| `POST` | `/__test__/seed`          | `src/index.ts`         | Seed de datos (solo test)          |
| `POST` | `/__test__/clear`         | `src/index.ts`         | Limpieza de datos (solo test)      |

### 2.2 Problemas identificados

#### P-01: Endpoints faltantes para métodos del servicio
- **Severidad:** Alta
- **Ubicación:** `src/routes/tickets.routes.ts`, `src/controllers/ticketsController.ts`
- **Descripción:** `TicketQueryService` expone `findById(ticketId)` y `findByLineNumber(lineNumber)`, pero no existían rutas HTTP para exponerlos. Las historias HU-06 y HU-07 los prueban a nivel de servicio, pero no eran accesibles vía HTTP.
- **Impacto:** Funcionalidad implementada en el servicio que no era consumible por el frontend ni otros clientes.

#### P-02: Controlador con try-catch (violación de SRP)
- **Severidad:** Media
- **Ubicación:** `src/controllers/ticketsController.ts`
- **Descripción:** El método `getTickets` tenía un bloque `try-catch` interno que manejaba errores directamente, en lugar de delegar al middleware centralizado de errores (Chain of Responsibility).
- **Impacto:** Violación de las reglas de implementación del proyecto ("No usar try-catch en controladores") y duplicación de lógica de manejo de errores.

#### P-03: Ausencia de middleware centralizado de errores
- **Severidad:** Media
- **Ubicación:** `src/index.ts`
- **Descripción:** No existía un `errorHandler` registrado como middleware de Express. Cada ruta manejaba sus errores individualmente.
- **Impacto:** Sin Chain of Responsibility; cada endpoint debía manejar sus propios errores, generando inconsistencias en las respuestas de error.

#### P-04: Ruta de métricas declarada DESPUÉS del router (riesgo de colisión)
- **Severidad:** Alta
- **Ubicación:** `src/index.ts`
- **Descripción:** `app.use('/api/tickets', ticketRoutes)` estaba antes de `app.get('/api/tickets/metrics', ...)`. Al agregar `/:ticketId` al router, la ruta `/api/tickets/metrics` sería capturada por el parámetro dinámico (`ticketId = "metrics"`), retornando un error de UUID inválido en lugar de las métricas.
- **Impacto:** El endpoint de métricas dejaría de funcionar al agregar la ruta de búsqueda por ID.

#### P-05: Archivo de rutas duplicado
- **Severidad:** Baja
- **Ubicación:** `src/routes/tickets.ts` y `src/routes/tickets.routes.ts`
- **Descripción:** Ambos archivos contenían código idéntico. `tickets.routes.ts` es importado por `index.ts`; `tickets.ts` no era usado.
- **Impacto:** Confusión para desarrolladores, potencial fuente de inconsistencias futuras.

#### P-06: Sin wrapper para handlers async
- **Severidad:** Media
- **Ubicación:** `src/routes/tickets.routes.ts`
- **Descripción:** Express 4 no captura automáticamente las promesas rechazadas en handlers async. Sin un wrapper, las excepciones asíncronas generarían `UnhandledPromiseRejection` en lugar de ser procesadas por el error handler.
- **Impacto:** Crashes silenciosos del servidor en producción cuando un handler async lanza una excepción.

---

## 3. Cambios Realizados

### 3.1 Tabla de endpoints refactorizada (DESPUÉS)

| Verbo  | Ruta                              | Handler                                | Propósito                          |
|--------|-----------------------------------|----------------------------------------|------------------------------------|
| `GET`  | `/health`                         | inline (`index.ts`)                    | Health check                       |
| `GET`  | `/api/tickets`                    | `TicketsController.getTickets`         | Listado paginado con filtros       |
| `GET`  | `/api/tickets/metrics`            | inline (`index.ts`, MetricsService)    | Métricas agregadas                 |
| `GET`  | `/api/tickets/line/:lineNumber`   | `TicketsController.getTicketsByLineNumber` | Búsqueda por número de línea   |
| `GET`  | `/api/tickets/:ticketId`          | `TicketsController.getTicketById`      | Búsqueda por ID (UUID)            |
| `POST` | `/__test__/seed`                  | inline (`index.ts`, solo NODE_ENV=test)| Seed de datos de prueba            |
| `POST` | `/__test__/clear`                 | inline (`index.ts`, solo NODE_ENV=test)| Limpieza de datos de prueba        |

### 3.2 Justificación de verbos HTTP

| Verbo   | Semántica HTTP                    | Uso en este servicio                           |
|---------|-----------------------------------|------------------------------------------------|
| `GET`   | Lectura idempotente, sin efectos secundarios | **Todos los endpoints de dominio** — coherente con CQRS read-side |
| `POST`  | Creación / acción con efectos secundarios | Solo endpoints de testing (`/__test__/*`) — mutan estado |

> **Principio aplicado:** En un Query Service, el 100% de los endpoints de dominio deben ser `GET`. Las operaciones de escritura pertenecen al Command Service (Producer/Consumer).

### 3.3 Orden de declaración de rutas (crítico)

```
index.ts
  ├── GET /health                         ← Path fijo
  ├── GET /api/tickets/metrics            ← Path fijo (ANTES del router)
  ├── USE /api/tickets → ticketRoutes
  │     ├── GET /                         ← Listado
  │     ├── GET /line/:lineNumber         ← Path fijo con parámetro delimitado
  │     └── GET /:ticketId               ← Parámetro dinámico (ÚLTIMO)
  └── USE errorHandler                    ← Middleware de errores (al final)
```

**¿Por qué este orden?**
- `/api/tickets/metrics` se declara ANTES de montar el router para que Express lo resuelva primero y no sea capturado por `/:ticketId`.
- `/:ticketId` va al FINAL del router para no capturar rutas como `/line/:lineNumber`.

---

## 4. Archivos Creados

### 4.1 `src/utils/asyncHandler.ts`
```typescript
// Wrapper para handlers async de Express.
// Captura errores y los delega a next() → errorHandler middleware.
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};
```
**Justificación:** Express 4 no maneja promesas rechazadas automáticamente. Este wrapper garantiza que cualquier error en un handler async sea capturado y enviado al middleware centralizado.

### 4.2 `src/middlewares/errorHandler.ts`
```typescript
// Middleware centralizado de errores (Chain of Responsibility)
// Cadena: InvalidUuidFormatError → 400
//         TicketNotFoundError    → 404
//         Error con .status      → status dinámico
//         Error genérico         → 500
```
**Justificación:** Patrón Chain of Responsibility requerido por las instrucciones del proyecto. Centraliza el mapeo error→HTTP status, eliminando try-catch de los controladores.

---

## 5. Archivos Modificados

### 5.1 `src/controllers/ticketsController.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| Métodos | Solo `getTickets` | `getTickets`, `getTicketById`, `getTicketsByLineNumber` |
| Error handling | try-catch interno → `res.status(500)` | Sin try-catch; errores propagados al errorHandler |
| Query param `incidentType` | No soportado (solo `type`) | Soportado como alias (`incidentType \|\| type`) |

### 5.2 `src/routes/tickets.routes.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| Rutas | Solo `GET /` | `GET /`, `GET /line/:lineNumber`, `GET /:ticketId` |
| Handler wrapping | Callback directo | `asyncHandler()` wrapper |
| Imports | Sin asyncHandler | Con asyncHandler |

### 5.3 `src/index.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| Orden de rutas | Router ANTES de métricas | Métricas ANTES del router |
| Error handler | No existía | `app.use(errorHandler)` al final |
| Import | Sin errorHandler | Con errorHandler |
| Métricas error handling | try-catch → `res.status(500)` | try-catch → `next(error)` |

### 5.4 `src/routes/tickets.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| Contenido | Duplicado completo de tickets.routes.ts | Re-export de tickets.routes.ts con `@deprecated` |

---

## 6. Diagrama de flujo HTTP actualizado

```
Cliente HTTP
  │
  ▼
Express App
  │
  ├─ GET /health ──────────────────────────────→ { status: "ok" }
  │
  ├─ GET /api/tickets/metrics ─────────────────→ MetricsService.getMetrics()
  │                                                 │
  │                                                 └─→ { totalTickets, byStatus, byPriority, byType }
  │
  ├─ GET /api/tickets ─────────────────────────→ TicketsController.getTickets()
  │   ?status=X&priority=Y&type=Z                   │
  │   &dateFrom=A&dateTo=B                           └─→ TicketQueryService.getTickets(filters)
  │   &page=N&limit=M                                      │
  │                                                         └─→ ITicketRepository.findAll()
  │
  ├─ GET /api/tickets/line/:lineNumber ────────→ TicketsController.getTicketsByLineNumber()
  │                                                 │
  │                                                 └─→ TicketQueryService.findByLineNumber()
  │                                                       │
  │                                                       └─→ ITicketRepository.findByLineNumber()
  │
  ├─ GET /api/tickets/:ticketId ───────────────→ TicketsController.getTicketById()
  │                                                 │
  │                                                 └─→ TicketQueryService.findById()
  │                                                       │
  │                                                       ├─→ UUID inválido → InvalidUuidFormatError → 400
  │                                                       ├─→ No encontrado → TicketNotFoundError → 404
  │                                                       └─→ Encontrado → 200 + Ticket
  │
  └─ errorHandler middleware ──────────────────→ Mapea excepciones a HTTP status codes
      InvalidUuidFormatError  → 400
      TicketNotFoundError     → 404
      Error { status: N }     → N
      Error genérico          → 500
```

---

## 7. Patrones aplicados

| Patrón | Ubicación | Descripción |
|--------|-----------|-------------|
| **Chain of Responsibility** | `src/middlewares/errorHandler.ts` | Cada tipo de error se evalúa en cadena hasta encontrar su handler |
| **Facade** | `TicketsController` | Fachada delgada entre HTTP y lógica de negocio |
| **DIP (Inversión de Dependencias)** | Controller → Service → IRepository | Controller depende de abstracción (TicketQueryService), no de implementación |
| **SRP (Responsabilidad Única)** | Controller sin try-catch | El controller solo traduce HTTP↔dominio; el error handler maneja errores |
| **Strategy** | `MetricsService` | Estrategias de agregación por status/priority/type (ya existente) |

---

## 8. Notas adicionales

### 8.1 Inconsistencia detectada en tests (no corregida)
Los tests de `tests/HU-02.test.ts` usan la ruta `/v1/tickets` en lugar de `/api/tickets`. Esto no corresponde a ninguna ruta del servidor. Se recomienda unificar a `/api/tickets` o crear un alias `/v1/tickets` si se requiere versionado de API.

### 8.2 Archivo duplicado `src/routes/tickets.ts`
Se convirtió en un re-export con anotación `@deprecated`. Se recomienda eliminar este archivo y actualizar cualquier import que lo reference.

### 8.3 Endpoints de testing (`/__test__/*`)
Los endpoints `POST /__test__/seed` y `POST /__test__/clear` usan `POST` correctamente ya que son operaciones de escritura (mutan estado). Solo se registran cuando `NODE_ENV === 'test'`.

---

## 9. Verificación post-refactorización

- [x] Compila en TypeScript estricto sin errores
- [x] Todos los endpoints de dominio usan `GET` (semántica correcta para Query Service)
- [x] Ruta `/api/tickets/metrics` se declara antes del router para evitar colisión con `/:ticketId`
- [x] `/:ticketId` se declara al final del router para evitar capturar paths fijos
- [x] Controller sin try-catch; errores delegados a middleware centralizado
- [x] `asyncHandler` wrappea todos los handlers async
- [x] `errorHandler` registrado como último middleware
- [x] Archivo duplicado `tickets.ts` refactorizado como re-export

---
---

# Refactorización 2: Códigos de Estado HTTP

**Fecha:** 26 de febrero de 2026  
**Realizado por:** SoftwareArchitect Agent  

---

## 10. Resumen Ejecutivo

Se refactorizaron todos los endpoints para manejar adecuadamente **todos los códigos de estado HTTP** relevantes. Se identificaron múltiples escenarios donde la API no retornaba el status code correcto: parámetros de query inválidos pasaban sin validación al repositorio, el error de número de línea inválido retornaba 500 en lugar de 400, no existía respuesta 405 para métodos no-GET, ni 404 para rutas desconocidas. Se creó una clase `ValidationError` con cuerpo de respuesta personalizable y se implementó validación exhaustiva en el servicio para todos los filtros de consulta.

---

## 11. Estado Anterior (ANTES de la refactorización de status codes)

### 11.1 Mapa de status codes por endpoint

| Endpoint | 200 | 400 | 404 | 405 | 500 |
|----------|:---:|:---:|:---:|:---:|:---:|
| `GET /health` | ✅ | — | — | — | — |
| `GET /api/tickets` | ✅ | ❌ Sin validación de params | — | — | ✅ |
| `GET /api/tickets/metrics` | ✅ | — | — | — | ✅ |
| `GET /api/tickets/line/:lineNumber` | ✅ | ❌ Error genérico → 500 | — | — | ✅ |
| `GET /api/tickets/:ticketId` | ✅ | ✅ InvalidUuidFormatError | ✅ TicketNotFoundError | — | ✅ |
| `POST /api/tickets` | — | — | — | ❌ Sin handler | — |
| Rutas desconocidas | — | — | ❌ Sin catch-all | — | — |

### 11.2 Problemas identificados

#### P-07: Sin validación de query params en GET /api/tickets
- **Severidad:** Alta
- **Ubicación:** `src/services/TicketQueryService.ts`, `src/controllers/ticketsController.ts`
- **Descripción:** Los parámetros `priority`, `status`, `type`/`incidentType`, `dateFrom`, `dateTo`, `sortBy`, `page` y `limit` no se validaban antes de enviarlos al repositorio. Valores inválidos como `priority=CRITICAL`, `status=CLOSED`, `incidentType=HARDWARE_FAILURE`, fechas malformadas o rango invertido pasaban directo a la query SQL.
- **Impacto:** El endpoint retornaba resultados vacíos en lugar de 400, o fallaba con 500 si la DB rechazaba el valor. Los tests HU-02 (TC-011), HU-03 (TC-016), HU-04 (TC-021), HU-05 (TC-023, TC-027) y HU-08 (TC-039) esperan HTTP 400 explícito.

#### P-08: lineNumber inválido retorna 500 en vez de 400
- **Severidad:** Media
- **Ubicación:** `src/services/TicketQueryService.ts` → `findByLineNumber()`
- **Descripción:** El método lanzaba `new Error(...)` genérico sin propiedad `status`. El `errorHandler` lo trataba como error no controlado → HTTP 500.
- **Impacto:** Error semántico: un input inválido del usuario (lineNumber mal formateado) se reportaba como error interno del servidor.

#### P-09: Sin respuesta 405 Method Not Allowed
- **Severidad:** Media
- **Ubicación:** `src/index.ts`
- **Descripción:** Al enviar POST/PUT/DELETE/PATCH a rutas como `/api/tickets`, Express no encontraba handler y la request caía en silencio o retornaba el HTML por defecto de Express.
- **Impacto:** Incumplimiento de RFC 7231 §6.5.5. El cliente no recibía indicación clara de que el método era incorrecto.

#### P-10: Sin respuesta 404 para rutas inexistentes
- **Severidad:** Media
- **Ubicación:** `src/index.ts`
- **Descripción:** No existía un middleware catch-all para rutas desconocidas. Una solicitud a `/api/unknown` no recibía respuesta JSON estructurada.
- **Impacto:** Respuesta inconsistente (HTML genérico de Express en lugar de JSON con error descriptivo).

#### P-11: sortBy/sortOrder no se extraían del request
- **Severidad:** Baja
- **Ubicación:** `src/controllers/ticketsController.ts`
- **Descripción:** El controlador no extraía `sortBy` ni `sortOrder` de `req.query`, por lo que estos parámetros se ignoraban silenciosamente.
- **Impacto:** Los tests HU-08 (TC-039) esperan validación y HTTP 400 para campos de ordenamiento inválidos.

---

## 12. Cambios Realizados

### 12.1 Mapa de status codes ACTUALIZADO

| Endpoint | 200 | 400 | 404 | 405 | 500 |
|----------|:---:|:---:|:---:|:---:|:---:|
| `GET /health` | ✅ | — | — | — | — |
| `GET /api/tickets` | ✅ | ✅ Validación completa | — | — | ✅ |
| `GET /api/tickets/metrics` | ✅ | — | — | — | ✅ |
| `GET /api/tickets/line/:lineNumber` | ✅ | ✅ ValidationError | — | — | ✅ |
| `GET /api/tickets/:ticketId` | ✅ | ✅ InvalidUuidFormatError | ✅ TicketNotFoundError | — | ✅ |
| `POST/PUT/DELETE /api/*` | — | — | — | ✅ 405 + `Allow: GET` | — |
| Rutas desconocidas | — | — | ✅ 404 JSON | — | — |

### 12.2 Validaciones implementadas en `TicketQueryService.getTickets()`

| Parámetro | Validación | Error si inválido | Status |
|-----------|-----------|-------------------|--------|
| `priority` | Debe ser `HIGH\|MEDIUM\|LOW\|PENDING` (o undefined) | `La prioridad "X" no es una prioridad válida...` | 400 |
| `status` | Debe ser `RECEIVED\|IN_PROGRESS` (o undefined). Acepta array. | `"X" no es un estado válido` + `validValues` | 400 |
| `type`/`incidentType` | Debe ser uno de los 6 `IncidentType` (o undefined) | `El tipo de incidente "X" no es válido` | 400 |
| `dateFrom` | Formato ISO-8601 válido | `Formato de fecha inválido para dateFrom...` | 400 |
| `dateTo` | Formato ISO-8601 válido | `Formato de fecha inválido para dateTo...` | 400 |
| `dateFrom + dateTo` | `dateFrom ≤ dateTo` | `dateTo debe ser mayor o igual a dateFrom` | 400 |
| `page` | Entero positivo ≥ 1 | `El parámetro "page" debe ser un entero positivo` | 400 |
| `limit` | Entero positivo ≥ 1 | `El parámetro "limit" debe ser un entero positivo` | 400 |
| `sortBy` | Debe ser `createdAt\|priority\|status` (o undefined) | `Campo de ordenamiento inválido: X...` | 400 |
| `sortOrder` | Debe ser `asc\|desc` (o undefined) | `Orden de ordenamiento inválido: X...` | 400 |

### 12.3 Cadena de errores actualizada (Chain of Responsibility)

```
Error lanzado en servicio/controlador
  │
  ▼ asyncHandler captura → next(error)
  │
  ▼ errorHandler middleware evalúa:
  │
  ├─ ValidationError?        → 400 + responseBody personalizado
  │   (prioridad, status, tipo, fecha, paginación, sort, lineNumber)
  │
  ├─ InvalidUuidFormatError? → 400 + { error: "Formato de ID inválido" }
  │
  ├─ TicketNotFoundError?    → 404 + { error: "Ticket no encontrado" }
  │
  ├─ Error con .status?      → status dinámico + { error: message }
  │   (compatibilidad con ticketsService.ts legacy)
  │
  └─ Error genérico          → 500 + { error: "Internal server error" }
```

### 12.4 Orden completo de middlewares en Express

```
Express App
  │
  ├── express.json()                               ← Body parser
  ├── POST /__test__/seed (solo test)              ← 204 No Content
  ├── POST /__test__/clear (solo test)             ← 204 No Content
  │
  ├── GET /health                                  ← 200
  ├── GET /api/tickets/metrics                     ← 200 | 500
  ├── USE /api/tickets → ticketRoutes
  │     ├── GET /                                  ← 200 | 400 | 500
  │     ├── GET /line/:lineNumber                  ← 200 | 400 | 500
  │     └── GET /:ticketId                         ← 200 | 400 | 404 | 500
  │
  ├── USE /api → 405 (si método ≠ GET)             ← 405 + Allow: GET
  ├── USE * → 404 catch-all                        ← 404
  └── USE errorHandler (4 args)                    ← 400 | 404 | 500
```

---

## 13. Archivos Creados

### 13.1 `src/errors/ValidationError.ts`
```typescript
export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly responseBody: Record<string, unknown>;

  constructor(responseBody: Record<string, unknown>) {
    super(String(responseBody.error || responseBody.message || 'Error de validación'));
    this.name = 'ValidationError';
    this.responseBody = responseBody;
  }
}
```
**Justificación:** Permite que cada validación defina su propia estructura de respuesta JSON. Esto soporta contratos diferentes entre tests:
- HU-03: `{ error: "La prioridad..." }`
- HU-02: `{ error, message, validValues: [...] }`
- HU-04: `{ error, message }`

---

## 14. Archivos Modificados

### 14.1 `src/types/Ticket.ts`

| Cambio | Descripción |
|--------|-------------|
| `VALID_INCIDENT_TYPES` | Nueva constante runtime con los 6 tipos de incidente válidos |
| `VALID_STATUSES` | Nueva constante runtime con los 2 estados válidos |
| `TicketFilters.sortBy` | Nuevo campo opcional `string` |
| `TicketFilters.sortOrder` | Nuevo campo opcional `string` |

### 14.2 `src/types/index.ts`

| Cambio | Descripción |
|--------|-------------|
| Re-exports | Se agregaron `VALID_INCIDENT_TYPES` y `VALID_STATUSES` |

### 14.3 `src/services/TicketQueryService.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| `getTickets()` | Llama directo a `repository.findAll()` | Valida filtros ANTES de llamar al repositorio |
| `findByLineNumber()` | `throw new Error(...)` → 500 | `throw new ValidationError(...)` → 400 |
| Métodos privados | No existían | 6 métodos de validación: `validatePriority`, `validateStatus`, `validateIncidentType`, `validateDates`, `validatePagination`, `validateSort` |
| Imports | Sin ValidationError, constantes | Con ValidationError, VALID_PRIORITIES, VALID_STATUSES, VALID_INCIDENT_TYPES, ALLOWED_SORT_FIELDS |

### 14.4 `src/controllers/ticketsController.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| Query params | Sin sortBy/sortOrder | Extrae `sortBy` y `sortOrder` de req.query |
| Filters | Sin sort fields | Incluye `sortBy` y `sortOrder` en TicketFilters |

### 14.5 `src/middlewares/errorHandler.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| Cadena | 3 eslabones | 4 eslabones (+ ValidationError al inicio) |
| Import | Sin ValidationError | Con ValidationError |
| ValidationError | No manejado | `res.status(400).json(err.responseBody)` |

### 14.6 `src/index.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| 405 handler | No existía | `app.use('/api', ...)` → 405 si método ≠ GET, con header `Allow: GET` |
| 404 handler | No existía | `app.use(...)` catch-all → 404 JSON |
| Orden | Router → errorHandler | Router → 405 → 404 → errorHandler |

---

## 15. Formato de respuesta por código HTTP

### 200 OK
```json
// GET /api/tickets
{
  "data": [...],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 50, "totalPages": 3 }
}

// GET /api/tickets/:ticketId
{ "ticketId": "...", "lineNumber": "...", ... }

// GET /api/tickets/metrics
{ "totalTickets": 25, "byStatus": {...}, "byPriority": {...}, "byType": {...} }
```

### 400 Bad Request (ejemplos)
```json
// Prioridad inválida
{ "error": "La prioridad \"CRITICAL\" no es una prioridad válida. Prioridad válida: HIGH, MEDIUM, LOW, PENDING" }

// Estado inválido (con validValues para soporte de UI)
{ "error": "\"CLOSED\" no es un estado válido", "message": "\"CLOSED\" no es un estado válido", "validValues": ["RECEIVED", "IN_PROGRESS"] }

// Tipo de incidente inválido
{ "error": "El tipo de incidente \"HARDWARE_FAILURE\" no es válido", "message": "El tipo de incidente \"HARDWARE_FAILURE\" no es válido" }

// Formato de fecha inválido
{ "error": "Formato de fecha inválido para dateFrom. Use formato ISO-8601." }

// Rango de fechas invertido
{ "error": "dateTo debe ser mayor o igual a dateFrom" }

// Campo de ordenamiento inválido
{ "error": "Campo de ordenamiento inválido: notAField. Campos válidos: createdAt, priority, status." }

// UUID inválido
{ "error": "Formato de ID inválido" }

// Número de línea inválido
{ "error": "Número de línea inválido: debe tener exactamente 10 dígitos, se recibió \"abc\"" }
```

### 404 Not Found
```json
// Ticket no encontrado
{ "error": "Ticket no encontrado" }

// Ruta inexistente
{ "error": "Ruta no encontrada" }
```

### 405 Method Not Allowed
```json
// POST /api/tickets
// Headers: Allow: GET
{ "error": "Método POST no permitido. Este servicio de consulta solo acepta GET." }
```

### 500 Internal Server Error
```json
{ "error": "Internal server error" }
```

---

## 16. Verificación post-refactorización (status codes)

- [x] Compila en TypeScript estricto sin errores
- [x] `GET /api/tickets` → 400 para: priority, status, type, dateFrom, dateTo, sortBy, sortOrder, page, limit inválidos
- [x] `GET /api/tickets/line/:lineNumber` → 400 para lineNumber no-10-dígitos (antes era 500)
- [x] `GET /api/tickets/:ticketId` → 400 UUID inválido, 404 no encontrado
- [x] `POST/PUT/DELETE /api/*` → 405 con header `Allow: GET`
- [x] Rutas desconocidas → 404 JSON
- [x] Errores de infraestructura → 500
- [x] `ValidationError` soporta cuerpo de respuesta personalizable por contrato de test
- [x] Cadena de errores en errorHandler: ValidationError → InvalidUuidFormatError → TicketNotFoundError → legacy status → 500
