# Openfund application image (GHCR), built only from a verified official
# release payload prepared by scripts/release/image-payload.mjs. The build
# context is that extracted archive plus this file; no repository source,
# environment file or secret enters the image.
#
# Runtime contract (same as the Render `openfund` service):
#   DATABASE_URL       PostgreSQL 17 connection (required)
#   CMS_PUBLIC_URL     HTTPS Directus origin (required when NODE_ENV=production)
#   ALLOWED_DOMAINS    SIWE hostnames, comma-separated
#   PORT               listening port (default 8080)
# Migrations are additive and run before the server starts.
FROM node:22-bookworm-slim

ARG OPENFUND_VERSION
ARG OPENFUND_COMMIT
ARG OPENFUND_ARCHIVE_SHA256
ARG OPENFUND_CREATED
LABEL org.opencontainers.image.title="Openfund" \
      org.opencontainers.image.description="Openfund web application and API (official release payload)" \
      org.opencontainers.image.source="https://github.com/algomanlife/openfund" \
      org.opencontainers.image.url="https://github.com/algomanlife/openfund/releases/tag/v${OPENFUND_VERSION}" \
      org.opencontainers.image.version="${OPENFUND_VERSION}" \
      org.opencontainers.image.revision="${OPENFUND_COMMIT}" \
      org.opencontainers.image.created="${OPENFUND_CREATED}" \
      io.openfund.release.archive-sha256="${OPENFUND_ARCHIVE_SHA256}"

ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --chown=node:node payload/ /app/
RUN npm ci --omit=dev --prefix apps/backend --no-audit --no-fund \
 && npm cache clean --force \
 && chown -R node:node /app/apps/backend/node_modules
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npm --prefix apps/backend run migrate && exec node apps/backend/server.js"]
