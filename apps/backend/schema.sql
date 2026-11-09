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

-- ==================================================================
-- Economy, transparency, Brand Ambassador, Verified Coach and Live
-- Market Access (additive only; no existing table is altered except
-- through ADD COLUMN IF NOT EXISTS). The backend is the only writer of
-- every table below; Directus may READ them for backstage review.
-- Money columns are NUMERIC(20,2) USD unless stated otherwise.
-- ==================================================================

-- Append-only financial audit trail (before/after state of every
-- financial decision). UPDATE and DELETE are rejected by trigger.
CREATE TABLE IF NOT EXISTS financial_audit_log (
  id         bigserial PRIMARY KEY,
  ts         timestamptz NOT NULL DEFAULT now(),
  actor      text NOT NULL,                 -- 'admin:<name>' | 'user:<uuid>' | 'system'
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  before     jsonb,
  after      jsonb
);
CREATE INDEX IF NOT EXISTS idx_fin_audit_entity ON financial_audit_log (entity, entity_id, id);
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append_only_table' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS financial_audit_log_append_only ON financial_audit_log;
CREATE TRIGGER financial_audit_log_append_only BEFORE UPDATE OR DELETE ON financial_audit_log
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Refunds and chargebacks against a confirmed payment. The original
-- payment row is never edited or deleted; net revenue = paid − adjustments.
CREATE TABLE IF NOT EXISTS payment_adjustments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        uuid NOT NULL REFERENCES payments(id),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  kind              text NOT NULL CHECK (kind IN ('refund','chargeback')),
  amount_usd        numeric(20,2) NOT NULL CHECK (amount_usd > 0),
  reference         text NOT NULL,          -- refund tx hash or processor reference
  reason            text,
  recorded_by       text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, kind, reference)
);
CREATE INDEX IF NOT EXISTS idx_payment_adjustments_order ON payment_adjustments (purchase_order_id);

-- Treasury balance snapshots taken by the backend scheduler. A failed
-- read is stored as status='error' and never overwrites the last good one.
CREATE TABLE IF NOT EXISTS treasury_snapshots (
  id             bigserial PRIMARY KEY,
  taken_at       timestamptz NOT NULL DEFAULT now(),
  chain_id       integer NOT NULL,
  address        text NOT NULL,
  status         text NOT NULL CHECK (status IN ('ok','error')),
  block_number   bigint,
  assets         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{symbol,address,decimals,balance,priceUsd,valueUsd,priceSource,priceUpdatedAt}]
  total_usd      numeric(24,2),                       -- sum of PRICED assets only
  fully_priced   boolean NOT NULL DEFAULT false,
  error          text
);
CREATE INDEX IF NOT EXISTS idx_treasury_snapshots_ok ON treasury_snapshots (address, taken_at DESC) WHERE status = 'ok';
CREATE INDEX IF NOT EXISTS idx_treasury_snapshots_ts ON treasury_snapshots (taken_at DESC);

-- Capital reserves set explicitly by management (operational, risk,
-- other). Each change inserts a new row; the latest row per kind is in force.
CREATE TABLE IF NOT EXISTS capital_reserves (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('operational','risk','other')),
  amount_usd  numeric(20,2) NOT NULL CHECK (amount_usd >= 0),
  note        text,
  set_by      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capital_reserves_kind ON capital_reserves (kind, id DESC);

-- Other liabilities (debts, matured payables) recorded with evidence.
CREATE TABLE IF NOT EXISTS financial_obligations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('liability','payable','other')),
  description  text NOT NULL,
  amount_usd   numeric(20,2) NOT NULL CHECK (amount_usd > 0),
  due_on       date,
  reference    text NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','void')),
  recorded_by  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz
);

