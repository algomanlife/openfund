# Local setup (no Docker)

The Docker path (`infrastructure/directus/compose.yaml`) works anywhere Docker
exists. On machines without Docker this is the verified local path (macOS,
Homebrew, 2026-11-01).

## Prerequisites (verified versions)

- Node **22** (`brew install node@22`) — Directus 11 cannot run on Node 26 (isolated-vm)
- PostgreSQL 17 (`brew install postgresql@17`)
- Python 3 (schem/seed scripts)
- Install the Directus runtime once (space-free path, postinstall builds isolated-vm):
  ```bash
  mkdir -p ~/openfund-backstage && cd ~/openfund-backstage
  PATH=/opt/homebrew/opt/node@22/bin:$PATH npm i directus@11.9.1
  ```
  (Installing inside the repo dir fails: the path contains a space + esbuild's
  postinstall chokes.)

## 1 — database

```bash
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/psql -U $(whoami) -d postgres \
  -c "CREATE USER openfund_cms WITH PASSWORD 'openfund_local_dev';" \
  -c "CREATE DATABASE openfund_cms OWNER openfund_cms;"
```

## 2 — environment

`infrastructure/directus/.env` (gitignored; see `.env.example` for keys).
Local dev requires `CORS_ENABLED=true` + `CORS_ORIGIN=true` (the React dev
server on :5173 and the static server on :4173 read cross-origin).

## 3 — run Directus

```bash
cd infrastructure/directus
PATH=/opt/homebrew/opt/node@22/bin:$PATH \
  ~/openfund-backstage/node_modules/.bin/directus bootstrap   # first run only
PATH=/opt/homebrew/opt/node@22/bin:$PATH \
  ~/openfund-backstage/node_modules/.bin/directus start       # http://localhost:8055
```

Admin: `admin@openfund.dev` / `openfund-admin-2026` (local dev only — change it).

## 4 — schema + seed

```bash
python3 apps/backstage/scripts/apply_schema.py   # idempotent
python3 apps/backstage/scripts/seed_content.py   # idempotent, never overwrites edits
```

## 5 — React

```bash
cd apps/web-react && npm run dev    # http://localhost:5173/react/#/
```

Optional `apps/web-react/.env`: `VITE_DIRECTUS_URL=http://localhost:8055`.

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| `isolated-vm` load error | run with Node 22, install in a space-free dir |
| `Cannot find module './out/isolated_vm'` | npx cache skipped postinstall — do a real `npm i` in `~/openfund-backstage` |
| CORS error in browser console | `CORS_ENABLED=true` + restart |
| empty translations in the app | check `ui_messages.status = published`; re-run `apply_schema.py` (public read permissions) |
| Directus crashes on relation PATCH (11.9 bug) | the scripts set `one_field` via psql instead; restart the server |

## Backup / restore

```bash
/opt/homebrew/opt/postgresql@17/bin/pg_dump -U openfund_cms openfund_cms > backup.sql
/opt/homebrew/opt/postgresql@17/bin/psql  -U openfund_cms openfund_cms < backup.sql
```
