FROM node:22-alpine AS frontend-build

WORKDIR /build

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --package-lock=false; fi

COPY app ./app
COPY tsconfig.json ./tsconfig.json
COPY vite.config.ts ./vite.config.ts

RUN npm run typecheck \
    && npm run build \
    && test -f /build/dist/server/index.js \
    && test -d /build/dist/client

FROM node:22-alpine

LABEL org.opencontainers.image.title="AI Process Studio Community" \
      org.opencontainers.image.version="1.1.0" \
      org.opencontainers.image.description="Local-first Community process intelligence workspace" \
      org.opencontainers.image.licenses="MPL-2.0"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev --package-lock=false; fi

COPY --from=frontend-build --chown=node:node /build/dist ./dist
COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node seed ./seed
COPY --chown=node:node schemas ./schemas
COPY --chown=node:node prompts ./prompts
COPY --chown=node:node LICENSE ./LICENSE

RUN mkdir -p /app/data /app/license /app/backups \
    && chown -R node:node /app

USER node

ENV NODE_ENV=production \
    PORT=3080 \
    APS_HOST=0.0.0.0 \
    APS_DATA_DIR=/app/data \
    APS_LICENSE_DIR=/app/license \
    APS_BACKUP_DIR=/app/backups \
    APS_SEED_FILE=/app/seed/state.json

EXPOSE 3080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3080/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
