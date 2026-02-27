#!/bin/sh
set -e

# Instalar dependencias si node_modules está vacío o desactualizado
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo "📦 Instalando dependencias..."
  npm install
fi

exec "$@"
