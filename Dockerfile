# Chain Escape server — production image (Node 20)
# Build:  docker build -t chain-escape-server .
# Run:    docker run --rm -p 3000:3000 -e NODE_ENV=production chain-escape-server
# Health: curl http://localhost:3000/api/health
#
# The server is TypeScript, so it runs via tsx (a production dependency).
# `npm install` (not `npm ci`) is used deliberately: package-lock.json may
# lag behind package.json after the tsx move, and `npm install` re-syncs it.

# ---- Build stage: compile the Vite web client into dist/ ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- Runtime stage: server + shared sim code + built client only ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --omit=dev --no-audit --no-fund
COPY server.ts ./
COPY src/shared ./src/shared
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
