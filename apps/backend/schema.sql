-- Openfund wallet-identity schema (PostgreSQL 17)
-- Tables are ALSO tracked in Directus (Data Studio) for backstage admin,
-- but are written by the Openfund backend only. Directus public role has
-- NO permission on these tables.

CREATE TABLE IF NOT EXISTS openfund_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,          -- normalized (lowercase)
  wallet_chain   integer NOT NULL DEFAULT 11155111,
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


-- Private notebook entries, distinct from authoritative trades and existing trade_notes.
-- Account references are resolved/authorized by the backend; perpetual references are SIWE wallets.
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES openfund_users(id),
  product text NOT NULL CHECK (product IN ('prop','perpetual')),
  account_ref text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 10000),
  entry_date date NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  classification text NOT NULL DEFAULT '',
  trade_id uuid REFERENCES trading_positions(id),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (product = 'prop' OR trade_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_journal_scope ON journal_entries(user_id, product, account_ref, entry_date DESC);

-- Additive audit repair: closed slices retain original trade provenance.
ALTER TABLE trading_positions ADD COLUMN IF NOT EXISTS parent_position_id uuid;
CREATE TABLE IF NOT EXISTS position_close_requests (
  account_id uuid NOT NULL REFERENCES demo_accounts(id),
  request_key text NOT NULL,
  position_id uuid NOT NULL REFERENCES trading_positions(id),
  fraction numeric NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, request_key)
);

ALTER TABLE openfund_users ALTER COLUMN wallet_chain SET DEFAULT 11155111;

-- First fresh observation starts risk history; historical marks are never invented.
CREATE TABLE IF NOT EXISTS account_equity_risk (
  account_id uuid PRIMARY KEY REFERENCES demo_accounts(id) ON DELETE CASCADE,
  day date NOT NULL,
  day_start_equity numeric(24,10) NOT NULL,
  peak_equity numeric(24,10) NOT NULL,
  last_equity numeric(24,10) NOT NULL,
  maximum_drawdown numeric(24,10) NOT NULL DEFAULT 0,
  daily_drawdown numeric(24,10) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Free Trial lifecycle: existing DAI rows retain their denomination and ledger.
ALTER TABLE demo_accounts ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE demo_accounts ADD COLUMN IF NOT EXISTS disable_reason text;
ALTER TABLE demo_accounts DROP CONSTRAINT IF EXISTS demo_accounts_status_check;
ALTER TABLE demo_accounts ADD CONSTRAINT demo_accounts_status_check
  CHECK (status IN ('active','suspended','closed','liquidating','permanently_disabled'));
CREATE OR REPLACE FUNCTION protect_terminated_trial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.account_type='free_demo' AND OLD.status='permanently_disabled' THEN
    RAISE EXCEPTION 'permanently_disabled_trial_is_immutable' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS protect_terminated_trial ON demo_accounts;
CREATE TRIGGER protect_terminated_trial BEFORE UPDATE OR DELETE ON demo_accounts
FOR EACH ROW EXECUTE FUNCTION protect_terminated_trial();

CREATE TABLE IF NOT EXISTS journal_preferences (
  user_id uuid NOT NULL REFERENCES openfund_users(id),
  product text NOT NULL CHECK (product IN ('prop','perpetual')),
  account_ref text NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,product,account_ref)
);

CREATE TABLE IF NOT EXISTS account_equity_samples (
  account_id uuid NOT NULL REFERENCES demo_accounts(id) ON DELETE CASCADE,
  sampled_at timestamptz NOT NULL,
  equity numeric(24,10) NOT NULL,
  balance numeric(24,10) NOT NULL,
  PRIMARY KEY(account_id,sampled_at)
);

-- Serialize private metadata writes with trial termination, including legacy APIs.
CREATE OR REPLACE FUNCTION guard_trial_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid; state text; ref text; prod text;
BEGIN
  owner_id := CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  IF TG_TABLE_NAME='trade_notes' THEN
    SELECT status INTO state FROM demo_accounts WHERE user_id=owner_id AND account_type='free_demo' FOR UPDATE;
  ELSE
    IF TG_OP='DELETE' THEN ref:=OLD.account_ref; prod:=OLD.product; ELSE ref:=NEW.account_ref; prod:=NEW.product; END IF;
    IF prod='prop' THEN SELECT status INTO state FROM demo_accounts WHERE id::text=ref AND user_id=owner_id FOR UPDATE; END IF;
  END IF;
  IF state='permanently_disabled' THEN RAISE EXCEPTION 'account_permanently_disabled' USING ERRCODE='23514'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS guard_trial_metadata ON journal_entries;
