import express from 'express';
import { MetricsService, IncidentRepository } from './services/metricsService';
import { TicketRepository } from './repositories/TicketRepository';
import ticketRoutes from './routes/tickets.routes';
import { errorHandler } from './middlewares/errorHandler';

/**
 * Crea la aplicación Express con las rutas configuradas
 * @param incidentRepository - Repositorio de incidentes a usar
 * @returns Instancia de Express configurada
 */
export function createApp(incidentRepository?: IncidentRepository) {
  const app = express();
  app.use(express.json());

  // Si no se proporciona repositorio, crear uno apropiado según el entorno.
  // En tests usamos un stub in-memory; en ejecución normal usamos `TicketRepository` (Postgres).
  let repo: IncidentRepository;
  if (incidentRepository) {
    repo = incidentRepository;
  } else if (process.env.NODE_ENV === 'test') {
    repo = {
      async findAll() {
        return [];
      },
      async findById(_id: string) {
        return null;
      },
      async create(_ticket) {
        throw new Error('Not implemented');
      },
      async update(_id: string, _ticket) {
        throw new Error('Not implemented');
      },
    };
  } else {
    // En entorno real, usar la implementación que conecta a Postgres
    repo = new TicketRepository();
  }




// Test-only endpoints (no-op stubs for env compatibility)
if (process.env.NODE_ENV === 'test') {
  app.post('/__test__/seed', (_req, res) => res.status(204).end());
  app.post('/__test__/clear', (_req, res) => res.status(204).end());
}

  // Instanciar servicio de métricas con el repositorio
  const metricsService = new MetricsService(repo);

  // ────────────────────────────────────────────────────────────────────────────
  // Rutas con path fijo ANTES del router de tickets
  // (para evitar que /:ticketId capture "/metrics" o "/health")
  // ────────────────────────────────────────────────────────────────────────────

  // GET /health — Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // GET /api/tickets/metrics — Métricas agregadas
  app.get('/api/tickets/metrics', async (_req, res, next) => {
    try {
      const metrics = await metricsService.getMetrics();
      res.status(200).json(metrics);
    } catch (error) {
      next(error);
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Router de tickets (GET /, GET /line/:lineNumber, GET /:ticketId)
  // ────────────────────────────────────────────────────────────────────────────
  app.use('/api/tickets', ticketRoutes);

  // ────────────────────────────────────────────────────────────────────────────
  // 405 Method Not Allowed para métodos no-GET en rutas /api/*
  // (todos los GET válidos ya fueron resueltos arriba;
  //  cualquier request que llegue aquí con otro verbo es inválido)
  // ────────────────────────────────────────────────────────────────────────────
  app.use('/api', (req, res, next) => {
    const isPatchStatus = req.method === 'PATCH' && /^\/tickets\/[^/]+\/status$/.test(req.path);
    if (req.method !== 'GET' && !isPatchStatus) {
      res.status(405)
        .set('Allow', 'GET, PATCH')
        .json({ error: `Método ${req.method} no permitido. Este servicio de consulta solo acepta GET.` });
      return;
    }
    next();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 404 Not Found para rutas desconocidas
  // ────────────────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Middleware centralizado de errores (Chain of Responsibility)
  // DEBE ir al final, después de todas las rutas.
  // ────────────────────────────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}

// Crear app por defecto para ejecución standalone
const app = createApp();

export default app;


if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Reports Query service listening on port ${PORT}`);
  });
}