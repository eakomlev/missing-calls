# --- build stage ---
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage ---
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# SQLite state lives here; mount a volume at this path to persist across restarts.
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
