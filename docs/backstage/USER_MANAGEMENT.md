# User management (Directus backstage)

The Data Studio (`http://localhost:8055` in local dev) is the administrative
interface for platform users and their challenges. The tables are **written by
the Openfund backend only**; administrators read and control, they do not
authenticate anyone — Directus is not the auth boundary.

## Collections

| Collection | Sidebar name | Contents |
| :--- | :--- | :--- |
| `openfund_users` | Platform users | wallet address, status, display name, registration, last login |
| `openfund_challenges` | Challenges | per-user challenge records with plan, status and lifecycle dates |
| `challenge_plans` | Plan catalog | editorial metadata + permitted configuration |
| `audit_log` | Audit trail | logins, failed auths, suspensions, logouts (read-only view) |
| `auth_sessions` / `auth_nonces` | hidden | operational tables, not for browsing |

## What admins can do

- **Search** by wallet address, **filter** by status, **sort** by registration date
- Open a user → see every associated challenge (m2o relations are wired)
- Challenge count, plan, status, creation/start/completion dates
- **Suspend / reactivate** a user by switching `status` — enforcement is real:
  the backend blocks login and invalidates live sessions for `suspended`
- Administrative **notes** can be kept via `display_name` (a dedicated notes
  field is on the roadmap)

## What admins must NOT do

- Edit `wallet_address` or `user_id` (read-only in the UI) — identity and
  ownership are set by verified signatures only
- Edit financial/trading result fields — evaluation data does not exist yet
  and is never fabricated
- Expect Directus permissions to protect users — **the backend enforces
  authorization**; Directus permissions only shape the admin UI

## Permissions

- Public policy: **no permission** on any identity table (verified by
  unauthenticated probe → `FORBIDDEN`)
- Administrator role: full access via app access
- Planned: dedicated `Support` / `Risk` roles with least-privilege reads (see
  [PERMISSIONS.md](PERMISSIONS.md))

## Setup

`python3 apps/backstage/scripts/register_user_tables.py` — idempotent; tracks
the backend-created tables, sets icons/notes/readonly fields, wires the m2o
relations.
