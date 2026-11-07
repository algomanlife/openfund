# ADR 0010: Runtime public browser configuration

Status: proposed for v0.4.1; source implemented, production acceptance pending.

## Context

The v0.4.0 frontend could embed `VITE_DIRECTUS_URL` during a Render rebuild.
The published frontend hash then depended on the build environment, and an
unconfigured production build could request `localhost:8055`. A verified
artifact must remain identical across official packaging and Render.

## Decision

The immutable HTML loads `/react/runtime-config.js` before the React module.
The existing backend serves a no-store script containing only public values:
CMS origin, optional wallet connector project ID, optional community URLs and
optional DePay display settings. It validates the CMS origin at startup and
requires HTTPS in production. The script is outside the frontend artifact and
can change when the service's public environment changes. No credential,
database URL, private token or payment receiver enters the script.

Official packaging and Render rebuild remove `VITE_*` build inputs, so the
frontend content hash depends on source and lockfiles instead of deployment
settings. Render still verifies the published manifest and compares frontend,
backend and schema IDs before startup. The runtime script is audited
separately from the immutable archive. The three-service Render architecture
and first-party API/session origin remain unchanged.

## Consequences and acceptance

Changing the CMS domain requires a runtime environment update and service
redeploy, without a new frontend package. A missing or invalid production CMS
origin prevents startup; an unavailable CMS still produces an explicit content
error state. The custom domain must be set as `CMS_PUBLIC_URL` on the existing
API service. Verify the served script, CMS public queries and browser network
requests after deployment. The v0.4.1 release is blocked until the complete
candidate and deployed gates pass.
