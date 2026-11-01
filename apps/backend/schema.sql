-- Openfund wallet-identity schema (PostgreSQL 17)
-- Tables are ALSO tracked in Directus (Data Studio) for backstage admin,
-- but are written by the Openfund backend only. Directus public role has
-- NO permission on these tables.

CREATE TABLE IF NOT EXISTS openfund_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,          -- normalized (lowercase)
  wallet_chain   integer NOT NULL DEFAULT 421614,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  display_name   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON openfund_users (wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_status ON openfund_users (status);
CREATE INDEX IF NOT EXISTS idx_users_created ON openfund_users (created_at DESC);

CREATE TABLE IF NOT EXISTS challenge_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS openfund_challenges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES openfund_users (id) ON DELETE CASCADE,
  challenge_plan_id uuid NOT NULL REFERENCES challenge_plans (id),
  status            text NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'started', 'passed', 'failed', 'expired', 'cancelled')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  started_at        timestamptz,
  completed_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_challenges_user ON openfund_challenges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_plan ON openfund_challenges (challenge_plan_id);

-- single-use, short-lived SIWE nonces
CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce      text PRIMARY KEY,
  address    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_nonces_expires ON auth_nonces (expires_at);

-- server-side sessions (cookie holds only the opaque id; hash stored)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id_hash    text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES openfund_users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen  timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip         text
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  ts         timestamptz NOT NULL DEFAULT now(),
  action     text NOT NULL,
  user_id    uuid,
  ip         text,
  details    jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id);

-- ============================================================
-- Demo trading platform (100,000 virtual DAI)
-- All money columns are NUMERIC — authoritative math uses
-- decimal.js server-side. Frontend never writes these tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS demo_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES openfund_users (id) ON DELETE CASCADE,
  account_type  text NOT NULL DEFAULT 'free_demo',
  currency      text NOT NULL DEFAULT 'DAI',
  balance       numeric(24,10) NOT NULL DEFAULT 0,
  used_margin   numeric(24,10) NOT NULL DEFAULT 0,
  realized_pnl  numeric(24,10) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_type)          -- ONE free demo account per user
);
CREATE INDEX IF NOT EXISTS idx_demo_accounts_user ON demo_accounts (user_id);

CREATE TABLE IF NOT EXISTS trading_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE,             -- duplicate submissions return the original result
  account_id     uuid NOT NULL REFERENCES demo_accounts (id),
  user_id        uuid NOT NULL REFERENCES openfund_users (id),
  market         text NOT NULL,
  side           text NOT NULL CHECK (side IN ('long','short')),
  order_type     text NOT NULL CHECK (order_type IN ('market','limit','stop')),
  margin         numeric(24,10) NOT NULL,
  leverage       integer NOT NULL,
  target_price   numeric(24,10),
  sl_price       numeric(24,10),
  tp_price       numeric(24,10),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','filled','cancelled','rejected')),
  reject_reason  text,
  filled_price   numeric(24,10),
  position_id    uuid,
  request_meta   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_account ON trading_orders (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_pending ON trading_orders (status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS trading_positions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES trading_orders (id),
  account_id    uuid NOT NULL REFERENCES demo_accounts (id),
  user_id       uuid NOT NULL REFERENCES openfund_users (id),
  market        text NOT NULL,
  side          text NOT NULL CHECK (side IN ('long','short')),
  quantity      numeric(24,10) NOT NULL,
  entry_price   numeric(24,10) NOT NULL,
  margin        numeric(24,10) NOT NULL,
  leverage      integer NOT NULL,
  sl_price      numeric(24,10),
  tp_price      numeric(24,10),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','liquidated')),
  exit_price    numeric(24,10),
  exit_reason   text,                       -- manual | sl | tp | liquidation
  open_fee      numeric(24,10) NOT NULL DEFAULT 0,
  close_fee     numeric(24,10) NOT NULL DEFAULT 0,
  realized_pnl  numeric(24,10) NOT NULL DEFAULT 0,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_positions_account ON trading_positions (account_id, status);
CREATE INDEX IF NOT EXISTS idx_positions_user ON trading_positions (user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_open ON trading_positions (status) WHERE status = 'open';

-- append-only ledger: every balance-changing event, with balance_after
CREATE TABLE IF NOT EXISTS trading_ledger (
  id             bigserial PRIMARY KEY,
  account_id     uuid NOT NULL REFERENCES demo_accounts (id),
  user_id        uuid NOT NULL REFERENCES openfund_users (id),
  event          text NOT NULL,             -- demo_funding | open_fee | close | liquidation
  position_id    uuid,
  amount         numeric(24,10) NOT NULL,   -- signed
  balance_after  numeric(24,10) NOT NULL,
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON trading_ledger (account_id, id);

-- engine audit trail (triggers, liquidations, price evidence, errors)
CREATE TABLE IF NOT EXISTS trading_events (
  id         bigserial PRIMARY KEY,
  ts         timestamptz NOT NULL DEFAULT now(),
  account_id uuid,
  kind       text NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_trading_events_ts ON trading_events (ts DESC);

-- Portfolio trade notes (user-private, separate from authoritative trades)
CREATE TABLE IF NOT EXISTS trade_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES openfund_users (id) ON DELETE CASCADE,
  trade_key  text NOT NULL,              -- journal round-trip key (stable)
  notes      text NOT NULL DEFAULT '',
  tags       jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trade_key)
);
CREATE INDEX IF NOT EXISTS idx_trade_notes_user ON trade_notes (user_id);