CREATE TRIGGER guard_trial_metadata BEFORE INSERT OR UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION guard_trial_metadata();
DROP TRIGGER IF EXISTS guard_trial_metadata ON journal_preferences;
CREATE TRIGGER guard_trial_metadata BEFORE INSERT OR UPDATE OR DELETE ON journal_preferences FOR EACH ROW EXECUTE FUNCTION guard_trial_metadata();
DROP TRIGGER IF EXISTS guard_trial_metadata ON trade_notes;
CREATE TRIGGER guard_trial_metadata BEFORE INSERT OR UPDATE OR DELETE ON trade_notes FOR EACH ROW EXECUTE FUNCTION guard_trial_metadata();

ALTER TABLE account_equity_samples DROP CONSTRAINT IF EXISTS account_equity_samples_account_id_fkey;
ALTER TABLE account_equity_samples ADD CONSTRAINT account_equity_samples_account_id_fkey FOREIGN KEY(account_id) REFERENCES demo_accounts(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- Growth Partner referral attribution (server-authoritative, pre-launch)
--
-- Codes are issued lazily per wallet identity. Attribution is written ONCE,
-- at account creation, from the of_ref cookie attached to the sign-up visit.
-- Self-referral is impossible (CHECK + code owner lookup), one account can be
-- attributed exactly once (UNIQUE), and no commission/reward data exists in
-- this schema: reward terms are unpublished and must never be implied.
CREATE TABLE IF NOT EXISTS referral_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_user_unique UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes (code);

CREATE TABLE IF NOT EXISTS referral_attributions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id  uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  referrer_user_id  uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  code              text NOT NULL,
  attributed_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_attributions_referred_unique UNIQUE (referred_user_id),
  CONSTRAINT referral_attributions_no_self CHECK (referred_user_id <> referrer_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer ON referral_attributions (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_at ON referral_attributions (attributed_at DESC);

-- ------------------------------------------------------------------
-- Phase 1 (2026-11): profile, challenge purchases, payments,
-- invoices and withdrawal requests.
--
-- Purchases are server-priced from challenge_plans.configuration
-- (priceUsd). Confirmed payments provision exactly ONE openfund_challenges
-- row per purchase order (UNIQUE order link). The demo trading engine and
-- demo_accounts are untouched: challenge accounts are already consumed by
-- accountDirectory() and the products router as type 'challenge'.
-- The payment destination address NEVER lives in the database — it is a
-- runtime env var (PURCHASE_PAYMENT_RECEIVER); purchases stay disabled
-- while it is unset (no production payment activation without approval).
-- ------------------------------------------------------------------

ALTER TABLE openfund_users ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  challenge_plan_id  uuid NOT NULL REFERENCES challenge_plans(id),
  account_size_usd   numeric(12,2) NOT NULL CHECK (account_size_usd > 0),
  price_usd          numeric(12,2) NOT NULL CHECK (price_usd >= 0),
  currency           text NOT NULL DEFAULT 'USD',
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','paid','cancelled','expired')),
  idempotency_key    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  paid_at            timestamptz,
  CONSTRAINT purchase_orders_user_key_unique UNIQUE (user_id, idempotency_key)
);
/* early-adopted test databases may carry the pre-release global constraint */
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_idempotency_key_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_user_key_unique') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_user_key_unique UNIQUE (user_id, idempotency_key);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user ON purchase_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders (status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  uuid NOT NULL REFERENCES purchase_orders(id),
  user_id            uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  tx_hash            text NOT NULL,
  chain_id           integer NOT NULL,
  block_number       bigint,
  from_address       text NOT NULL,
  to_address         text,
  amount             numeric(38,18),
  token_address      text,
  status             text NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed','failed')),
  verification       jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, tx_hash)
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, verified_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  uuid NOT NULL UNIQUE REFERENCES purchase_orders(id),
  user_id            uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  number             text NOT NULL UNIQUE,
  total_usd          numeric(12,2) NOT NULL,
  issued_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices (user_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  challenge_id       uuid REFERENCES openfund_challenges(id),
  amount_usd         numeric(12,2) NOT NULL CHECK (amount_usd > 0),
  status             text NOT NULL DEFAULT 'requested'
                     CHECK (status IN ('requested','approved','paid','rejected','cancelled')),
  note               text,
  payout_ref         text,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawal_requests (user_id, requested_at DESC);

-- Challenge records gain their purchased size + order provenance.
ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS account_size_usd numeric(12,2);
ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES purchase_orders(id);

-- ------------------------------------------------------------------
-- Phase 2 (v0.3.1 soft launch): challenge evaluation engine.
--
-- Challenge accounts are traded through the SAME demo trading engine
-- (demo_accounts.account_type='challenge'); the UNIQUE(user_id,
-- account_type) constraint is replaced by a partial unique index that
-- still guarantees exactly ONE free_demo account per user while
-- allowing multiple challenge accounts.
--
-- Lifecycle (immutable event history in challenge_events):
--   created -> started -> passed | failed | expired | cancelled
-- Two-phase plans progress by provisioning a stage-2 challenge row
-- (stage=2) when stage 1 passes; the stage-1 row terminates 'passed'.
-- Instant plans (phases=0) start directly at the funded simulation
-- stage: loss limits enforced, no profit target, no pass transition.
--
-- rules_snapshot freezes the effective plan configuration at
-- provisioning time so later catalog edits can never retroactively
-- change a purchased challenge's contractual evaluation criteria.
-- ------------------------------------------------------------------
ALTER TABLE demo_accounts DROP CONSTRAINT IF EXISTS demo_accounts_user_id_account_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_demo_accounts_free_unique ON demo_accounts(user_id) WHERE account_type='free_demo';
CREATE INDEX IF NOT EXISTS idx_demo_accounts_type ON demo_accounts(account_type);

ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS stage integer NOT NULL DEFAULT 1;
ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS rules_snapshot jsonb;
ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS demo_account_id uuid REFERENCES demo_accounts(id);
ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Immutable, append-only challenge lifecycle history (state transitions,
-- rule evaluations, violations). Auditable; never updated in place.
CREATE TABLE IF NOT EXISTS challenge_events (
  id            bigserial PRIMARY KEY,
  challenge_id  uuid NOT NULL REFERENCES openfund_challenges(id) ON DELETE CASCADE,
  kind          text NOT NULL,              -- created|started|passed|failed|expired|cancelled|stage_passed|violation|eval_deferred
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challenge_events_challenge ON challenge_events (challenge_id, id);

-- Per-day risk basis for challenge accounts. Day boundary is 00:00 UTC+3
-- (published Rulebook rule of record). basis = max(opening balance,
-- opening equity) — the daily loss limit is measured against it.
CREATE TABLE IF NOT EXISTS challenge_equity_days (
  challenge_id      uuid NOT NULL REFERENCES openfund_challenges(id) ON DELETE CASCADE,
  day               date NOT NULL,
  day_start_balance numeric(24,10) NOT NULL,
  day_start_equity  numeric(24,10) NOT NULL,
  basis             numeric(24,10) NOT NULL,
  peak_equity       numeric(24,10) NOT NULL,
  last_equity       numeric(24,10) NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, day)
);

-- Challenge-wide trailing drawdown state (Instant model; peak follows
-- highest recorded equity, floor locks at breakeven after the published
-- profit lock point).
CREATE TABLE IF NOT EXISTS challenge_trailing (
  challenge_id  uuid PRIMARY KEY REFERENCES openfund_challenges(id) ON DELETE CASCADE,
  peak_equity   numeric(24,10) NOT NULL,
  trailing_floor numeric(24,10) NOT NULL,
  locked_breakeven boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Invoice numbering: one gap-free sequence per calendar year.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- ------------------------------------------------------------------
-- Controlled plan-key normalization (backward compatible): legacy
-- backend-seeded rows wrote `maxDailyLossPct`; the canonical key is
-- `dailyLossPct` (frontend catalog + CMS seed path). This copy is
-- idempotent (only rows still missing the canonical key), never
-- overwrites admin-edited values, and preserves the legacy key for
-- traceability. evaluation.js also accepts the legacy key at read time.
-- ------------------------------------------------------------------
UPDATE challenge_plans
   SET configuration = jsonb_set(configuration, '{dailyLossPct}',
        to_jsonb(((configuration->>'maxDailyLossPct')::numeric)))
 WHERE configuration ? 'maxDailyLossPct'
   AND NOT (configuration ? 'dailyLossPct');
UPDATE challenge_plans
   SET configuration = jsonb_set(configuration, '{dailyLossPctAlt}',
        to_jsonb(((configuration->>'maxDailyLossPctAlt')::numeric)))
 WHERE configuration ? 'maxDailyLossPctAlt'
   AND NOT (configuration ? 'dailyLossPctAlt');
