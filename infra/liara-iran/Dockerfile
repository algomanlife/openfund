# Openfund Iran edge (Liara Docker platform) - see ADR 0031.
#
# A same-origin reverse proxy only: no Openfund source, database, engine loop,
# payment handler or secret enters this image. The build context is this
# directory alone.
#
# Runtime contract (Liara app environment variables, all non-secret):
#   OPENFUND_UPSTREAM_HOST   Render origin host, e.g. <service>.onrender.com (required)
#   EDGE_PORT                listening port (default 8080; must equal the Liara app port)
FROM nginxinc/nginx-unprivileged:1.28.0-alpine

USER root
# Plain COPY + chmod (no --chmod) so the classic builder works as well as BuildKit.
COPY 05-openfund-edge.envsh /docker-entrypoint.d/05-openfund-edge.envsh
COPY templates/ /etc/nginx/templates/
# Written by the deploy workflow with the exact edge commit; the committed copy
# says "unreleased" so a local build never claims a release identity.
COPY edge-release.json /usr/share/openfund-edge/edge-release.json
RUN apk add --no-cache ca-certificates \
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
