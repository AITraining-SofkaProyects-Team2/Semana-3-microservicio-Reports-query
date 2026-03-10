FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar deps (cache de imagen)
COPY package.json ./
RUN npm install

# Copiar código fuente
COPY tsconfig.json vitest.config.ts ./
COPY src ./src
COPY tests ./tests

# Run all unit tests (both src/__tests__ and tests/)
RUN npm test -- src/__tests__ tests

EXPOSE 4000

LABEL org.opencontainers.image.source=https://github.com/AITraining-SofkaProyects-Team2/Semana-3-microservicio-Reports-query

CMD ["npm", "run", "dev"]
