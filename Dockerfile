FROM node:20-alpine

WORKDIR /app

# Copiar entrypoint que instala deps si faltan
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Copiar package.json e instalar deps (cache de imagen)
COPY package.json ./
RUN npm install

# Copiar código fuente
COPY tsconfig.json vitest.config.ts ./
COPY src ./src

# Run all unit tests (both src/__tests__ and tests/)
RUN npm test -- src/__tests__ tests

EXPOSE 4000

ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "run", "dev"]