-- Verified company expenses. Estimates are never recorded as invoices:
-- every row needs a source and an invoice/document reference.
CREATE TABLE IF NOT EXISTS verified_expenses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category          text NOT NULL CHECK (category IN ('render_infrastructure','database','cms','market_data','operational_services','marketing','ambassador_commissions','salaries_administration','other')),
  description       text NOT NULL,
  amount            numeric(20,2) NOT NULL CHECK (amount > 0),
  currency          text NOT NULL,
  amount_usd        numeric(20,2) NOT NULL CHECK (amount_usd > 0),
  fx_reference      text,
  incurred_on       date NOT NULL,
  period_start      date,
  period_end        date,
  source            text NOT NULL CHECK (source IN ('provider_api','invoice','receipt','contract')),
  invoice_reference text NOT NULL,
  document_url      text,
  status            text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','verified','void')),
  payment_status    text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  payment_reference text,
  recorded_by       text NOT NULL,
  verified_by       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  verified_at       timestamptz,
  UNIQUE (category, invoice_reference)
);
CREATE INDEX IF NOT EXISTS idx_verified_expenses_date ON verified_expenses (incurred_on DESC);

-- ------------------------------------------------------------------
-- Partner programs. One applications table serves both independent
-- roles; each role needs its own approval (UNIQUE per user+role for
-- open applications). Status history is append-only.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  role           text NOT NULL CHECK (role IN ('ambassador','coach')),
  status         text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','suspended')),
  contact_email  text NOT NULL,
  payload        jsonb NOT NULL,
  verification   jsonb NOT NULL DEFAULT '{}'::jsonb,   -- reviewer-verified facts with evidence
  terms_version  text NOT NULL,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz,
  decided_by     text,
  decision_note  text
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_applications_open
  ON partner_applications (user_id, role) WHERE status IN ('submitted','under_review','approved','suspended');
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications (role, status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS partner_application_events (
  id             bigserial PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  from_status    text,
  to_status      text NOT NULL,
  actor          text NOT NULL,
  note           text,
  ts             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_application_events ON partner_application_events (application_id, id);

-- Approved ambassadors. The referral code exists ONLY after approval.
CREATE TABLE IF NOT EXISTS ambassador_profiles (
  user_id         uuid PRIMARY KEY REFERENCES openfund_users(id) ON DELETE CASCADE,
  application_id  uuid NOT NULL UNIQUE REFERENCES partner_applications(id),
  referral_code   text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  commission_rate numeric(6,4) NOT NULL DEFAULT 0.1000 CHECK (commission_rate = 0.1000),
  approved_at     timestamptz NOT NULL DEFAULT now(),
  approved_by     text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One ambassador attribution per referred customer, never self.
CREATE TABLE IF NOT EXISTS ambassador_attributions (
  referred_user_id   uuid PRIMARY KEY REFERENCES openfund_users(id) ON DELETE CASCADE,
  ambassador_user_id uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  referral_code      text NOT NULL,
  source             text NOT NULL CHECK (source IN ('signup','first_order')),
  campaign           text,
  attributed_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ambassador_attributions_no_self CHECK (referred_user_id <> ambassador_user_id)
);
CREATE INDEX IF NOT EXISTS idx_ambassador_attributions_amb ON ambassador_attributions (ambassador_user_id, attributed_at DESC);

-- Referral traffic: hashed visitor fingerprints only (no IP stored).
CREATE TABLE IF NOT EXISTS referral_visits (
  id            bigserial PRIMARY KEY,
  referral_code text NOT NULL,
  visitor_hash  text NOT NULL,
  campaign      text,
  day           date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  ts            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referral_code, visitor_hash, day)
);
CREATE INDEX IF NOT EXISTS idx_referral_visits_code ON referral_visits (referral_code, day DESC);

-- Commission ledger (append-only): earned on the first confirmed
-- purchase, reversal on refund/chargeback, payout when transferred.
CREATE TABLE IF NOT EXISTS referral_commissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_user_id uuid NOT NULL REFERENCES openfund_users(id),
  referred_user_id   uuid REFERENCES openfund_users(id),
  entry_type         text NOT NULL CHECK (entry_type IN ('earned','reversal','payout')),
  purchase_order_id  uuid REFERENCES purchase_orders(id),
  payment_id         uuid REFERENCES payments(id),
  adjustment_id      uuid REFERENCES payment_adjustments(id),
  base_amount_usd    numeric(20,2),
  rate               numeric(6,4),
  amount_usd         numeric(20,2) NOT NULL,           -- signed: earned > 0, reversal/payout < 0
  campaign           text,
  payout_reference   text,
  recorded_by        text NOT NULL DEFAULT 'system',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((entry_type = 'earned' AND amount_usd > 0) OR (entry_type <> 'earned' AND amount_usd < 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_first_purchase ON referral_commissions (referred_user_id) WHERE entry_type = 'earned';
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_order ON referral_commissions (purchase_order_id) WHERE entry_type = 'earned';
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_reversal ON referral_commissions (adjustment_id) WHERE entry_type = 'reversal';
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_payout_ref ON referral_commissions (ambassador_user_id, payout_reference) WHERE entry_type = 'payout';
CREATE INDEX IF NOT EXISTS idx_commission_amb ON referral_commissions (ambassador_user_id, created_at DESC);
DROP TRIGGER IF EXISTS referral_commissions_append_only ON referral_commissions;
CREATE TRIGGER referral_commissions_append_only BEFORE UPDATE OR DELETE ON referral_commissions
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Approved coaches (independent of ambassadors).
CREATE TABLE IF NOT EXISTS coach_profiles (
  user_id        uuid PRIMARY KEY REFERENCES openfund_users(id) ON DELETE CASCADE,
  application_id uuid NOT NULL UNIQUE REFERENCES partner_applications(id),
  coach_code     text NOT NULL UNIQUE,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  approved_at    timestamptz NOT NULL DEFAULT now(),
  approved_by    text NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trader_coach_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_user_id     uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  coach_user_id      uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','active','declined','ended')),
  qualification      text NOT NULL DEFAULT 'pending' CHECK (qualification IN ('pending','verified','rejected')),
  qualification_note text,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  verified_at        timestamptz,
  ended_at           timestamptz,
  CONSTRAINT trader_coach_links_no_self CHECK (trader_user_id <> coach_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trader_coach_open ON trader_coach_links (trader_user_id) WHERE status IN ('requested','active');
CREATE INDEX IF NOT EXISTS idx_trader_coach_coach ON trader_coach_links (coach_user_id, status);

-- ------------------------------------------------------------------
-- Live Market Access. Nothing here executes by default: the execution
-- adapter is selected by LIVE_EXECUTION_ADAPTER (default 'none').
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_funding_approvals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_user_id      uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  coach_user_id       uuid NOT NULL REFERENCES openfund_users(id),
  status              text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected','revoked')),
  eligibility         jsonb NOT NULL,                 -- backend eligibility evidence at request time
  tier                text,                           -- admin-selected; null until decided
  trader_pct          numeric(5,2),
  coach_pct           numeric(5,2),
  openfund_pct        numeric(5,2),
  requested_at        timestamptz NOT NULL DEFAULT now(),
  decided_at          timestamptz,
  decided_by          text,
  note                text,
  CHECK (status <> 'approved' OR (tier IS NOT NULL AND coach_pct = 10 AND trader_pct + coach_pct + openfund_pct = 100))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_approvals_open ON live_funding_approvals (trader_user_id) WHERE status IN ('pending_review','approved');

CREATE TABLE IF NOT EXISTS capital_allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id     uuid NOT NULL REFERENCES live_funding_approvals(id),
  trader_user_id  uuid NOT NULL REFERENCES openfund_users(id),
  amount_usd      numeric(20,2) NOT NULL CHECK (amount_usd > 0),
  realized_pnl_usd numeric(20,2) NOT NULL DEFAULT 0,
  peak_equity_usd numeric(20,2) NOT NULL,
  day             date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  day_start_equity_usd numeric(20,2) NOT NULL,
  risk_limits     jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','halted','closed')),
  halt_reason     text,
  adapter         text NOT NULL,
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_capital_allocations_open ON capital_allocations (trader_user_id) WHERE status IN ('active','halted');

CREATE TABLE IF NOT EXISTS live_trades (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id      uuid NOT NULL REFERENCES capital_allocations(id),
  trader_user_id     uuid NOT NULL REFERENCES openfund_users(id),
  adapter            text NOT NULL,
  idempotency_key    text NOT NULL,
  market             text NOT NULL,
  side               text NOT NULL CHECK (side IN ('long','short')),
  collateral_usd     numeric(20,2) NOT NULL CHECK (collateral_usd > 0),
  leverage           numeric(8,2) NOT NULL CHECK (leverage > 0),
  status             text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','rejected','open','closing','closed','failed','reconcile_required')),
  reject_reason      text,
  external_order_id  text,
  external_trade_ref text,
  open_tx_hash       text,
  close_tx_hash      text,
  entry_price        numeric(24,10),
  exit_price         numeric(24,10),
  realized_pnl_usd   numeric(20,2),                   -- verified gross realized PnL at close
  trading_fees_usd   numeric(20,2),
  execution_costs_usd numeric(20,2),
  opened_at          timestamptz,
  closed_at          timestamptz,
  finalized_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (allocation_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_live_trades_alloc ON live_trades (allocation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_trade_events (
  id            bigserial PRIMARY KEY,
  live_trade_id uuid NOT NULL REFERENCES live_trades(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_live_trade_events ON live_trade_events (live_trade_id, id);
DROP TRIGGER IF EXISTS live_trade_events_append_only ON live_trade_events;
CREATE TRIGGER live_trade_events_append_only BEFORE UPDATE OR DELETE ON live_trade_events
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- One profit-share allocation per finalized profitable live trade.
CREATE TABLE IF NOT EXISTS profit_share_allocations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_trade_id        uuid NOT NULL UNIQUE REFERENCES live_trades(id),
  approval_id          uuid NOT NULL REFERENCES live_funding_approvals(id),
  trader_user_id       uuid NOT NULL REFERENCES openfund_users(id),
  coach_user_id        uuid NOT NULL REFERENCES openfund_users(id),
  realized_pnl_usd     numeric(20,2) NOT NULL,
  eligible_costs_usd   numeric(20,2) NOT NULL,
  distributable_usd    numeric(20,2) NOT NULL CHECK (distributable_usd > 0),
  trader_pct           numeric(5,2) NOT NULL,
  coach_pct            numeric(5,2) NOT NULL CHECK (coach_pct = 10),
  openfund_pct         numeric(5,2) NOT NULL,
  trader_amount_usd    numeric(20,2) NOT NULL,
  coach_amount_usd     numeric(20,2) NOT NULL,
  openfund_amount_usd  numeric(20,2) NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (trader_pct + coach_pct + openfund_pct = 100),
  CHECK (trader_amount_usd + coach_amount_usd + openfund_amount_usd = distributable_usd)
);

CREATE TABLE IF NOT EXISTS settlement_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profit_share_id     uuid NOT NULL REFERENCES profit_share_allocations(id),
  beneficiary_role    text NOT NULL CHECK (beneficiary_role IN ('trader','coach')),
  beneficiary_user_id uuid NOT NULL REFERENCES openfund_users(id),
  amount_usd          numeric(20,2) NOT NULL CHECK (amount_usd > 0),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','reconcile_required')),
  adapter             text,
  attempts            integer NOT NULL DEFAULT 0,
  tx_hash             text,
  settlement_reference text,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  UNIQUE (profit_share_id, beneficiary_role)
);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlement_records (status) WHERE status IN ('pending','failed','processing');
CREATE INDEX IF NOT EXISTS idx_settlements_beneficiary ON settlement_records (beneficiary_user_id, created_at DESC);
