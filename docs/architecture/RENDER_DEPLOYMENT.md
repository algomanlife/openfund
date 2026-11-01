# Optional Render deployment

The audited base had no application Render blueprint or application CI configuration. `render.yaml` now describes the existing Node 22 backend + Vite frontend as one web service, without creating a new PostgreSQL or CMS service. No deployment is performed by this change.

- Set DATABASE_URL to the existing PostgreSQL database, and VITE_DIRECTUS_URL to the existing HTTPS Directus origin before building.
- Set ALLOWED_DOMAINS to the exact application host(s), without scheme; set CORS_ORIGINS to exact HTTPS origins. Cookies are HttpOnly/SameSite=Lax and Secure in production. Static `/react/` and the auth/trading/product APIs share an origin.
- Configure the existing Directus CORS/publication/media policies for that frontend origin. Keep admin credentials server-side. Seed product editorial content on that same instance using the documented script.
- Build: `npm ci --prefix apps/backend && npm ci --include=dev --prefix apps/web-react && npm run build --prefix apps/web-react`.
- Start: `npm run migrate --prefix apps/backend && npm start --prefix apps/backend`. Migration is additive/idempotent; take the existing PostgreSQL backup before approved production rollout. No destructive rollback is necessary for the added notebook table.
- `/health` checks PostgreSQL connectivity. The existing trading engine still runs in this service; `numInstances: 1` preserves the single-monitoring-loop deployment model. Horizontal engine coordination is outside this PR.
- Root `/` redirects to `/react/`; locale/product routes remain hash routes. Production frontend API URLs default to the same origin; local Vite defaults to localhost:8080 unless VITE_BACKEND_URL is supplied.
- WalletConnect project ID is optional for local injected wallets. On-chain Gains execution stays disabled; never set SIM_TEST_MODE in production.
- Automatic deployment is disabled in the blueprint. Apply/review only after authorization. API credentials, hostnames and operational deployment access have not been inferred or provisioned.

[Render Blueprint reference](https://render.com/docs/blueprint-spec) was checked; the file is validated against Render's published JSON schema. Local build/hosting checks do not establish a live Render deployment.
