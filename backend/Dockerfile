FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/db/schema.sql ./dist/db/schema.sql
# node:20-alpine ships a non-root "node" user (uid 1000) — run as it
# instead of root, in case the container is ever compromised.
RUN chown -R node:node /app
USER node
EXPOSE 4000
# Render's free tier doesn't support preDeployCommand, so the migration
# runs here instead, right before the server starts on every boot.
# schema.sql is idempotent (CREATE TABLE IF NOT EXISTS / EXCEPTION WHEN
# duplicate_object), so re-running it on every restart is a no-op once
# the schema is already applied.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]