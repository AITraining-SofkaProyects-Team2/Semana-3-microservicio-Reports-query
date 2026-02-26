FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install

COPY tsconfig.json vitest.config.ts ./
COPY src ./src
COPY tests ./tests

# Build the application (optional for dev, but good practice)
RUN npx tsc

# Run all unit tests (both src/__tests__ and tests/)
RUN npm test -- src/__tests__ tests

EXPOSE 4000

# Start the server
CMD ["npm", "run", "dev"]
