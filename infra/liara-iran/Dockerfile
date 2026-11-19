# Openfund Iran edge (Liara Docker platform) - see ADR 0031.
#
# A same-origin reverse proxy only: no Openfund source, database, engine loop,
# payment handler or secret enters this image. The build context is this
# directory alone.
#
# Runtime contract (Liara app environment variables, all non-secret):
#   OPENFUND_UPSTREAM_HOST   Render origin host, e.g. <service>.onrender.com (required)
#   EDGE_PORT                listening port (default 8080; must equal the Liara app port)
#
# Base image (OF-2026-11-20): nginx mainline 1.31.7 on Alpine 3.24, "slim"
# variant (no njs, perl, image-filter, xslt, curl or libxml2: the edge uses
# none of them). Pinned by the multi-arch OCI index digest; Dependabot's
# docker ecosystem and the Trivy image gate in deploy-liara-iran.yml keep it
# current. The 1.28 line is no longer updated and 1.30.6 still ships a
# vulnerable nginx package (docs/security/SECURITY-REMEDIATION-2026-11.md).
FROM nginxinc/nginx-unprivileged:1.31.7-alpine-slim@sha256:a8cb0f33d51fa107c96fd2bd3a71aaf564ec131e9d2bdf8700944f0ed8b170d7

USER root
# Plain COPY + chmod (no --chmod) so the classic builder works as well as BuildKit.
COPY 05-openfund-edge.envsh /docker-entrypoint.d/05-openfund-edge.envsh
COPY templates/ /etc/nginx/templates/
# Written by the deploy workflow with the exact edge commit; the committed copy
# says "unreleased" so a local build never claims a release identity.
COPY edge-release.json /usr/share/openfund-edge/edge-release.json
# apk upgrade applies Alpine security fixes published after the base image
# was built (musl, zlib at the time of writing); the image scan fails the
# build when a fixable Critical or High finding remains.
RUN apk upgrade --no-cache \
 && apk add --no-cache ca-certificates \
 && chmod 0755 /docker-entrypoint.d/05-openfund-edge.envsh \
 && chmod 0644 /usr/share/openfund-edge/edge-release.json \
 && mkdir -p /tmp/openfund-edge-cache \
 && chown -R 101:0 /tmp/openfund-edge-cache
USER 101

ENV EDGE_PORT=8080 \
    OPENFUND_UPSTREAM_SCHEME=https \
    EDGE_PUBLIC_SCHEME=https \
    EDGE_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    NGINX_ENVSUBST_FILTER="^(OPENFUND_|EDGE_|NGINX_LOCAL_RESOLVERS$)"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${EDGE_PORT}/__edge/live" || exit 1
