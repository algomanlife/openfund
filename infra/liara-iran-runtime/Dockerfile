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
#   docker build -f infra/liara-iran-runtime/Dockerfile \
#     --build-arg SOURCE_COMMIT=<40-hex> --build-arg RELEASE_VERSION=<x.y.z> .
# The image carries the same release manifests Render's build writes
# (scripts/release/manifest.mjs), so /version of both regions can be compared:
# same commit + same frontend/backend ids = the same release.
# Runtime boot needs no package registry, GitHub or Render: everything is in the image.
FROM node:26-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/web-react/package.json apps/web-react/package-lock.json apps/web-react/
COPY apps/backend/package.json apps/backend/package-lock.json apps/backend/
RUN npm ci --prefix apps/web-react --include=dev --no-audit --no-fund \
 && npm ci --prefix apps/backend --omit=dev --no-audit --no-fund
COPY . .
ARG SOURCE_COMMIT
ARG RELEASE_VERSION=0.1.0
# The build has no .git: the commit is an explicit, validated argument.
# Public build-time values are deliberately absent: runtime-config.js supplies them.
RUN echo "$SOURCE_COMMIT" | grep -Eq '^[0-9a-f]{40}$' || { echo "SOURCE_COMMIT must be a 40-character commit" >&2; exit 1; } \
 && RELEASE_SOURCE_COMMIT="$SOURCE_COMMIT" RELEASE_VERSION="$RELEASE_VERSION" npm run build:web \
 && node --input-type=module -e "const { manifest } = await import('./scripts/release/manifest.mjs'); manifest({ version: process.env.RELEASE_VERSION, commit: process.env.SOURCE_COMMIT })"

FROM node:26-alpine
ARG SOURCE_COMMIT
WORKDIR /app
RUN apk add --no-cache tini \
 && addgroup -S openfund && adduser -S -G openfund openfund
COPY --from=build --chown=openfund:openfund /src/apps/backend /app/apps/backend
COPY --from=build --chown=openfund:openfund /src/react /app/react
COPY --from=build --chown=openfund:openfund /src/release-manifest.json /app/release-manifest.json
COPY --from=build --chown=openfund:openfund /src/packages /app/packages
# bundled third-party journal analytics imported by the backend (licence and provenance kept)
COPY --from=build --chown=openfund:openfund /src/third_party /app/third_party
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
