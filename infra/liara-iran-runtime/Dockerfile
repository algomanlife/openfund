# Openfund Iran regional runtime (Liara Docker platform) - ADR 0033.
#
# The SAME backend and frontend as Render, built from one reviewed commit.
# Region behaviour comes only from runtime environment variables
# (OPENFUND_REGION=IRAN, OPENFUND_ROLES, REGION_SYNC_*), never from a fork.
# One image serves both Liara apps:
#   openfund-iran          OPENFUND_ROLES=http          (website, terminal, API, peer sync endpoint)
#   openfund-iran-worker   OPENFUND_ROLES=engine,market-data,sync   (no public routes; /health only)
#
# Build context: the repository root.
#   docker build -f infra/liara-iran-runtime/Dockerfile --build-arg SOURCE_COMMIT=<40-hex> .
# Runtime boot needs no package registry, GitHub or Render: everything is in the image.
FROM node:26-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/web-react/package.json apps/web-react/package-lock.json apps/web-react/
COPY apps/backend/package.json apps/backend/package-lock.json apps/backend/
RUN npm ci --prefix apps/web-react --include=dev --no-audit --no-fund \
 && npm ci --prefix apps/backend --omit=dev --no-audit --no-fund
COPY . .
# Public build-time values are deliberately absent: runtime-config.js supplies them.
RUN npm run build:web

FROM node:26-alpine
ARG SOURCE_COMMIT=unreleased
WORKDIR /app
RUN apk add --no-cache tini \
 && addgroup -S openfund && adduser -S -G openfund openfund
COPY --from=build --chown=openfund:openfund /src/apps/backend /app/apps/backend
COPY --from=build --chown=openfund:openfund /src/react /app/react
COPY --from=build --chown=openfund:openfund /src/packages /app/packages
COPY --chown=openfund:openfund infra/liara-iran-runtime/start.sh /app/start.sh
USER openfund
# release identity reported by /version and the regional handshake
ENV NODE_ENV=production \
    RENDER_GIT_COMMIT=${SOURCE_COMMIT} \
    PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/bin/sh", "/app/start.sh"]
