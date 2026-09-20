# ---------------------------------------------------------------------------
# VertexGuard Web — static React build served by Nginx.
# /api and /ws are reverse-proxied to the api service.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm run build --workspace @vertexguard/web

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80