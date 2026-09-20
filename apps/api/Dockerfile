# ---------------------------------------------------------------------------
# VertexGuard API — Node 24, runs the Guardian pipeline via tsx.
# Tagged with DEBUG=true so lower-cased DATABASE_URL emulation still works
# (PGlite embedded engine is used when DATABASE_URL is empty).
# ---------------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace @vertexguard/api --include=dev

FROM base
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
# Persist policy + embedded DB (if ever used) outside the image.
VOLUME /app/data
EXPOSE 4100
CMD ["npm", "run", "start", "--workspace", "@vertexguard/api"]