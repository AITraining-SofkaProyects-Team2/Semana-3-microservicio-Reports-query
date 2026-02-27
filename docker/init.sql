-- Inicialización de la base de datos para el proyecto Reports Query
-- Crea extensión necesaria y la tabla 'tickets' con esquema mínimo

-- Crear extensión pgcrypto para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Crear tabla tickets si no existe
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_tickets_line_number ON tickets(line_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
