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

ALTER TABLE openfund_users ALTER COLUMN wallet_chain SET DEFAULT 42161; -- Arbitrum One (wallet auth is Arbitrum-only)

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
-- Openfund Hybrid Governance v1.0 (additive; see GOVERNANCE.md)
--
-- ISOLATION: these tables reference openfund_users ONLY. They have no
-- foreign key to, and are never written together with, any trading,
-- order, payment, payout, treasury or pricing table. A council decision
-- is a record, never an executable instruction.
-- Evidence tables (votes, decisions, history, audit) are append-only,
-- enforced by triggers, not just by application code.
-- ===========================================================
CREATE OR REPLACE FUNCTION gov_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'governance evidence table % is append-only', TG_TABLE_NAME USING ERRCODE = '23000';
END; $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS gov_terms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label              text NOT NULL UNIQUE,
  starts_at          timestamptz NOT NULL,
  ends_at            timestamptz NOT NULL,
  appointment_method text NOT NULL CHECK (appointment_method IN ('appointed', 'elected')),
  status             text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'ended')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gov_one_active_term ON gov_terms ((true)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS gov_seats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id       uuid NOT NULL REFERENCES gov_terms (id),
  constituency  text NOT NULL CHECK (constituency IN ('ambassador', 'coach', 'community_trader', 'funded_trader', 'moderator')),
  seat_no       integer NOT NULL CHECK (seat_no IN (1, 2)),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_id, constituency, seat_no)
);

CREATE TABLE IF NOT EXISTS gov_eligibility (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES openfund_users (id),
  constituency text NOT NULL CHECK (constituency IN ('ambassador', 'coach', 'community_trader', 'funded_trader', 'moderator')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'revoked')),
  person_ref   text,                        -- management-assigned identity group: one person, several wallets
  evidence_ref text,                        -- reference to the verification record (never personal data)
  source       text NOT NULL DEFAULT 'management_review',
  decided_by   text,
  decided_at   timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, constituency)
);

CREATE TABLE IF NOT EXISTS gov_memberships (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id             uuid NOT NULL REFERENCES gov_seats (id),
  user_id             uuid NOT NULL REFERENCES openfund_users (id),
  person_ref          text,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'ended')),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  appointment_method  text NOT NULL CHECK (appointment_method IN ('appointed', 'elected')),
  appointed_by        text NOT NULL,
  public_display_name text,
  public_consent      boolean NOT NULL DEFAULT false,
  revoked_at          timestamptz,
  revoked_reason      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gov_active_seat ON gov_memberships (seat_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_gov_active_user ON gov_memberships (user_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_gov_active_person ON gov_memberships (person_ref) WHERE status = 'active' AND person_ref IS NOT NULL;

-- session-based governance roles beyond the derived ones (council seat,
-- proposal author). Written only through the protected admin API.
CREATE TABLE IF NOT EXISTS gov_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES openfund_users (id),
  role       text NOT NULL CHECK (role IN ('moderator', 'reviewer', 'administrator')),
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gov_role_active ON gov_roles (user_id, role) WHERE revoked_at IS NULL;

CREATE SEQUENCE IF NOT EXISTS gov_ofp_seq;
CREATE TABLE IF NOT EXISTS gov_proposals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ofp_number              bigint NOT NULL UNIQUE DEFAULT nextval('gov_ofp_seq'),
  ofp_id                  text GENERATED ALWAYS AS ('OFP-' || lpad(ofp_number::text, 4, '0')) STORED,
  author_id               uuid NOT NULL REFERENCES openfund_users (id),
  title                   text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
  summary                 text NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 600),
  description             text NOT NULL DEFAULT '',
  category                text NOT NULL,
  classification          text NOT NULL DEFAULT 'advisory' CHECK (classification IN ('binding', 'advisory')),
  product_area            text,
  technical_implications  text,
  resource_requirements   text,
  expected_benefits       text,
  risks                   text,
  documentation_links     jsonb NOT NULL DEFAULT '[]'::jsonb,
  github_issue_url        text,
  github_pr_url           text,
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','discussion','submitted','under_review','voting','approved','rejected',
     'implementation_scheduled','in_progress','implemented','blocked','archived')),
  revision                integer NOT NULL DEFAULT 1,
  capacity_confirmed      boolean NOT NULL DEFAULT false,   -- management confirmed the resource envelope
  capacity_confirmed_by   text,
  decision                text,
  decision_rationale      text,
  implementation_status   text NOT NULL DEFAULT 'not_started' CHECK (implementation_status IN
    ('not_started','scheduled','in_progress','implemented','blocked')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  -- reserved company powers can only ever be advisory: enforced in the database
  CONSTRAINT gov_reserved_is_advisory CHECK (
    classification = 'advisory' OR category IN
      ('product_priority','community_policy','open_source','roadmap','documentation','accessibility','governance_amendment')
  )
);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_status ON gov_proposals (status, updated_at DESC);

CREATE OR REPLACE FUNCTION gov_proposal_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.ofp_number IS DISTINCT FROM OLD.ofp_number THEN
    RAISE EXCEPTION 'a proposal identifier and its author are immutable' USING ERRCODE = '23000';
  END IF;
  IF OLD.status NOT IN ('draft','discussion','submitted','under_review')
     AND (NEW.category IS DISTINCT FROM OLD.category OR NEW.classification IS DISTINCT FROM OLD.classification) THEN
    RAISE EXCEPTION 'proposal category and classification are frozen once voting has opened' USING ERRCODE = '23000';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_gov_proposal_guard ON gov_proposals;
CREATE TRIGGER trg_gov_proposal_guard BEFORE UPDATE ON gov_proposals FOR EACH ROW EXECUTE FUNCTION gov_proposal_guard();

CREATE TABLE IF NOT EXISTS gov_proposal_revisions (
  proposal_id uuid NOT NULL REFERENCES gov_proposals (id),
  revision    integer NOT NULL,
  snapshot    jsonb NOT NULL,
  created_by  uuid NOT NULL REFERENCES openfund_users (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, revision)
);
DROP TRIGGER IF EXISTS trg_gov_revisions_append ON gov_proposal_revisions;
CREATE TRIGGER trg_gov_revisions_append BEFORE UPDATE OR DELETE ON gov_proposal_revisions FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();

CREATE TABLE IF NOT EXISTS gov_proposal_history (
  id          bigserial PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES gov_proposals (id),
  from_status text,
  to_status   text NOT NULL,
  actor_id    uuid REFERENCES openfund_users (id),
  actor_role  text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gov_history_proposal ON gov_proposal_history (proposal_id, id);
DROP TRIGGER IF EXISTS trg_gov_history_append ON gov_proposal_history;
CREATE TRIGGER trg_gov_history_append BEFORE UPDATE OR DELETE ON gov_proposal_history FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();

-- public discussion; a stance is non-binding community feedback, never a vote
CREATE TABLE IF NOT EXISTS gov_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES gov_proposals (id),
  user_id     uuid NOT NULL REFERENCES openfund_users (id),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  stance      text CHECK (stance IN ('support', 'oppose', 'neutral')),
  status      text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gov_comments_proposal ON gov_comments (proposal_id, created_at);

CREATE TABLE IF NOT EXISTS gov_voting_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     uuid NOT NULL REFERENCES gov_proposals (id),
  revision        integer NOT NULL,
  threshold_kind  text NOT NULL CHECK (threshold_kind IN ('ordinary', 'constitutional')),
  council_size    integer NOT NULL,
  quorum          integer NOT NULL,
  threshold       integer NOT NULL,
  opens_at        timestamptz NOT NULL,
  closes_at       timestamptz NOT NULL,
  snapshot        jsonb NOT NULL,           -- seats + members + term at the voting boundary
  snapshot_hash   text NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finalized', 'void')),
  void_reason     text,
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finalized_at    timestamptz,
  CHECK (closes_at > opens_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gov_one_active_session ON gov_voting_sessions (proposal_id) WHERE status = 'active';

CREATE OR REPLACE FUNCTION gov_session_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'voting sessions cannot be deleted' USING ERRCODE = '23000'; END IF;
  IF OLD.status <> 'active' THEN RAISE EXCEPTION 'a closed voting session is immutable' USING ERRCODE = '23000'; END IF;
  IF NEW.proposal_id IS DISTINCT FROM OLD.proposal_id OR NEW.revision IS DISTINCT FROM OLD.revision
     OR NEW.threshold_kind IS DISTINCT FROM OLD.threshold_kind OR NEW.council_size IS DISTINCT FROM OLD.council_size
     OR NEW.quorum IS DISTINCT FROM OLD.quorum OR NEW.threshold IS DISTINCT FROM OLD.threshold
     OR NEW.opens_at IS DISTINCT FROM OLD.opens_at OR NEW.closes_at IS DISTINCT FROM OLD.closes_at
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash THEN
    RAISE EXCEPTION 'voting rules and the eligibility snapshot are fixed once the session exists' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_gov_session_guard ON gov_voting_sessions;
CREATE TRIGGER trg_gov_session_guard BEFORE UPDATE OR DELETE ON gov_voting_sessions FOR EACH ROW EXECUTE FUNCTION gov_session_guard();

CREATE TABLE IF NOT EXISTS gov_vote_challenges (
  nonce      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES openfund_users (id),
  session_id uuid NOT NULL REFERENCES gov_voting_sessions (id),
  message    text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

CREATE TABLE IF NOT EXISTS gov_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES gov_voting_sessions (id),
  seat_id     uuid NOT NULL REFERENCES gov_seats (id),
  user_id     uuid NOT NULL REFERENCES openfund_users (id),
  choice      text NOT NULL CHECK (choice IN ('approve', 'reject', 'abstain')),
  nonce       text REFERENCES gov_vote_challenges (nonce),
  signed_message text,
  signature   text,
  cast_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, seat_id),
  UNIQUE (session_id, user_id)
);
DROP TRIGGER IF EXISTS trg_gov_votes_append ON gov_votes;
CREATE TRIGGER trg_gov_votes_append BEFORE UPDATE OR DELETE ON gov_votes FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();

CREATE TABLE IF NOT EXISTS gov_conflicts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES gov_proposals (id),
  seat_id     uuid NOT NULL REFERENCES gov_seats (id),
  user_id     uuid NOT NULL REFERENCES openfund_users (id),
  reason      text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
  seeks_recusal boolean NOT NULL DEFAULT true,
  status      text NOT NULL DEFAULT 'declared' CHECK (status IN ('declared', 'recused', 'no_recusal')),
  reviewed_by text,
  review_note text,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, user_id)
);

CREATE TABLE IF NOT EXISTS gov_decisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES gov_proposals (id),
  session_id  uuid NOT NULL UNIQUE REFERENCES gov_voting_sessions (id),
  outcome     text NOT NULL CHECK (outcome IN ('approved', 'rejected', 'unresolved')),
  binding     boolean NOT NULL,
  rationale   text,
  tally       jsonb NOT NULL,
  decided_by  text NOT NULL,
  decided_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_gov_decisions_append ON gov_decisions;
CREATE TRIGGER trg_gov_decisions_append BEFORE UPDATE OR DELETE ON gov_decisions FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();

-- corrections never edit a decision: they are explicit, reasoned amendments
CREATE TABLE IF NOT EXISTS gov_decision_amendments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES gov_decisions (id),
  amended_by  text NOT NULL,
  reason      text NOT NULL CHECK (char_length(reason) >= 10),
  correction  jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_gov_amend_append ON gov_decision_amendments;
CREATE TRIGGER trg_gov_amend_append BEFORE UPDATE OR DELETE ON gov_decision_amendments FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();

CREATE TABLE IF NOT EXISTS gov_implementation_log (
  id             bigserial PRIMARY KEY,
  proposal_id    uuid NOT NULL REFERENCES gov_proposals (id),
  status         text NOT NULL CHECK (status IN ('scheduled','in_progress','implemented','blocked')),
  evidence_url   text,
  evidence_note  text,
  blocked_reason text,
  blocked_evidence text,
  next_review_on date,
  recorded_by    text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_gov_impl_append ON gov_implementation_log;
CREATE TRIGGER trg_gov_impl_append BEFORE UPDATE OR DELETE ON gov_implementation_log FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();

-- elections (architecture v1: disabled until management approves the rules)
CREATE TABLE IF NOT EXISTS gov_elections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id          uuid NOT NULL REFERENCES gov_terms (id),
  constituency     text NOT NULL CHECK (constituency IN ('ambassador', 'coach', 'community_trader', 'funded_trader', 'moderator')),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','applications','candidates_approved','voting','closed','finalized','cancelled')),
  rules_approved   boolean NOT NULL DEFAULT false,
  rules_approved_by text,
  applications_open_at timestamptz,
  applications_close_at timestamptz,
  voting_opens_at  timestamptz,
  voting_closes_at timestamptz,
  snapshot_taken_at timestamptz,
  result           jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_id, constituency)
);
CREATE TABLE IF NOT EXISTS gov_election_candidates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES gov_elections (id),
  user_id     uuid NOT NULL REFERENCES openfund_users (id),
  statement   text,
  public_display_name text,
  status      text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'approved', 'rejected', 'withdrawn')),
  decided_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_id, user_id)
);
CREATE TABLE IF NOT EXISTS gov_election_voters (
  election_id uuid NOT NULL REFERENCES gov_elections (id),
  user_id     uuid NOT NULL REFERENCES openfund_users (id),
  PRIMARY KEY (election_id, user_id)
);
CREATE TABLE IF NOT EXISTS gov_election_votes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id  uuid NOT NULL REFERENCES gov_elections (id),
  voter_id     uuid NOT NULL REFERENCES openfund_users (id),
  candidate_id uuid NOT NULL REFERENCES gov_election_candidates (id),
  cast_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_id, voter_id)
);
DROP TRIGGER IF EXISTS trg_gov_elvotes_append ON gov_election_votes;
CREATE TRIGGER trg_gov_elvotes_append BEFORE UPDATE OR DELETE ON gov_election_votes FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();
DROP TRIGGER IF EXISTS trg_gov_elvoters_append ON gov_election_voters;
CREATE TRIGGER trg_gov_elvoters_append BEFORE UPDATE OR DELETE ON gov_election_voters FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();

-- tamper-evident audit chain: every row hashes its predecessor
CREATE TABLE IF NOT EXISTS gov_audit_events (
  id            bigserial PRIMARY KEY,
  event_type    text NOT NULL,
  actor_user_id uuid REFERENCES openfund_users (id),
  actor_role    text NOT NULL,
  subject_type  text NOT NULL,
  subject_id    text,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash     text NOT NULL,
  hash          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gov_audit_subject ON gov_audit_events (subject_type, subject_id, id);
DROP TRIGGER IF EXISTS trg_gov_audit_append ON gov_audit_events;
CREATE TRIGGER trg_gov_audit_append BEFORE UPDATE OR DELETE ON gov_audit_events FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation();
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

-- Payment attempts (v0.5): every on-chain verification the customer, the
-- recovery sweep or an operator triggers is recorded — pending, rejected
-- or confirmed — so a payment that is mined but not yet provisioned can be
-- retried automatically, investigated by order id / tx hash, and reviewed
-- (underpayment, wrong token, late, overpayment, duplicate). Additive only;
-- the payments table stays the single record of CONFIRMED payments.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  user_id           uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  chain_id          integer NOT NULL,
  tx_hash           text NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rejected','confirmed')),
  error_code        text,
  retryable         boolean NOT NULL DEFAULT false,
  classification    text,              -- underpayment | wrong_token | wrong_receiver | wrong_sender | late | overpayment | duplicate | reverted | other
  detail            jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts          integer NOT NULL DEFAULT 1,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_attempt_at   timestamptz NOT NULL DEFAULT now(),
  review_status     text NOT NULL DEFAULT 'none' CHECK (review_status IN ('none','open','resolved')),
  review_note       text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  UNIQUE (purchase_order_id, chain_id, tx_hash)
);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_retry ON payment_attempts (last_attempt_at) WHERE status = 'pending' AND retryable;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_review ON payment_attempts (review_status) WHERE review_status = 'open';
CREATE INDEX IF NOT EXISTS idx_payment_attempts_tx ON payment_attempts (chain_id, tx_hash);
-- Multi-chain DePay settlement (docs/payments/DEPAY.md): an attempt DePay
-- attested for an order (signed callback/event) may come from any wallet;
-- what DePay reported (source token/amount/sender) is kept apart from the
-- verified settlement recorded on payments.
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS attested boolean NOT NULL DEFAULT false;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS reported jsonb;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS blockchain text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS source_token text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS source_amount text;

-- ------------------------------------------------------------------
-- Purchase lifecycle state machine, coupons and DePay events
-- (docs/payments/ORDER_LIFECYCLE.md, docs/payments/COUPONS.md,
--  docs/payments/DEPAY.md). Additive and idempotent: existing columns,
-- statuses and code paths keep working; `status` stays the coarse
-- compatibility field and `lifecycle_state` is the explicit state.
-- ------------------------------------------------------------------

/* Coupons are administered in Directus (Data Studio, role "Commerce Admin")
   on these tables of the shared database; the backend reads them at checkout
   and stays the only authority for validation, pricing and redemption.
   Directus-friendly types: JSON instead of PostgreSQL arrays, M2M junction
   tables for challenge models and allowed test accounts, and the Directus
   user stamps (user_created / user_updated: UUIDs of directus_users, no FK
   because the backend migrates before Directus bootstraps). */
CREATE TABLE IF NOT EXISTS coupons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL CHECK (code = upper(code) AND code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  name             text,
  description      text,
  kind             text NOT NULL CHECK (kind IN ('percent','fixed')),
  value            numeric(12,2) NOT NULL CHECK (value > 0),
  status           text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','revoked')),
  max_redemptions  integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  per_user_limit   integer NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  products         jsonb CHECK (products IS NULL OR jsonb_typeof(products) = 'array'),       -- NULL = every product (checkout sells "prop" challenges)
  account_sizes    jsonb CHECK (account_sizes IS NULL OR jsonb_typeof(account_sizes) = 'array'), -- NULL = every account size
  internal         boolean NOT NULL DEFAULT false,
  starts_at        timestamptz,
  expires_at       timestamptz,
  created_by       text NOT NULL DEFAULT 'directus',
  user_created     uuid,
  user_updated     uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  uses_reserved    integer NOT NULL DEFAULT 0,   -- display counters maintained by trigger; limits are
  uses_consumed    integer NOT NULL DEFAULT 0,   -- enforced from coupon_redemptions under a row lock
  CONSTRAINT coupons_percent_range CHECK (kind <> 'percent' OR value <= 100),
  CONSTRAINT coupons_window CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at),
  /* internal testing coupons always carry a finite usage limit; the allowed
     test accounts (1–2) are enforced by trigger and at checkout */
  CONSTRAINT coupons_internal_limited CHECK (NOT internal OR max_redemptions IS NOT NULL),
  CONSTRAINT coupons_code_unique UNIQUE (code)
);

/* eligible challenge models (M2M → challenge_plans); no rows = every model */
CREATE TABLE IF NOT EXISTS coupon_challenge_plans (
  id                 serial PRIMARY KEY,
  coupon_id          uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  challenge_plan_id  uuid NOT NULL REFERENCES challenge_plans(id),
  UNIQUE (coupon_id, challenge_plan_id)
);
/* allowed customers (M2M → openfund_users); no rows = any signed-in customer.
   Internal test coupons need 1–2 rows (more is rejected by trigger). */
CREATE TABLE IF NOT EXISTS coupon_allowed_users (
  id         serial PRIMARY KEY,
  coupon_id  uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  UNIQUE (coupon_id, user_id)
);

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS lifecycle_state text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS list_price_usd numeric(12,2);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_usd numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES coupons(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_required boolean NOT NULL DEFAULT true;
UPDATE purchase_orders SET lifecycle_state = CASE status WHEN 'pending' THEN 'awaiting_payment' WHEN 'paid' THEN 'provisioned' ELSE status END
 WHERE lifecycle_state IS NULL;
UPDATE purchase_orders SET list_price_usd = price_usd WHERE list_price_usd IS NULL;
ALTER TABLE purchase_orders ALTER COLUMN lifecycle_state SET DEFAULT 'awaiting_payment';
ALTER TABLE purchase_orders ALTER COLUMN lifecycle_state SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_lifecycle_state_check') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_lifecycle_state_check CHECK (lifecycle_state IN
      ('awaiting_payment','payment_detected','manual_review','paid','provisioned','cancelled','expired','partially_refunded','refunded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_discount_check') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_discount_check
      CHECK (discount_usd >= 0 AND (list_price_usd IS NULL OR (discount_usd <= list_price_usd AND price_usd = list_price_usd - discount_usd)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_zero_payment_check') THEN
    /* a zero-payment order exists only through a 100% coupon */
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_zero_payment_check
      CHECK ((payment_required AND price_usd > 0) OR (NOT payment_required AND price_usd = 0 AND coupon_id IS NOT NULL));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_coupon ON purchase_orders (coupon_id) WHERE coupon_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id          uuid NOT NULL REFERENCES coupons(id),
  user_id            uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  purchase_order_id  uuid NOT NULL UNIQUE REFERENCES purchase_orders(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released')),
  list_price_usd     numeric(12,2) NOT NULL,
  discount_usd       numeric(12,2) NOT NULL,
  net_price_usd      numeric(12,2) NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  consumed_at        timestamptz,
  released_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions (coupon_id, status);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions (coupon_id, user_id, status);

-- Administrative coupon changes (create, edit, disable) — append-only.
CREATE TABLE IF NOT EXISTS coupon_audit (
  id          bigserial PRIMARY KEY,
  coupon_id   uuid NOT NULL REFERENCES coupons(id),
  actor       text NOT NULL,
  action      text NOT NULL,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS coupon_audit_append_only ON coupon_audit;
CREATE TRIGGER coupon_audit_append_only BEFORE UPDATE OR DELETE ON coupon_audit
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

/* Coupon integrity — identical for every writer (Directus Data Studio, the
   backend admin API, SQL): normalized codes, final revocation, pricing locked
   once redeemed, internal coupons limited to two test accounts, display
   counters, and an append-only audit row for every administrative change. */
CREATE OR REPLACE FUNCTION coupon_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  /* counter maintenance (trigger below) is not an administrative change */
  IF (to_jsonb(NEW) - ARRAY['uses_reserved','uses_consumed','updated_at']) = (to_jsonb(OLD) - ARRAY['uses_reserved','uses_consumed','updated_at']) THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'revoked' THEN
    RAISE EXCEPTION 'coupon_revoked_is_final' USING ERRCODE = '23514';
  END IF;
  IF (NEW.code, NEW.kind, NEW.value) IS DISTINCT FROM (OLD.code, OLD.kind, OLD.value)
     AND EXISTS (SELECT 1 FROM coupon_redemptions WHERE coupon_id = OLD.id) THEN
    RAISE EXCEPTION 'coupon_pricing_locked: code, type and value cannot change after the first redemption' USING ERRCODE = '23514';
  END IF;
  IF NEW.internal AND (SELECT count(*) FROM coupon_allowed_users WHERE coupon_id = NEW.id) > 2 THEN
    RAISE EXCEPTION 'internal_coupon_max_two_test_accounts' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS coupon_guard ON coupons;
CREATE TRIGGER coupon_guard BEFORE INSERT OR UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION coupon_guard();

CREATE OR REPLACE FUNCTION coupon_audit_actor(directus_user uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('openfund.actor', true), ''),
                  CASE WHEN directus_user IS NOT NULL THEN 'directus:' || directus_user::text END,
                  'database:' || current_user)
$$;

CREATE OR REPLACE FUNCTION coupon_audit_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_j jsonb; after_j jsonb; act text;
BEGIN
  after_j := to_jsonb(NEW) - ARRAY['uses_reserved','uses_consumed'];
  IF TG_OP = 'INSERT' THEN
    INSERT INTO coupon_audit (coupon_id, actor, action, after) VALUES (NEW.id, coupon_audit_actor(NEW.user_created), 'created', after_j);
    RETURN NEW;
  END IF;
  before_j := to_jsonb(OLD) - ARRAY['uses_reserved','uses_consumed'];
  IF (before_j - 'updated_at') = (after_j - 'updated_at') THEN RETURN NEW; END IF;
  act := CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN
           CASE NEW.status WHEN 'active' THEN 'activated' WHEN 'inactive' THEN 'deactivated' ELSE 'revoked' END
         ELSE 'updated' END;
  INSERT INTO coupon_audit (coupon_id, actor, action, before, after)
  VALUES (NEW.id, coupon_audit_actor(coalesce(NEW.user_updated, NEW.user_created)), act, before_j, after_j);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS coupon_audit_write ON coupons;
CREATE TRIGGER coupon_audit_write AFTER INSERT OR UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION coupon_audit_write();

/* eligibility relations are audited too, and internal coupons accept at most
   two allowed test accounts */
CREATE OR REPLACE FUNCTION coupon_relation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; cid uuid; is_internal boolean; directus_user uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  cid := r.coupon_id;
  SELECT internal, coalesce(user_updated, user_created) INTO is_internal, directus_user FROM coupons WHERE id = cid;
  IF NOT FOUND THEN RETURN r; END IF; /* coupon itself being deleted */
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'coupon_allowed_users' AND is_internal
     AND (SELECT count(*) FROM coupon_allowed_users WHERE coupon_id = cid) > 2 THEN
    RAISE EXCEPTION 'internal_coupon_max_two_test_accounts' USING ERRCODE = '23514';
  END IF;
  INSERT INTO coupon_audit (coupon_id, actor, action, after)
  VALUES (cid, coupon_audit_actor(directus_user),
          CASE TG_TABLE_NAME WHEN 'coupon_allowed_users' THEN 'allowed_user_' ELSE 'challenge_model_' END || lower(TG_OP),
          to_jsonb(r) - 'id');
  RETURN r;
END $$;
DROP TRIGGER IF EXISTS coupon_allowed_users_audit ON coupon_allowed_users;
CREATE TRIGGER coupon_allowed_users_audit AFTER INSERT OR DELETE ON coupon_allowed_users FOR EACH ROW EXECUTE FUNCTION coupon_relation_audit();
DROP TRIGGER IF EXISTS coupon_challenge_plans_audit ON coupon_challenge_plans;
CREATE TRIGGER coupon_challenge_plans_audit AFTER INSERT OR DELETE ON coupon_challenge_plans FOR EACH ROW EXECUTE FUNCTION coupon_relation_audit();

/* usage counters shown in Directus (display only) */
CREATE OR REPLACE FUNCTION coupon_usage_counters() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE coupons c SET
    uses_reserved = (SELECT count(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'reserved'),
    uses_consumed = (SELECT count(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'consumed')
   WHERE c.id = NEW.coupon_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS coupon_usage_counters ON coupon_redemptions;
CREATE TRIGGER coupon_usage_counters AFTER INSERT OR UPDATE OF status ON coupon_redemptions FOR EACH ROW EXECUTE FUNCTION coupon_usage_counters();

/* payment method of record: an on-chain payment, or a coupon (a 100%
   discount); internal test coupons are recorded as such and, like every
   zero-payment order, are excluded from revenue reporting and commissions */
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_method text;
UPDATE purchase_orders SET payment_method = CASE WHEN payment_required THEN 'crypto' ELSE 'coupon' END WHERE payment_method IS NULL;
ALTER TABLE purchase_orders ALTER COLUMN payment_method SET DEFAULT 'crypto';
ALTER TABLE purchase_orders ALTER COLUMN payment_method SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_payment_method_check') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_payment_method_check
      CHECK ((payment_method = 'crypto' AND payment_required) OR (payment_method IN ('coupon','internal_coupon') AND NOT payment_required));
  END IF;
END $$;

-- Every lifecycle transition of every order — append-only evidence.
CREATE TABLE IF NOT EXISTS purchase_order_events (
  id                 bigserial PRIMARY KEY,
  purchase_order_id  uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  from_state         text,
  to_state           text NOT NULL,
  actor              text NOT NULL DEFAULT 'system',
  reason             text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_events_order ON purchase_order_events (purchase_order_id, id);
/* Order evidence is append-only: no UPDATE, and no DELETE while its order
   exists. The only removal path is the cascade from deleting the order row
   itself (the same database-level behaviour as payments and invoices; the
   application never deletes orders). */
CREATE OR REPLACE FUNCTION reject_order_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.purchase_order_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM purchase_orders WHERE id = OLD.purchase_order_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'append_only_table' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS purchase_order_events_append_only ON purchase_order_events;
CREATE TRIGGER purchase_order_events_append_only BEFORE UPDATE OR DELETE ON purchase_order_events
FOR EACH ROW EXECUTE FUNCTION reject_order_evidence_mutation();

/* Allowed transitions — the single authority (mirrored for readability in
   order-lifecycle.js and docs/payments/ORDER_LIFECYCLE.md). Actor/reason come
   from the transaction-local settings openfund.actor / openfund.reason. */
CREATE OR REPLACE FUNCTION order_transition_allowed(f text, t text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (f || '>' || t) = ANY (ARRAY[
    'awaiting_payment>payment_detected','awaiting_payment>manual_review','awaiting_payment>paid',
    'awaiting_payment>cancelled','awaiting_payment>expired',
    'payment_detected>awaiting_payment','payment_detected>manual_review','payment_detected>paid','payment_detected>expired',
    'manual_review>awaiting_payment','manual_review>paid','manual_review>cancelled','manual_review>expired',
    'expired>payment_detected','expired>manual_review','expired>paid',
    'paid>provisioned',
    'provisioned>partially_refunded','provisioned>refunded','partially_refunded>refunded'])
$$;

CREATE OR REPLACE FUNCTION purchase_order_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actor  text := coalesce(nullif(current_setting('openfund.actor', true), ''), 'system');
  reason text := nullif(current_setting('openfund.reason', true), '');
  target text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO purchase_order_events (purchase_order_id, from_state, to_state, actor, reason)
    VALUES (NEW.id, NULL, NEW.lifecycle_state, actor, coalesce(reason, 'order_created'));
    RETURN NEW;
  END IF;
  /* immutable pricing snapshot once created */
  IF NEW.price_usd IS DISTINCT FROM OLD.price_usd
     OR (OLD.list_price_usd IS NOT NULL AND NEW.list_price_usd IS DISTINCT FROM OLD.list_price_usd)
     OR NEW.discount_usd IS DISTINCT FROM OLD.discount_usd OR NEW.coupon_id IS DISTINCT FROM OLD.coupon_id
     OR NEW.payment_required IS DISTINCT FROM OLD.payment_required OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR (OLD.payment_method IS NOT NULL AND NEW.payment_method IS DISTINCT FROM OLD.payment_method) THEN
    RAISE EXCEPTION 'order_pricing_immutable' USING ERRCODE = '23514';
  END IF;
  /* legacy writers change only `status`; derive the explicit state from it */
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.lifecycle_state = OLD.lifecycle_state THEN
    NEW.lifecycle_state := CASE NEW.status WHEN 'paid' THEN 'provisioned' WHEN 'cancelled' THEN 'cancelled'
      WHEN 'expired' THEN 'expired' ELSE OLD.lifecycle_state END;
  END IF;
  IF NEW.lifecycle_state = OLD.lifecycle_state THEN RETURN NEW; END IF;
  target := NEW.lifecycle_state;
  /* payment and provisioning commit in ONE transaction: record both steps */
  IF target = 'provisioned' AND OLD.lifecycle_state <> 'paid' THEN
    IF NOT order_transition_allowed(OLD.lifecycle_state, 'paid') THEN
      RAISE EXCEPTION 'invalid_order_transition % -> paid', OLD.lifecycle_state USING ERRCODE = '23514';
    END IF;
    INSERT INTO purchase_order_events (purchase_order_id, from_state, to_state, actor, reason)
    VALUES (NEW.id, OLD.lifecycle_state, 'paid', actor, reason);
    INSERT INTO purchase_order_events (purchase_order_id, from_state, to_state, actor, reason)
    VALUES (NEW.id, 'paid', 'provisioned', actor, reason);
  ELSE
    IF NOT order_transition_allowed(OLD.lifecycle_state, target) THEN
      RAISE EXCEPTION 'invalid_order_transition % -> %', OLD.lifecycle_state, target USING ERRCODE = '23514';
    END IF;
    INSERT INTO purchase_order_events (purchase_order_id, from_state, to_state, actor, reason)
    VALUES (NEW.id, OLD.lifecycle_state, target, actor, reason);
  END IF;
  /* coarse status follows the explicit state (paid/provisioned ⇒ 'paid') */
  NEW.status := CASE WHEN target IN ('paid','provisioned','partially_refunded','refunded') THEN 'paid'
    WHEN target IN ('cancelled','expired') THEN target
    WHEN target IN ('awaiting_payment','payment_detected','manual_review') AND OLD.status = 'expired' THEN 'expired'
    ELSE 'pending' END;
  /* coupon reservation follows the order: consumed when paid, released
     when the order is cancelled or expires unpaid */
  IF target IN ('paid','provisioned') THEN
    UPDATE coupon_redemptions SET status = 'consumed', consumed_at = now() WHERE purchase_order_id = NEW.id AND status <> 'consumed';
  ELSIF target IN ('cancelled','expired') THEN
    UPDATE coupon_redemptions SET status = 'released', released_at = now() WHERE purchase_order_id = NEW.id AND status = 'reserved';
  END IF;
  RETURN NEW;
END $$;
/* inserts that predate the explicit state (or set only `status`) get a
   consistent snapshot: list price = price, state derived from status */
CREATE OR REPLACE FUNCTION purchase_order_defaults() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.list_price_usd IS NULL THEN NEW.list_price_usd := NEW.price_usd + coalesce(NEW.discount_usd, 0); END IF;
  IF NEW.status <> 'pending' AND NEW.lifecycle_state = 'awaiting_payment' THEN
    NEW.lifecycle_state := CASE NEW.status WHEN 'paid' THEN 'provisioned' ELSE NEW.status END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS purchase_order_defaults ON purchase_orders;
CREATE TRIGGER purchase_order_defaults BEFORE INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION purchase_order_defaults();
DROP TRIGGER IF EXISTS purchase_order_lifecycle_insert ON purchase_orders;
CREATE TRIGGER purchase_order_lifecycle_insert AFTER INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION purchase_order_lifecycle();
DROP TRIGGER IF EXISTS purchase_order_lifecycle_update ON purchase_orders;
CREATE TRIGGER purchase_order_lifecycle_update BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION purchase_order_lifecycle();

/* refunds/chargebacks (economy admin) move the order to a refund state; the
   payment, invoice and challenge rows are never edited */
CREATE OR REPLACE FUNCTION purchase_order_refund_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total numeric; price numeric; cur text;
BEGIN
  SELECT coalesce(sum(amount_usd), 0) INTO total FROM payment_adjustments WHERE purchase_order_id = NEW.purchase_order_id;
  SELECT price_usd, lifecycle_state INTO price, cur FROM purchase_orders WHERE id = NEW.purchase_order_id FOR UPDATE;
  PERFORM set_config('openfund.actor', NEW.recorded_by, true);
  PERFORM set_config('openfund.reason', NEW.kind || ':' || NEW.reference, true);
  IF total >= price AND cur <> 'refunded' THEN
    UPDATE purchase_orders SET lifecycle_state = 'refunded' WHERE id = NEW.purchase_order_id;
  ELSIF total < price AND cur = 'provisioned' THEN
    UPDATE purchase_orders SET lifecycle_state = 'partially_refunded' WHERE id = NEW.purchase_order_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payment_adjustments_order_state ON payment_adjustments;
CREATE TRIGGER payment_adjustments_order_state AFTER INSERT ON payment_adjustments
FOR EACH ROW EXECUTE FUNCTION purchase_order_refund_state();

-- DePay events (attempt | processing | failed | succeeded) and callbacks,
-- signature-verified. Recorded for correlation and audit; an event NEVER
-- marks an order paid (only the on-chain verifier does).
CREATE TABLE IF NOT EXISTS depay_events (
  id                 bigserial PRIMARY KEY,
  kind               text NOT NULL CHECK (kind IN ('event','callback')),
  status             text,                 -- attempt | processing | failed | succeeded | NULL (callback)
  body_sha256        text NOT NULL UNIQUE,  -- retries of the same delivery are recorded once
  blockchain         text,
  tx_hash            text,
  sender             text,
  receiver           text,
  token              text,
  amount             text,
  purchase_order_id  uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  outcome            text NOT NULL,        -- recorded | ignored:<reason> | hint_registered
  payload            jsonb NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_depay_events_tx ON depay_events (tx_hash);
CREATE INDEX IF NOT EXISTS idx_depay_events_order ON depay_events (purchase_order_id);
DROP TRIGGER IF EXISTS depay_events_append_only ON depay_events;
CREATE TRIGGER depay_events_append_only BEFORE UPDATE OR DELETE ON depay_events
FOR EACH ROW EXECUTE FUNCTION reject_order_evidence_mutation();

-- ============================================================
-- Per-wallet chart workspaces (Vela chart state).
-- Additive and idempotent. Ownership is the authenticated session's user
-- (never a browser-supplied address). One row per (user, workspace, scope):
-- scope '*' holds workspace-wide settings (timeframe, indicators, chart
-- style, renderer config, tool defaults); any other scope is one market
-- symbol's drawings. `revision` gives optimistic concurrency so a stale
-- tab can never silently overwrite a newer save. Live position overlays
-- are NOT stored here (they are rebuilt from position state).
-- ============================================================
CREATE TABLE IF NOT EXISTS chart_workspaces (
  user_id        uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  workspace      text NOT NULL CHECK (workspace ~ '^[a-z0-9_-]{1,32}$'),
  scope          text NOT NULL CHECK (scope = '*' OR scope ~ '^[A-Za-z0-9._:/-]{1,64}$'),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version BETWEEN 1 AND 1000),
  revision       bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  data           jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace, scope)
);

-- Dedicated checkout (v0.6): optional customer details captured on the order
-- for the receipt. The wallet remains the account identity. Additive only.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS customer jsonb;

-- ------------------------------------------------------------------
-- Customer support messages (public Contact Us form).
--
-- Written ONLY by the backend (POST /support/messages, validated and
-- rate limited). Directus registers this table for the Support role
-- (apps/backstage/scripts/register_support_tables.py); the public policy
-- gets no permission on it, so submissions can never be enumerated.
-- The public reference is random (not a sequence) and is the only
-- identifier returned to the submitter.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       text NOT NULL UNIQUE CHECK (reference ~ '^OF-[0-9]{6}-[A-Z2-9]{6}$'),
  full_name       text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email           text NOT NULL CHECK (char_length(email) BETWEEN 6 AND 254),
  department      text NOT NULL CHECK (department IN ('support', 'legal', 'technical', 'community')),
  subject         text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 160),
  message         text NOT NULL CHECK (char_length(message) BETWEEN 20 AND 5000),
  order_ref       text CHECK (order_ref IS NULL OR order_ref ~ '^[A-Za-z0-9_-]{1,64}$'),
  challenge_ref   text CHECK (challenge_ref IS NULL OR challenge_ref ~ '^[A-Za-z0-9_-]{1,64}$'),
  locale          text NOT NULL DEFAULT 'en' CHECK (locale IN ('fa', 'en', 'ar', 'ru', 'zh-CN')),
  status          text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  internal_notes  text,
  assigned_to     text,
  user_id         uuid REFERENCES openfund_users(id) ON DELETE SET NULL,
  privacy_consent_at timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_email ON support_messages (email, created_at DESC);

-- Append-only operator history (status changes, assignment, notes).
CREATE TABLE IF NOT EXISTS support_message_events (
  id          bigserial PRIMARY KEY,
  message_id  uuid NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  actor       text NOT NULL,
  from_status text,
  to_status   text,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_message_events_msg ON support_message_events (message_id, id);

CREATE OR REPLACE FUNCTION support_messages_touch() RETURNS trigger AS $$
BEGIN
  /* submitter-supplied content is immutable once stored; only operator
     fields (status, notes, assignment) may change, from any writer */
  IF NEW.reference IS DISTINCT FROM OLD.reference OR NEW.full_name IS DISTINCT FROM OLD.full_name
     OR NEW.email IS DISTINCT FROM OLD.email OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.subject IS DISTINCT FROM OLD.subject OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.order_ref IS DISTINCT FROM OLD.order_ref OR NEW.challenge_ref IS DISTINCT FROM OLD.challenge_ref
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.privacy_consent_at IS DISTINCT FROM OLD.privacy_consent_at THEN
    RAISE EXCEPTION 'support_message_content_immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_support_messages_touch ON support_messages;
CREATE TRIGGER trg_support_messages_touch BEFORE UPDATE ON support_messages
  FOR EACH ROW EXECUTE FUNCTION support_messages_touch();

-- ------------------------------------------------------------------
-- Reward lifecycle: final-pass manual review, funded-demo transition and
-- rule-checked reward (withdrawal) requests. See apps/backend/rewards.js.
--
-- parent_challenge_id links stage 2 → stage 1 and funded-demo → final
-- passed stage (lineage to the purchase order, e.g. for the fee refund).
-- funded_from_challenge_id is UNIQUE: one funded-demo account per passed
-- evaluation, enforced by the database (duplicate approvals impossible).
-- ------------------------------------------------------------------
ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS parent_challenge_id uuid REFERENCES openfund_challenges(id);
ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS funded_from_challenge_id uuid REFERENCES openfund_challenges(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_funded_from ON openfund_challenges (funded_from_challenge_id) WHERE funded_from_challenge_id IS NOT NULL;

-- One immutable decision per final-passed evaluation.
CREATE TABLE IF NOT EXISTS challenge_reviews (
  challenge_id        uuid PRIMARY KEY REFERENCES openfund_challenges(id),
  decision            text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  actor               text NOT NULL,
  note                text,
  funded_challenge_id uuid REFERENCES openfund_challenges(id),
  decided_at          timestamptz NOT NULL DEFAULT now()
);

-- Reward requests computed by the server (kind='reward'); rows created
-- before this release keep kind='legacy' and are reviewed as before.
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'legacy';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_kind_check') THEN
    ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_kind_check CHECK (kind IN ('legacy', 'reward'));
  END IF;
END $$;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS reward_cycle text;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS gross_profit_usd numeric(14,2);
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS split_pct numeric(6,2);
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS fee_refund_usd numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS eligibility jsonb;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS recipient_wallet text;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS payment_evidence jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_verified_hash
  ON withdrawal_requests (lower(payout_ref)) WHERE payment_evidence IS NOT NULL;

-- at most one open reward request per funded account
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_one_open_reward ON withdrawal_requests (challenge_id)
  WHERE kind = 'reward' AND status IN ('requested', 'approved');

-- ------------------------------------------------------------------
-- Owner decisions D1–D8 (rules snapshot v3). Additive only.
-- ------------------------------------------------------------------
-- D7: the purchased daily-loss variant ('reduced' is sold only when priced)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS daily_loss_variant text NOT NULL DEFAULT 'default';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_daily_loss_variant_check') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_daily_loss_variant_check CHECK (daily_loss_variant IN ('default', 'reduced'));
  END IF;
END $$;

-- D1: reward cycle chosen once on the funded account; immutable once set
ALTER TABLE openfund_challenges ADD COLUMN IF NOT EXISTS reward_cycle text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'openfund_challenges'::regclass AND conname = 'openfund_challenges_reward_cycle_check'
      AND pg_get_constraintdef(oid) LIKE '%triweekly%') THEN
    ALTER TABLE openfund_challenges DROP CONSTRAINT IF EXISTS openfund_challenges_reward_cycle_check;
    ALTER TABLE openfund_challenges ADD CONSTRAINT openfund_challenges_reward_cycle_check
      CHECK (reward_cycle IS NULL OR reward_cycle IN ('weekly', 'biweekly', 'triweekly', 'monthly', 'on_demand'));
  END IF;
END $$;
CREATE OR REPLACE FUNCTION openfund_challenges_cycle_lock() RETURNS trigger AS $$
BEGIN
  IF OLD.rules_snapshot->>'fundedPayoutVersion' = 'funded-v1' AND (
    NEW.rules_snapshot->>'fundedPayoutVersion' IS DISTINCT FROM OLD.rules_snapshot->>'fundedPayoutVersion'
    OR NEW.rules_snapshot->'rewardCycles' IS DISTINCT FROM OLD.rules_snapshot->'rewardCycles'
    OR NEW.rules_snapshot->'fundedIb' IS DISTINCT FROM OLD.rules_snapshot->'fundedIb'
  ) THEN
    RAISE EXCEPTION 'funded_payout_policy_immutable';
  END IF;
  IF OLD.reward_cycle IS NOT NULL AND NEW.reward_cycle IS DISTINCT FROM OLD.reward_cycle THEN
    RAISE EXCEPTION 'reward_cycle_immutable';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_openfund_challenges_cycle_lock ON openfund_challenges;
CREATE TRIGGER trg_openfund_challenges_cycle_lock BEFORE UPDATE OF reward_cycle, rules_snapshot ON openfund_challenges
  FOR EACH ROW EXECUTE FUNCTION openfund_challenges_cycle_lock();

-- D8: verified economic calendar. Events are imported by an operator from a
-- licensed source together with the period the import fully covers; news
-- rules are only enforced for times inside verified coverage.
CREATE TABLE IF NOT EXISTS economic_calendar_coverage (
  id           bigserial PRIMARY KEY,
  source       text NOT NULL CHECK (char_length(source) BETWEEN 2 AND 80),
  covers_from  timestamptz NOT NULL,
  covers_to    timestamptz NOT NULL CHECK (covers_to > covers_from),
  event_count  integer NOT NULL,
  actor        text NOT NULL,
  imported_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_coverage_window ON economic_calendar_coverage (covers_from, covers_to);
CREATE TABLE IF NOT EXISTS economic_events (
  id           bigserial PRIMARY KEY,
  source       text NOT NULL,
  external_id  text NOT NULL,
  title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  currency     text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  kind         text NOT NULL CHECK (kind IN ('release', 'speech')),
  impact       text NOT NULL CHECK (impact IN ('high', 'medium', 'low')),
  restricted   boolean NOT NULL DEFAULT false,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz,
  imported_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS idx_economic_events_time ON economic_events (starts_at) WHERE restricted;

-- D1/D4: strike system (on-demand cycle) — one strike per trade idea
CREATE TABLE IF NOT EXISTS challenge_strikes (
  challenge_id uuid NOT NULL REFERENCES openfund_challenges(id) ON DELETE CASCADE,
  idea_key     text NOT NULL,
  strike_no    integer NOT NULL CHECK (strike_no >= 1),
  loss_usd     numeric(14,2) NOT NULL,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, idea_key),
  UNIQUE (challenge_id, strike_no)
);

-- D5: challenge fee refund, created exactly once when the fourth reward of
-- a Standard lineage is marked paid; paid out manually like rewards.
CREATE TABLE IF NOT EXISTS fee_refunds (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  uuid NOT NULL UNIQUE REFERENCES purchase_orders(id),
  challenge_id       uuid NOT NULL REFERENCES openfund_challenges(id),
  user_id            uuid NOT NULL REFERENCES openfund_users(id),
  withdrawal_id      uuid NOT NULL UNIQUE REFERENCES withdrawal_requests(id),
  amount_usd         numeric(12,2) NOT NULL CHECK (amount_usd > 0),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payout_ref         text,
  actor              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz
);

-- Certificate identities and immutable issuance snapshots: no financial authority.
CREATE TABLE IF NOT EXISTS certificate_identities (
  user_id uuid PRIMARY KEY REFERENCES openfund_users(id),
  display_name text CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 2 AND 80),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS certificates (
  serial text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text,'-',''),
  user_id uuid NOT NULL REFERENCES openfund_users(id),
  kind text NOT NULL CHECK (kind IN ('purchase','completion','payout')),
  source_id uuid NOT NULL,
  holder text NOT NULL,
  plan text NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
  event_at timestamptz NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','revoked')),
  revoked_at timestamptz,
  UNIQUE (kind,source_id),
  CHECK ((status='revoked') = (revoked_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id,issued_at DESC);
CREATE TABLE IF NOT EXISTS certificate_events (
  id bigserial PRIMARY KEY,
  serial text NOT NULL REFERENCES certificates(serial),
  action text NOT NULL CHECK (action IN ('issued','revoked')),
  actor text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION certificate_snapshot_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'certificate_history_immutable'; END IF;
  IF (to_jsonb(NEW) - 'status' - 'revoked_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'revoked_at')
     OR OLD.status='revoked' THEN RAISE EXCEPTION 'certificate_snapshot_immutable'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_certificate_snapshot ON certificates;
CREATE TRIGGER trg_certificate_snapshot BEFORE UPDATE OR DELETE ON certificates FOR EACH ROW EXECUTE FUNCTION certificate_snapshot_guard();
CREATE OR REPLACE FUNCTION certificate_history_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'certificate_history_immutable'; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_certificate_history ON certificate_events;
CREATE TRIGGER trg_certificate_history BEFORE UPDATE OR DELETE ON certificate_events FOR EACH ROW EXECUTE FUNCTION certificate_history_guard();
-- ------------------------------------------------------------------
-- Regional runtime (ADR 0032). Additive only: no existing table changes.
--
-- runtime_region: which region owns this database. Claimed once by
-- migrate.js (OPENFUND_REGION, default GLOBAL); server.js refuses to start
-- when its own region differs, so an Iran runtime can never write to the
-- Render database. Changing the claim is a manual, reviewed DBA action.
-- runtime_mode: the region's durable operational mode, versioned by epoch.
-- runtime_mode_events: append-only audit of applied and refused transitions.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS runtime_region (
  singleton   boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  region      text NOT NULL CHECK (region IN ('GLOBAL', 'IRAN')),
  claimed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS runtime_mode (
  singleton   boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  mode        text NOT NULL CHECK (mode IN ('GLOBAL_CONNECTED', 'IRAN_ISOLATED', 'RECOVERY')),
  epoch       bigint NOT NULL CHECK (epoch >= 0),
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text NOT NULL,
  reason      text NOT NULL
);
CREATE TABLE IF NOT EXISTS runtime_mode_events (
  id          bigserial PRIMARY KEY,
  epoch       bigint NOT NULL,
  from_mode   text NOT NULL,
  to_mode     text NOT NULL,
  actor       text NOT NULL,
  reason      text NOT NULL,
  outcome     text NOT NULL CHECK (outcome IN ('applied', 'refused')),
  gates       jsonb NOT NULL DEFAULT '[]',
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION runtime_mode_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'runtime_mode_events is append-only'; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_runtime_mode_events_immutable') THEN
    CREATE TRIGGER trg_runtime_mode_events_immutable BEFORE UPDATE OR DELETE ON runtime_mode_events
      FOR EACH ROW EXECUTE FUNCTION runtime_mode_events_immutable();
  END IF;
END $$;

-- ------------------------------------------------------------------
-- Regional account authority and synchronization (ADR 0033).
-- Additive only. Existing rows are never rewritten by this block.
--
-- account_ownership: exactly one home region per trading account, with a
-- monotonically increasing epoch (fencing token). A database trigger on
-- every account-scoped financial table rejects a write unless the account
-- is owned by THIS database's region and its ownership state is 'active'.
-- The check takes a FOR SHARE lock on the ownership row, so a handoff
-- (FOR UPDATE) waits for in-flight writers, and every writer that starts
-- after the handoff is rejected: a stale worker cannot commit.
-- Rows are created automatically for every new demo account (this region)
-- and back-filled by migrate.js after the region claim.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_ownership (
  account_id      uuid PRIMARY KEY REFERENCES demo_accounts(id) ON DELETE CASCADE,
  home_region     text NOT NULL CHECK (home_region IN ('GLOBAL', 'IRAN')),
  epoch           bigint NOT NULL DEFAULT 1 CHECK (epoch >= 1),
  state           text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'fenced', 'transferred', 'quarantined')),
  reconciliation  text NOT NULL DEFAULT 'clean' CHECK (reconciliation IN ('clean', 'pending', 'discrepancy')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT 'system'
);
CREATE INDEX IF NOT EXISTS idx_account_ownership_state ON account_ownership (home_region, state);

CREATE TABLE IF NOT EXISTS account_ownership_events (
  id          bigserial PRIMARY KEY,
  account_id  uuid NOT NULL,
  epoch       bigint NOT NULL,
  action      text NOT NULL,           -- created | released | granted | transferred | quarantined | released_quarantine
  from_region text,
  to_region   text,
  actor       text NOT NULL,
  reason      text,
  detail      jsonb NOT NULL DEFAULT '{}',
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_ownership_events_account ON account_ownership_events (account_id, id);

CREATE OR REPLACE FUNCTION openfund_local_region() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT region FROM runtime_region WHERE singleton), 'GLOBAL')
$$;

/* true when this region may write the account (used by the engine loop to
   skip foreign, fenced, transferred or quarantined accounts) */
CREATE OR REPLACE FUNCTION openfund_account_writable(acc uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT o.home_region = openfund_local_region() AND o.state = 'active'
                     FROM account_ownership o WHERE o.account_id = acc), true)
$$;

CREATE OR REPLACE FUNCTION openfund_assert_account_writable(acc uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE o record;
BEGIN
  IF acc IS NULL THEN RETURN; END IF;
  /* a reviewed ownership import of exactly this account (regional-ownership.js) */
  IF current_setting('openfund.ownership_import', true) = acc::text THEN RETURN; END IF;
  SELECT home_region, state, epoch INTO o FROM account_ownership WHERE account_id = acc FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;   -- created in this transaction (ownership row follows) or pre-claim
  IF o.home_region <> openfund_local_region() OR o.state <> 'active' THEN
    RAISE EXCEPTION 'account_not_writable_in_region'
      USING DETAIL = format('account %s home_region=%s state=%s epoch=%s local=%s', acc, o.home_region, o.state, o.epoch, openfund_local_region());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION openfund_fence_account_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE col text := TG_ARGV[0]; via text := TG_ARGV[1]; ref uuid; r jsonb;
BEGIN
  FOREACH r IN ARRAY ARRAY[CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END, CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END] LOOP
    CONTINUE WHEN r IS NULL;
    ref := (r->>col)::uuid;
    CONTINUE WHEN ref IS NULL;
    IF via = 'challenge' THEN
      SELECT demo_account_id INTO ref FROM openfund_challenges WHERE id = ref;
    END IF;
    PERFORM openfund_assert_account_writable(ref);
  END LOOP;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
      ('demo_accounts', 'id', 'account', 'UPDATE OR DELETE'),
      ('openfund_challenges', 'demo_account_id', 'account', 'UPDATE OR DELETE'),
      ('trading_orders', 'account_id', 'account', 'INSERT OR UPDATE OR DELETE'),
      ('trading_positions', 'account_id', 'account', 'INSERT OR UPDATE OR DELETE'),
      ('trading_ledger', 'account_id', 'account', 'INSERT OR UPDATE OR DELETE'),
      ('trading_events', 'account_id', 'account', 'INSERT OR UPDATE OR DELETE'),
      ('account_equity_risk', 'account_id', 'account', 'INSERT OR UPDATE OR DELETE'),
      ('account_equity_samples', 'account_id', 'account', 'INSERT OR UPDATE OR DELETE'),
      ('position_close_requests', 'account_id', 'account', 'INSERT OR UPDATE OR DELETE'),
      ('challenge_events', 'challenge_id', 'challenge', 'INSERT OR UPDATE OR DELETE'),
      ('challenge_equity_days', 'challenge_id', 'challenge', 'INSERT OR UPDATE OR DELETE'),
      ('challenge_trailing', 'challenge_id', 'challenge', 'INSERT OR UPDATE OR DELETE'),
      ('challenge_strikes', 'challenge_id', 'challenge', 'INSERT OR UPDATE OR DELETE'),
      ('challenge_reviews', 'challenge_id', 'challenge', 'INSERT OR UPDATE OR DELETE'),
      ('fee_refunds', 'challenge_id', 'challenge', 'INSERT OR UPDATE OR DELETE'),
      ('withdrawal_requests', 'challenge_id', 'challenge', 'INSERT OR UPDATE OR DELETE')
    ) AS v(tbl, col, via, ops)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_region_fence_' || t.tbl) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE %s ON %I FOR EACH ROW EXECUTE FUNCTION openfund_fence_account_row(%L, %L)',
                     'trg_region_fence_' || t.tbl, t.ops, t.tbl, t.col, t.via);
    END IF;
  END LOOP;
END $$;

/* every new demo account is owned by the region whose database creates it */
CREATE OR REPLACE FUNCTION openfund_own_new_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('openfund.ownership_import', true) = NEW.id::text THEN RETURN NEW; END IF;
  INSERT INTO account_ownership (account_id, home_region) VALUES (NEW.id, openfund_local_region())
    ON CONFLICT (account_id) DO NOTHING;
  INSERT INTO account_ownership_events (account_id, epoch, action, to_region, actor)
    VALUES (NEW.id, 1, 'created', openfund_local_region(), 'system');
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_region_own_new_account') THEN
    CREATE TRIGGER trg_region_own_new_account AFTER INSERT ON demo_accounts
      FOR EACH ROW EXECUTE FUNCTION openfund_own_new_account();
  END IF;
END $$;

-- ------------------------------------------------------------------
-- Transactional outbox. Rows are written by triggers in the SAME
-- transaction as the financial change, so a committed change always has
-- its event and a rolled-back change never does. One ordered stream per
-- user (stream_seq), so a receiver applies a user's events in commit order.
-- Rows are kept until the peer acknowledges them (no time-based expiry).
-- ------------------------------------------------------------------
/* The outbox records nothing until synchronization is enabled for this
   database (migrate.js with REGION_SYNC_ENABLED=1, or the operator API), so a
   region without a peer never accumulates unacknowledged events. State that
   existed before enabling is sent by the initial state transfer (snapshot). */
CREATE TABLE IF NOT EXISTS region_sync_settings (
  singleton   boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled     boolean NOT NULL DEFAULT false,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text NOT NULL DEFAULT 'system'
);
CREATE OR REPLACE FUNCTION openfund_sync_enabled() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT enabled FROM region_sync_settings WHERE singleton), false)
$$;

CREATE TABLE IF NOT EXISTS region_stream_heads (
  stream  text PRIMARY KEY,
  seq     bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS region_outbox (
  id              bigserial PRIMARY KEY,
  event_id        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  stream          text NOT NULL,
  stream_seq      bigint NOT NULL,
  type            text NOT NULL,
  schema_version  int NOT NULL DEFAULT 1,
  account_id      uuid,
  epoch           bigint,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  acked_at        timestamptz,
  attempts        int NOT NULL DEFAULT 0,
  last_error      text,
  dead_at         timestamptz,
  UNIQUE (stream, stream_seq)
);
CREATE INDEX IF NOT EXISTS idx_region_outbox_pending ON region_outbox (id) WHERE acked_at IS NULL;

CREATE OR REPLACE FUNCTION openfund_outbox_append(p_stream text, p_type text, p_account uuid, p_payload jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s bigint; v_home text; v_epoch bigint;
BEGIN
  INSERT INTO region_stream_heads (stream, seq) VALUES (p_stream, 1)
    ON CONFLICT (stream) DO UPDATE SET seq = region_stream_heads.seq + 1 RETURNING seq INTO s;
  IF p_account IS NOT NULL THEN
    SELECT home_region, epoch INTO v_home, v_epoch FROM account_ownership WHERE account_id = p_account;
  END IF;
  INSERT INTO region_outbox (stream, stream_seq, type, account_id, epoch, payload)
    VALUES (p_stream, s, p_type, p_account, v_epoch,
            p_payload || jsonb_build_object('home_region', coalesce(v_home, openfund_local_region())));
END $$;

/* AFTER trigger: TG_ARGV = event type, account column, account resolution ('account' | 'challenge' | 'none') */
CREATE OR REPLACE FUNCTION openfund_outbox_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r jsonb := to_jsonb(NEW); acc uuid; uid uuid; wallet text;
BEGIN
  IF NOT openfund_sync_enabled() THEN RETURN NULL; END IF;
  /* applying the peer's events never echoes them back */
  IF current_setting('openfund.sync_apply', true) = '1' THEN RETURN NULL; END IF;
  IF current_setting('openfund.ownership_import', true) IS NOT NULL
     AND current_setting('openfund.ownership_import', true) <> '' THEN RETURN NULL; END IF;
  IF TG_ARGV[2] = 'account' THEN acc := (r->>TG_ARGV[1])::uuid;
  ELSIF TG_ARGV[2] = 'challenge' THEN SELECT demo_account_id INTO acc FROM openfund_challenges WHERE id = (r->>TG_ARGV[1])::uuid;
  END IF;
  IF TG_TABLE_NAME = 'openfund_users' THEN uid := NEW.id;
  ELSIF r ? 'user_id' THEN uid := (r->>'user_id')::uuid;
  ELSIF acc IS NOT NULL THEN SELECT user_id INTO uid FROM demo_accounts WHERE id = acc;
  ELSIF TG_ARGV[2] = 'challenge' THEN SELECT user_id INTO uid FROM openfund_challenges WHERE id = (r->>TG_ARGV[1])::uuid;
  END IF;
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT wallet_address INTO wallet FROM openfund_users WHERE id = uid;
  /* never replicated: avatar data (large, user-uploaded), session or auth data */
  r := r - 'avatar_url';
  PERFORM openfund_outbox_append('user:' || uid, TG_ARGV[0], acc,
    jsonb_build_object('row', r, 'wallet', wallet, 'op', lower(TG_OP), 'table', TG_TABLE_NAME));
  RETURN NULL;
END $$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
      ('openfund_users', 'user.v1', 'id', 'none', 'INSERT OR UPDATE OF wallet_address, status, display_name'),
      ('demo_accounts', 'account.v1', 'id', 'account', 'INSERT OR UPDATE'),
      ('account_ownership', 'ownership.v1', 'account_id', 'account', 'INSERT OR UPDATE'),
      ('openfund_challenges', 'challenge.v1', 'id', 'challenge', 'INSERT OR UPDATE'),
      ('challenge_events', 'challenge_event.v1', 'challenge_id', 'challenge', 'INSERT'),
      ('challenge_reviews', 'challenge_review.v1', 'challenge_id', 'challenge', 'INSERT'),
      ('trading_orders', 'order.v1', 'account_id', 'account', 'INSERT OR UPDATE'),
      ('trading_positions', 'position.v1', 'account_id', 'account', 'INSERT OR UPDATE'),
      ('trading_ledger', 'ledger.v1', 'account_id', 'account', 'INSERT'),
      ('withdrawal_requests', 'withdrawal.v1', 'challenge_id', 'challenge', 'INSERT OR UPDATE'),
      /* attestations (#118): verifiable on the other region's domains through its read model */
      ('certificates', 'certificate.v1', 'serial', 'none', 'INSERT OR UPDATE')
    ) AS v(tbl, typ, col, via, ops)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_region_outbox_' || t.tbl) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER %s ON %I FOR EACH ROW EXECUTE FUNCTION openfund_outbox_row(%L, %L, %L)',
                     'trg_region_outbox_' || t.tbl, t.ops, t.tbl, t.typ, t.col, t.via);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------
-- Inbox, checkpoints and read models of the OTHER region's data.
-- Foreign data never enters the engine's tables: it lives here, so the
-- local engine cannot see, let alone execute, a foreign-owned account.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS region_inbox (
  event_id        uuid PRIMARY KEY,
  source_region   text NOT NULL,
  stream          text NOT NULL,
  stream_seq      bigint NOT NULL,
  type            text NOT NULL,
  schema_version  int NOT NULL,
  account_id      uuid,
  epoch           bigint,
  payload         jsonb NOT NULL,
  status          text NOT NULL CHECK (status IN ('applied', 'held', 'rejected')),
  error           text,
  received_at     timestamptz NOT NULL DEFAULT now(),
  applied_at      timestamptz,
  UNIQUE (source_region, stream, stream_seq)
);
CREATE INDEX IF NOT EXISTS idx_region_inbox_held ON region_inbox (source_region, stream, stream_seq) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS idx_region_inbox_rejected ON region_inbox (received_at) WHERE status = 'rejected';

CREATE TABLE IF NOT EXISTS region_stream_checkpoints (
  source_region text NOT NULL,
  stream        text NOT NULL,
  applied_seq   bigint NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_region, stream)
);

/* latest state of each foreign entity (account, challenge, order, position,
   withdrawal, user, ownership), versioned by the source stream sequence */
CREATE TABLE IF NOT EXISTS region_remote_rows (
  source_region text NOT NULL,
  entity        text NOT NULL,
  entity_id     text NOT NULL,
  account_id    uuid,
  wallet        text,
  stream_seq    bigint NOT NULL,
  data          jsonb NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_region, entity, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_region_remote_rows_wallet ON region_remote_rows (wallet, entity);
CREATE INDEX IF NOT EXISTS idx_region_remote_rows_account ON region_remote_rows (account_id, entity);

/* append-only foreign ledger entries and challenge events */
CREATE TABLE IF NOT EXISTS region_remote_entries (
  source_region text NOT NULL,
  entity        text NOT NULL,
  entity_id     text NOT NULL,
  account_id    uuid,
  stream_seq    bigint NOT NULL,
  data          jsonb NOT NULL,
  PRIMARY KEY (source_region, entity, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_region_remote_entries_account ON region_remote_entries (account_id, entity);

CREATE TABLE IF NOT EXISTS region_sync_nonces (
  nonce       text PRIMARY KEY,
  seen_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS region_peer_status (
  peer_region      text PRIMARY KEY,
  last_attempt_at  timestamptz,
  last_success_at  timestamptz,
  last_error       text,
  peer_release     text,
  peer_protocol    int,
  compatible       boolean,
  detail           jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS region_reconciliation_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz NOT NULL DEFAULT now(),
  started_by    text NOT NULL,
  mode_epoch    bigint,
  status        text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'complete', 'failed')),
  expected      int,
  compared      int NOT NULL DEFAULT 0,
  mismatched    int NOT NULL DEFAULT 0,
  completed_at  timestamptz,
  detail        jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS region_discrepancies (
  id            bigserial PRIMARY KEY,
  run_id        uuid,
  source_region text,
  account_id    uuid,
  kind          text NOT NULL,      -- balance_mismatch | ledger_count_mismatch | ownership_conflict | stale_epoch | unauthorized_source | schema_unsupported
  detail        jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_by   text,
  resolved_at   timestamptz,
  resolution    text
);
CREATE INDEX IF NOT EXISTS idx_region_discrepancies_open ON region_discrepancies (created_at) WHERE status = 'open';

/* account handoff offers received from the owner region (ADR 0033 §handoff) */
CREATE TABLE IF NOT EXISTS region_handoff_offers (
  account_id     uuid NOT NULL,
  source_region  text NOT NULL,
  epoch          bigint NOT NULL,
  bundle         jsonb NOT NULL,
  digest         jsonb NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  received_at    timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz,
  decided_by     text,
  PRIMARY KEY (account_id, epoch)
);

-- ------------------------------------------------------------------
-- Last-known-good public CMS content per request (cms-snapshot.js). Public,
-- published data only; replaced only when the content hash changes.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cms_snapshot (
  key           text PRIMARY KEY,
  collection    text NOT NULL,
  content_type  text NOT NULL,
  body          bytea NOT NULL,
  sha256        text NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

-- Recognition starts only after an owner-approved policy is provisioned.
-- An empty registry produces no journal entries and requires no backfill.
CREATE TABLE IF NOT EXISTS revenue_allocation_policies (
  version text PRIMARY KEY,
  effective_at timestamptz NOT NULL UNIQUE,
  allocation_base text NOT NULL CHECK (allocation_base IN ('listed_price', 'verified_order_price')),
  approval_reference text NOT NULL CHECK (length(trim(approval_reference)) > 0),
  approved_by text NOT NULL CHECK (length(trim(approved_by)) > 0),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS revenue_allocation_policies_immutable ON revenue_allocation_policies;
CREATE TRIGGER revenue_allocation_policies_immutable BEFORE UPDATE OR DELETE ON revenue_allocation_policies
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE IF NOT EXISTS revenue_allocation_journal (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  payment_id uuid NOT NULL REFERENCES payments(id),
  adjustment_id uuid UNIQUE REFERENCES payment_adjustments(id),
  policy_version text NOT NULL REFERENCES revenue_allocation_policies(version),
  accounting_period date NOT NULL,
  list_price_usd numeric(20,2) NOT NULL,
  discount_usd numeric(20,2) NOT NULL,
  received_usd numeric(20,2) NOT NULL,
  provider_fee_usd numeric(20,2),
  adjustment_usd numeric(20,2) NOT NULL DEFAULT 0,
  allocation_base_usd numeric(20,2) NOT NULL,
  treasury_usd numeric(20,2) NOT NULL,
  operations_usd numeric(20,2) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (treasury_usd + operations_usd = allocation_base_usd)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_allocation_purchase
  ON revenue_allocation_journal(purchase_order_id) WHERE adjustment_id IS NULL;
DROP TRIGGER IF EXISTS revenue_allocation_journal_immutable ON revenue_allocation_journal;
CREATE TRIGGER revenue_allocation_journal_immutable BEFORE UPDATE OR DELETE ON revenue_allocation_journal
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE OR REPLACE FUNCTION recognize_revenue_allocation() RETURNS trigger AS $$
DECLARE policy revenue_allocation_policies%ROWTYPE;
DECLARE payment payments%ROWTYPE;
DECLARE base numeric(20,2);
DECLARE treasury numeric(20,2);
BEGIN
  SELECT * INTO policy FROM revenue_allocation_policies WHERE effective_at <= NEW.created_at
   ORDER BY effective_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO payment FROM payments WHERE purchase_order_id=NEW.id AND status='confirmed'
   ORDER BY verified_at, id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  base := CASE policy.allocation_base WHEN 'listed_price' THEN NEW.list_price_usd ELSE NEW.price_usd END;
  treasury := round(base * 0.59, 2);
  INSERT INTO revenue_allocation_journal
    (purchase_order_id,payment_id,policy_version,accounting_period,list_price_usd,discount_usd,received_usd,
     allocation_base_usd,treasury_usd,operations_usd)
  VALUES
    (NEW.id,payment.id,policy.version,date_trunc('month',NEW.paid_at AT TIME ZONE 'UTC')::date,
     NEW.list_price_usd,NEW.discount_usd,NEW.price_usd,base,treasury,base-treasury)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS recognize_revenue_allocation ON purchase_orders;
CREATE TRIGGER recognize_revenue_allocation AFTER UPDATE ON purchase_orders FOR EACH ROW
  WHEN (NEW.status='paid' AND NEW.payment_required AND NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL)
  EXECUTE FUNCTION recognize_revenue_allocation();

CREATE OR REPLACE FUNCTION reverse_revenue_allocation() RETURNS trigger AS $$
DECLARE original revenue_allocation_journal%ROWTYPE;
DECLARE totals record;
DECLARE fraction numeric;
DECLARE target_base numeric(20,2);
DECLARE target_treasury numeric(20,2);
DECLARE delta_base numeric(20,2);
DECLARE delta_treasury numeric(20,2);
BEGIN
  PERFORM 1 FROM purchase_orders WHERE id=NEW.purchase_order_id FOR UPDATE;
  SELECT * INTO original FROM revenue_allocation_journal
   WHERE purchase_order_id=NEW.purchase_order_id AND adjustment_id IS NULL;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT sum(adjustment_usd) AS adjustments, sum(allocation_base_usd) AS base, sum(treasury_usd) AS treasury
    INTO totals FROM revenue_allocation_journal WHERE purchase_order_id=NEW.purchase_order_id;
  fraction := greatest(0, 1 - (totals.adjustments + NEW.amount_usd) / original.received_usd);
  target_base := round(original.allocation_base_usd * fraction, 2);
  target_treasury := round(target_base * 0.59, 2);
  delta_base := target_base - totals.base;
  delta_treasury := target_treasury - totals.treasury;
  INSERT INTO revenue_allocation_journal
    (purchase_order_id,payment_id,adjustment_id,policy_version,accounting_period,list_price_usd,discount_usd,received_usd,
     adjustment_usd,allocation_base_usd,treasury_usd,operations_usd)
  VALUES
    (NEW.purchase_order_id,NEW.payment_id,NEW.id,original.policy_version,date_trunc('month',NEW.created_at AT TIME ZONE 'UTC')::date,
     original.list_price_usd,original.discount_usd,original.received_usd,NEW.amount_usd,
     delta_base,delta_treasury,delta_base-delta_treasury)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS reverse_revenue_allocation ON payment_adjustments;
CREATE TRIGGER reverse_revenue_allocation AFTER INSERT ON payment_adjustments
  FOR EACH ROW EXECUTE FUNCTION reverse_revenue_allocation();

-- A claim is durable even if a remote region loses the reply or its
-- settlement transaction rolls back. That region can retry the same claim.
CREATE TABLE IF NOT EXISTS payout_transaction_claims (
  tx_hash text PRIMARY KEY CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  request_id uuid NOT NULL UNIQUE,
  home_region text NOT NULL CHECK (home_region IN ('GLOBAL','IRAN')),
  claimed_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS payout_transaction_claims_immutable ON payout_transaction_claims;
CREATE TRIGGER payout_transaction_claims_immutable BEFORE UPDATE OR DELETE ON payout_transaction_claims
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

INSERT INTO payout_transaction_claims(tx_hash,request_id,home_region)
SELECT lower(w.payout_ref),w.id,coalesce(o.home_region,'GLOBAL')
  FROM withdrawal_requests w
  LEFT JOIN openfund_challenges c ON c.id=w.challenge_id
  LEFT JOIN account_ownership o ON o.account_id=c.demo_account_id
 WHERE openfund_local_region()='GLOBAL' AND w.payment_evidence IS NOT NULL
   AND w.payout_ref ~* '^0x[0-9a-f]{64}$'
ON CONFLICT DO NOTHING;

-- Thread events travel with the withdrawal in existing signed handoff and
-- synchronization payloads. Message bodies are visible only to participants.
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS thread_events jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS trader_read_count integer NOT NULL DEFAULT 0;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS operator_read_count integer NOT NULL DEFAULT 0;

-- The first receipt verifier supports Arbitrum DAI. Every usable policy
-- still needs an explicit owner approval, asset, chain and schedule.
CREATE TABLE IF NOT EXISTS ib_settlement_policies (
  version text PRIMARY KEY,
  chain_id integer NOT NULL CHECK (chain_id > 0),
  token_address text NOT NULL CHECK (token_address ~ '^0x[0-9a-f]{40}$'),
  waiting_days smallint NOT NULL CHECK (waiting_days BETWEEN 0 AND 365),
  approval_reference text NOT NULL CHECK (length(trim(approval_reference)) > 0),
  approved_by text NOT NULL CHECK (length(trim(approved_by)) > 0),
  effective_at timestamptz NOT NULL
);
DROP TRIGGER IF EXISTS ib_settlement_policies_immutable ON ib_settlement_policies;
CREATE TRIGGER ib_settlement_policies_immutable BEFORE UPDATE OR DELETE ON ib_settlement_policies
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS ib_settlement jsonb;

CREATE OR REPLACE FUNCTION protect_withdrawal_financial_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.kind='reward' AND OLD.eligibility IS NOT NULL
    AND NEW.eligibility IS DISTINCT FROM OLD.eligibility THEN
    RAISE EXCEPTION 'withdrawal_calculation_immutable';
  END IF;
  IF OLD.payment_evidence IS NOT NULL AND NEW.payment_evidence IS DISTINCT FROM OLD.payment_evidence THEN
    RAISE EXCEPTION 'withdrawal_payment_evidence_immutable';
  END IF;
  IF OLD.ib_settlement->>'status'='paid' AND NEW.ib_settlement IS DISTINCT FROM OLD.ib_settlement THEN
    RAISE EXCEPTION 'ib_settlement_evidence_immutable';
  END IF;
  IF NEW.thread_events IS DISTINCT FROM OLD.thread_events AND (
    jsonb_array_length(NEW.thread_events) < jsonb_array_length(OLD.thread_events) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(OLD.thread_events) WITH ORDINALITY AS old_event(value, seq)
       WHERE old_event.value IS DISTINCT FROM NEW.thread_events->((old_event.seq-1)::int)
    )
  ) THEN
    RAISE EXCEPTION 'withdrawal_thread_immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS withdrawal_financial_evidence_immutable ON withdrawal_requests;
CREATE TRIGGER withdrawal_financial_evidence_immutable BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION protect_withdrawal_financial_evidence();

-- Owner-controlled reconciliation scope. No cursor is provisioned by migration.
CREATE TABLE IF NOT EXISTS treasury_transfer_cursors (
  chain_id integer NOT NULL,
  treasury_address text NOT NULL CHECK (treasury_address ~ '^0x[0-9a-f]{40}$'),
  token_address text NOT NULL CHECK (token_address ~ '^0x[0-9a-f]{40}$'),
  next_block bigint NOT NULL CHECK (next_block > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','current','catching_up','error','unreconciled')),
  last_sync_at timestamptz,
  reconciled_block bigint,
  balance_units numeric(78,0),
  difference_units numeric(78,0),
  PRIMARY KEY (chain_id,treasury_address,token_address)
);
CREATE TABLE IF NOT EXISTS treasury_token_movements (
  chain_id integer NOT NULL,
  transaction_hash text NOT NULL CHECK (transaction_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer NOT NULL CHECK (log_index >= 0),
  treasury_address text NOT NULL,
  token_address text NOT NULL,
  block_number bigint NOT NULL,
  from_address text NOT NULL,
  to_address text NOT NULL,
  amount_units numeric(78,0) NOT NULL CHECK (amount_units >= 0),
  direction text NOT NULL CHECK (direction IN ('internal','inbound','outbound')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, transaction_hash, log_index),
  FOREIGN KEY (chain_id,treasury_address,token_address)
    REFERENCES treasury_transfer_cursors (chain_id,treasury_address,token_address)
);
DROP TRIGGER IF EXISTS treasury_token_movements_immutable ON treasury_token_movements;
CREATE TRIGGER treasury_token_movements_immutable BEFORE UPDATE OR DELETE ON treasury_token_movements
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Controlled challenge entitlements are issued exclusively by the operator API.
-- Directus commerce permissions do not include this table.
CREATE TABLE IF NOT EXISTS controlled_challenge_coupons (
  coupon_id uuid PRIMARY KEY REFERENCES coupons(id),
  profile text NOT NULL UNIQUE CHECK (profile IN ('instant', 'standard')),
  user_id uuid NOT NULL REFERENCES openfund_users(id),
  wallet_address text NOT NULL,
  challenge_plan_id uuid NOT NULL REFERENCES challenge_plans(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by text NOT NULL
);

CREATE OR REPLACE FUNCTION protect_controlled_challenge_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.rules_snapshot ? 'controlledTest' OR NEW.rules_snapshot ? 'controlledTest')
    AND NEW.rules_snapshot IS DISTINCT FROM OLD.rules_snapshot THEN
    RAISE EXCEPTION 'controlled_challenge_snapshot_immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS controlled_challenge_snapshot_immutable ON openfund_challenges;
CREATE TRIGGER controlled_challenge_snapshot_immutable BEFORE UPDATE ON openfund_challenges
  FOR EACH ROW EXECUTE FUNCTION protect_controlled_challenge_snapshot();

ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='withdrawal_simulated_settlement_check'
      AND conrelid='withdrawal_requests'::regclass) THEN
    ALTER TABLE withdrawal_requests DROP CONSTRAINT withdrawal_requests_status_check;
    ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check
      CHECK (status IN ('requested','approved','paid','rejected','cancelled','simulated_settled'));
    ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_simulated_settlement_check CHECK (
      (status <> 'simulated_settled' OR test_mode) AND
      (NOT test_mode OR (kind='reward' AND challenge_id IS NOT NULL AND status <> 'paid'
        AND payout_ref IS NULL AND payment_evidence IS NULL AND ib_settlement IS NULL AND fee_refund_usd=0))
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION protect_withdrawal_test_mode() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE is_test boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.test_mode IS DISTINCT FROM OLD.test_mode OR (OLD.test_mode AND NEW.challenge_id IS DISTINCT FROM OLD.challenge_id)
        OR (OLD.status='simulated_settled' AND NEW.status IS DISTINCT FROM OLD.status) THEN
      RAISE EXCEPTION 'withdrawal_test_classification_immutable';
    END IF;
    IF NEW.status='simulated_settled' AND OLD.status NOT IN ('approved','simulated_settled') THEN
      RAISE EXCEPTION 'withdrawal_simulated_settlement_requires_approval';
    END IF;
  ELSE
    SELECT rules_snapshot ? 'controlledTest' INTO is_test FROM openfund_challenges WHERE id=NEW.challenge_id;
    IF NEW.test_mode IS DISTINCT FROM coalesce(is_test,false) OR NEW.status='simulated_settled' THEN
      RAISE EXCEPTION 'withdrawal_test_classification_invalid';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS withdrawal_test_mode_immutable ON withdrawal_requests;
CREATE TRIGGER withdrawal_test_mode_immutable BEFORE INSERT OR UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION protect_withdrawal_test_mode();

-- ============================================================
-- Trader-visible support threads and in-app notifications
-- (additive, idempotent, non-financial; Backstage operations)
-- ============================================================

-- Support correspondence modeled on withdrawal_requests.thread_events:
-- an append-only JSONB event list plus per-side read cursors.
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS thread_events jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS operator_read_count integer NOT NULL DEFAULT 0;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS trader_read_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_support_messages_user ON support_messages (user_id, created_at DESC);

-- In-app notifications: additive operational records (no financial writes).
-- dedupe_key makes every emitter idempotent (ON CONFLICT DO NOTHING), so the
-- challenge-event relay and operator decisions can never double-notify.
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES openfund_users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN (
                'payout_approved', 'payout_rejected', 'payout_paid', 'payout_simulated',
                'support_reply', 'challenge_passed', 'challenge_failed', 'challenge_expired', 'challenge_stage_passed')),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key  text UNIQUE,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Kind list grows additively; the named constraint is replaced idempotently.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'payout_approved', 'payout_rejected', 'payout_paid', 'payout_simulated',
  'support_reply', 'challenge_passed', 'challenge_failed', 'challenge_expired', 'challenge_stage_passed',
  'purchase_paid', 'tournament_registered', 'tournament_started'));
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id) WHERE read_at IS NULL;

-- Cursor of the challenge-event relay (single row; the relay reads
-- challenge_events, it never touches engine or evaluation state).
CREATE TABLE IF NOT EXISTS notification_relay_state (
  relay       text PRIMARY KEY,
  last_event  bigint NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- Campaign and announcement counters (campaigns.js). Content lives in
-- Directus (site_campaigns); this table holds anonymous daily counts only:
-- no IP address, wallet, user id or user agent. Additive and idempotent.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_daily_stats (
  campaign_id  text NOT NULL CHECK (campaign_id ~ '^[0-9a-fA-F-]{1,36}$'),
  placement    text NOT NULL CHECK (placement IN ('modal', 'announcement_bar')),
  day          date NOT NULL,
  impressions  integer NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks       integer NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  closes       integer NOT NULL DEFAULT 0 CHECK (closes >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, placement, day)
);

-- ==================================================================
-- Openfund Pay — first-party payment ledger (ADR 0046,
-- docs/payments/OPENFUND_PAY.md). Additive and idempotent.
--
--  payment_settings          runtime on/off per payment method (audited)
--  payment_intents           server-authoritative direct-wallet transfer
--                            requests (frozen remaining amount, chain, token)
--  payment_transactions      every inbound treasury transaction Openfund
--                            knows about (customer-submitted, DePay-attested
--                            or discovered by the watcher), matched or not
--  payment_allocations       how much of one transaction settles one order
--                            (kind order), is excess (kind excess) or is
--                            returned without an order (kind refund);
--                            append-only, never above the transaction value
--  payment_refund_liabilities money owed back (excess, late, unmatched);
--                            refunds are executed outside Openfund and only
--                            recorded here after review and approval
--  payment_events            append-only payment timeline
--  payment_monitor_cursors   watcher progress + single-owner lease per chain
--
-- Settlement valuation: approved USD stablecoins at 1:1, measured in
-- micro-USD (bigint, 6 decimals). Raw token units are kept separately.
-- ==================================================================

/* partially paid orders: a confirmed allocation below the order total */
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS partial_deadline_at timestamptz;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_lifecycle_state_check'
                   AND pg_get_constraintdef(oid) LIKE '%partially_paid%') THEN
    ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_lifecycle_state_check;
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_lifecycle_state_check CHECK (lifecycle_state IN
      ('awaiting_payment','payment_detected','partially_paid','manual_review','paid','provisioned','cancelled','expired','partially_refunded','refunded'));
  END IF;
END $$;
CREATE OR REPLACE FUNCTION order_transition_allowed(f text, t text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (f || '>' || t) = ANY (ARRAY[
    'awaiting_payment>payment_detected','awaiting_payment>manual_review','awaiting_payment>paid',
    'awaiting_payment>cancelled','awaiting_payment>expired','awaiting_payment>partially_paid',
    'payment_detected>awaiting_payment','payment_detected>manual_review','payment_detected>paid','payment_detected>expired',
    'payment_detected>partially_paid',
    'partially_paid>paid','partially_paid>manual_review',
    'manual_review>awaiting_payment','manual_review>paid','manual_review>cancelled','manual_review>expired','manual_review>partially_paid',
    'expired>payment_detected','expired>manual_review','expired>paid','expired>partially_paid',
    'paid>provisioned',
    'provisioned>partially_refunded','provisioned>refunded','partially_refunded>refunded'])
$$;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_partial ON purchase_orders (partial_deadline_at) WHERE lifecycle_state = 'partially_paid';

/* payments.amount holds token BASE UNITS: an 18-decimal stablecoin (e.g.
   BNB Chain USDT) above ~$100 overflowed numeric(38,18). Widen once. */
DO $$ BEGIN
  IF (SELECT numeric_precision FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='payments' AND column_name='amount') < 78 THEN
    ALTER TABLE payments ALTER COLUMN amount TYPE numeric(78,18);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payment_settings (
  method      text PRIMARY KEY CHECK (method IN ('wallet','manual','depay')),
  enabled     boolean NOT NULL,
  reason      text,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  uuid NOT NULL REFERENCES purchase_orders(id),
  user_id            uuid NOT NULL REFERENCES openfund_users(id),
  method             text NOT NULL DEFAULT 'wallet' CHECK (method IN ('wallet','manual')),
  chain_id           integer NOT NULL,
  token_address      text NOT NULL,
  token_decimals     integer NOT NULL CHECK (token_decimals BETWEEN 0 AND 36),
  receiver           text NOT NULL,
  amount_units       numeric(78,0) NOT NULL CHECK (amount_units > 0),
  usd_micros         bigint NOT NULL CHECK (usd_micros > 0),
  payer_address      text NOT NULL,
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open','submitted','superseded','expired')),
  tx_hash            text,
  submitted_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents (purchase_order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_tx ON payment_intents (chain_id, tx_hash) WHERE tx_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id           integer NOT NULL,
  tx_hash            text NOT NULL,
  token_address      text,
  token_decimals     integer,
  from_address       text,
  to_address         text,
  amount_units       numeric(78,0),            -- verified (or, while observed, watcher-seen) units
  usd_micros         bigint,                   -- settlement valuation (1:1 USD stablecoin)
  block_number       bigint,
  block_hash         text,
  block_time         timestamptz,
  confirmations      integer,
  status             text NOT NULL DEFAULT 'observed'
                     CHECK (status IN ('observed','pending','verified','rejected','reorged')),
  verification_code  text,                     -- last verifier outcome code
  source             text NOT NULL CHECK (source IN ('watcher','wallet','manual','depay','operator','recovery','legacy')),
  match_status       text NOT NULL DEFAULT 'unmatched'
                     CHECK (match_status IN ('unmatched','matched','ambiguous','ignored')),
  match_method       text CHECK (match_method IN ('intent','attempt','depay_attested','sender_unique','memo','operator','customer')),
  purchase_order_id  uuid REFERENCES purchase_orders(id),
  matched_by         text,
  matched_at         timestamptz,
  review_status      text NOT NULL DEFAULT 'none' CHECK (review_status IN ('none','open','resolved')),
  review_note        text,
  detail             jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  verified_at        timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_transactions_tx_unique UNIQUE (chain_id, tx_hash),
  CONSTRAINT payment_transactions_match_check CHECK ((match_status = 'matched') = (purchase_order_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order ON payment_transactions (purchase_order_id) WHERE purchase_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_tx_queue ON payment_transactions (match_status, review_status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_from ON payment_transactions (from_address);
/* the order of a transaction is set once; it never moves to another order */
CREATE OR REPLACE FUNCTION payment_transaction_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.purchase_order_id IS NOT NULL AND NEW.purchase_order_id IS DISTINCT FROM OLD.purchase_order_id THEN
    RAISE EXCEPTION 'payment_transaction_order_immutable' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_allocations WHERE transaction_id = OLD.id)
     AND (NEW.amount_units IS DISTINCT FROM OLD.amount_units OR NEW.usd_micros IS DISTINCT FROM OLD.usd_micros
          OR NEW.token_address IS DISTINCT FROM OLD.token_address OR NEW.chain_id IS DISTINCT FROM OLD.chain_id) THEN
    RAISE EXCEPTION 'payment_transaction_settled_immutable' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS payment_allocations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id     uuid NOT NULL REFERENCES payment_transactions(id),
  purchase_order_id  uuid REFERENCES purchase_orders(id),
  kind               text NOT NULL CHECK (kind IN ('order','excess','refund')),
  usd_micros         bigint NOT NULL CHECK (usd_micros > 0),
  amount_units       numeric(78,0) NOT NULL CHECK (amount_units > 0),
  payment_id         uuid REFERENCES payments(id),
  created_by         text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_once UNIQUE (transaction_id, kind),
  CONSTRAINT payment_allocations_order_kind CHECK (kind = 'refund' OR purchase_order_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_order ON payment_allocations (purchase_order_id, kind);
/* an allocation belongs to the transaction's order and never exceeds the
   transaction's verified value (double counting is a database error) */
CREATE OR REPLACE FUNCTION payment_allocation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tx payment_transactions%ROWTYPE; used_micros bigint; used_units numeric;
BEGIN
  SELECT * INTO tx FROM payment_transactions WHERE id = NEW.transaction_id FOR UPDATE;
  IF tx.status <> 'verified' OR tx.usd_micros IS NULL THEN RAISE EXCEPTION 'allocation_unverified_transaction' USING ERRCODE = '23514'; END IF;
  IF NEW.purchase_order_id IS NOT NULL AND NEW.purchase_order_id IS DISTINCT FROM tx.purchase_order_id THEN
    RAISE EXCEPTION 'allocation_order_mismatch' USING ERRCODE = '23514';
  END IF;
  SELECT coalesce(sum(usd_micros),0), coalesce(sum(amount_units),0) INTO used_micros, used_units
    FROM payment_allocations WHERE transaction_id = NEW.transaction_id;
  IF used_micros + NEW.usd_micros > tx.usd_micros OR used_units + NEW.amount_units > tx.amount_units THEN
    RAISE EXCEPTION 'allocation_exceeds_transaction' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payment_allocation_guard ON payment_allocations;
CREATE TRIGGER payment_allocation_guard BEFORE INSERT ON payment_allocations FOR EACH ROW EXECUTE FUNCTION payment_allocation_guard();
DROP TRIGGER IF EXISTS payment_allocations_append_only ON payment_allocations;
CREATE TRIGGER payment_allocations_append_only BEFORE UPDATE OR DELETE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION reject_mutation();
DROP TRIGGER IF EXISTS payment_transaction_guard ON payment_transactions;
CREATE TRIGGER payment_transaction_guard BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION payment_transaction_guard();

CREATE TABLE IF NOT EXISTS payment_refund_liabilities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id      uuid NOT NULL UNIQUE REFERENCES payment_allocations(id),
  transaction_id     uuid NOT NULL REFERENCES payment_transactions(id),
  purchase_order_id  uuid REFERENCES purchase_orders(id),
  reason             text NOT NULL CHECK (reason IN ('overpayment','duplicate_payment','late_payment','order_cancelled','unmatched','operator')),
  usd_micros         bigint NOT NULL CHECK (usd_micros > 0),
  amount_units       numeric(78,0) NOT NULL CHECK (amount_units > 0),
  chain_id           integer NOT NULL,
  token_address      text,
  destination        text NOT NULL,            -- the verified original payer
  status             text NOT NULL DEFAULT 'refund_due' CHECK (status IN
                     ('refund_due','refund_review','refund_approved','refund_sent','refund_confirmed','refund_rejected','refund_failed')),
  reviewed_by        text,
  approved_by        text,
  sent_by            text,
  confirmed_by       text,
  refund_chain_id    integer,
  refund_tx_hash     text,
  decision_note      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refund_liabilities_status ON payment_refund_liabilities (status);
CREATE INDEX IF NOT EXISTS idx_refund_liabilities_order ON payment_refund_liabilities (purchase_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_liabilities_tx ON payment_refund_liabilities (refund_chain_id, refund_tx_hash) WHERE refund_tx_hash IS NOT NULL;
CREATE OR REPLACE FUNCTION refund_transition_allowed(f text, t text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (f || '>' || t) = ANY (ARRAY[
    'refund_due>refund_review','refund_due>refund_rejected',
    'refund_review>refund_approved','refund_review>refund_rejected','refund_review>refund_due',
    'refund_approved>refund_sent','refund_approved>refund_rejected',
    'refund_sent>refund_confirmed','refund_sent>refund_failed',
    'refund_failed>refund_review'])
$$;
CREATE OR REPLACE FUNCTION refund_liability_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.usd_micros IS DISTINCT FROM OLD.usd_micros OR NEW.amount_units IS DISTINCT FROM OLD.amount_units
     OR NEW.destination IS DISTINCT FROM OLD.destination OR NEW.allocation_id IS DISTINCT FROM OLD.allocation_id
     OR NEW.chain_id IS DISTINCT FROM OLD.chain_id OR NEW.token_address IS DISTINCT FROM OLD.token_address THEN
    RAISE EXCEPTION 'refund_liability_immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.refund_tx_hash IS NOT NULL AND NEW.refund_tx_hash IS DISTINCT FROM OLD.refund_tx_hash AND OLD.status <> 'refund_failed' THEN
    RAISE EXCEPTION 'refund_tx_immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT refund_transition_allowed(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'invalid_refund_transition % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS refund_liability_guard ON payment_refund_liabilities;
CREATE TRIGGER refund_liability_guard BEFORE UPDATE ON payment_refund_liabilities FOR EACH ROW EXECUTE FUNCTION refund_liability_guard();
DROP TRIGGER IF EXISTS refund_liability_no_delete ON payment_refund_liabilities;
CREATE TRIGGER refund_liability_no_delete BEFORE DELETE ON payment_refund_liabilities FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE IF NOT EXISTS payment_events (
  id                 bigserial PRIMARY KEY,
  purchase_order_id  uuid,
  transaction_id     uuid,
  liability_id       uuid,
  attempt_id         uuid,
  kind               text NOT NULL,
  actor              text NOT NULL DEFAULT 'system',
  detail             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events (purchase_order_id, id);
CREATE INDEX IF NOT EXISTS idx_payment_events_tx ON payment_events (transaction_id, id);
/* the 15- and 20-minute status escalations are recorded once per attempt */
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_escalation ON payment_events (attempt_id, kind)
  WHERE kind IN ('status_delayed','escalated_review') AND attempt_id IS NOT NULL;
DROP TRIGGER IF EXISTS payment_events_append_only ON payment_events;
CREATE TRIGGER payment_events_append_only BEFORE UPDATE OR DELETE ON payment_events FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE IF NOT EXISTS payment_monitor_cursors (
  chain_id         integer NOT NULL,
  receiver         text NOT NULL,
  token_address    text NOT NULL,
  last_block       bigint,                    -- EVM: last fully scanned block
  last_signature   text,                      -- Solana: newest processed signature
  lease_owner      text,
  lease_until      timestamptz,
  last_success_at  timestamptz,
  last_error       text,
  last_error_at    timestamptz,
  head_block       bigint,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, receiver, token_address)
);

-- ==================================================================
-- Backstage operations (2026-11-22): plan administration history,
-- internal user notes and tags, and granted entitlements.
--   * plan_catalog_history: append-only record of every plan publication,
--     retirement and reactivation from Backstage, with the previous and the
--     new configuration, the catalog version, the named actor and reason.
--     Existing challenges keep their frozen rules_snapshot.
--   * user_admin_notes: append-only internal notes (never shown to users).
--   * user_admin_tags: a small set of operator tags per user.
--   * granted_entitlements: a single-use 100% coupon issued by an operator
--     (admin), a tournament award or a migration approval, bound to one
--     wallet, plan and size. start_stage 0 provisions a funded-stage account
--     (migration, funded award); 1 is a normal evaluation.
-- Additive and idempotent.
-- ==================================================================
CREATE TABLE IF NOT EXISTS plan_catalog_history (
  id               bigserial PRIMARY KEY,
  plan_slug        text NOT NULL,
  action           text NOT NULL CHECK (action IN ('publish','retire','reactivate')),
  catalog_version  integer NOT NULL,
  name             text NOT NULL,
  previous         jsonb,
  configuration    jsonb NOT NULL,
  actor            text NOT NULL,
  reason           text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_catalog_history_slug ON plan_catalog_history (plan_slug, id DESC);
DROP TRIGGER IF EXISTS plan_catalog_history_append_only ON plan_catalog_history;
CREATE TRIGGER plan_catalog_history_append_only BEFORE UPDATE OR DELETE ON plan_catalog_history FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE IF NOT EXISTS user_admin_notes (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES openfund_users (id) ON DELETE CASCADE,
  note        text NOT NULL CHECK (length(note) BETWEEN 1 AND 2000),
  actor       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_admin_notes_user ON user_admin_notes (user_id, id DESC);
DROP TRIGGER IF EXISTS user_admin_notes_append_only ON user_admin_notes;
CREATE TRIGGER user_admin_notes_append_only BEFORE UPDATE ON user_admin_notes FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE IF NOT EXISTS user_admin_tags (
  user_id     uuid NOT NULL REFERENCES openfund_users (id) ON DELETE CASCADE,
  tag         text NOT NULL CHECK (tag ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  actor       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag)
);

CREATE TABLE IF NOT EXISTS granted_entitlements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id          uuid NOT NULL UNIQUE REFERENCES coupons (id),
  user_id            uuid NOT NULL REFERENCES openfund_users (id),
  challenge_plan_id  uuid NOT NULL REFERENCES challenge_plans (id),
  account_size_usd   numeric(20,2) NOT NULL CHECK (account_size_usd > 0),
  start_stage        smallint NOT NULL DEFAULT 1 CHECK (start_stage IN (0, 1)),
  source             text NOT NULL CHECK (source IN ('admin','tournament','migration')),
  reference          text,
  reason             text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  issued_by          text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_granted_entitlements_user ON granted_entitlements (user_id, created_at DESC);

-- ==================================================================
-- Openfund Premium League (tournament.js, ADR 0050). Additive.
--   tournaments              one row per competition; rules are data
--   tournament_registrations one entry per wallet and per e-mail
--   tournament_email_codes   hashed one-time codes (never the code itself)
--   tournament_snapshots     server-side equity samples (leaderboard, drawdown)
--   tournament_standings     the frozen final ranking (append-only)
--   tournament_awards        cash, account, hardware, coupon and badge awards
--                            with a fulfilment status; nothing is deleted
-- ==================================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  name_fa            text NOT NULL,
  name_en            text NOT NULL,
  status             text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','registration','live','finished','finalized','cancelled')),
  starts_at          timestamptz NOT NULL,
  trading_days       integer NOT NULL CHECK (trading_days BETWEEN 1 AND 120),
  ends_at            timestamptz NOT NULL,
  account_size_usd   numeric(20,2) NOT NULL DEFAULT 125000 CHECK (account_size_usd > 0),
  daily_loss_pct     numeric(6,3) NOT NULL DEFAULT 5 CHECK (daily_loss_pct > 0 AND daily_loss_pct < 100),
  max_loss_pct       numeric(6,3) NOT NULL DEFAULT 10 CHECK (max_loss_pct > 0 AND max_loss_pct < 100),
  consistency_pct    numeric(6,3) NOT NULL DEFAULT 35 CHECK (consistency_pct > 0 AND consistency_pct <= 100),
  prizes             jsonb NOT NULL DEFAULT '{}'::jsonb,
  terms_doc_type     text NOT NULL DEFAULT 'tournament-terms',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS tournament_registrations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id          uuid NOT NULL REFERENCES tournaments (id),
  user_id                uuid NOT NULL REFERENCES openfund_users (id),
  wallet_address         text NOT NULL,
  email                  text NOT NULL CHECK (length(email) BETWEEN 6 AND 254),
  email_verified_at      timestamptz,
  nickname               text CHECK (nickname IS NULL OR length(nickname) BETWEEN 3 AND 24),
  status                 text NOT NULL DEFAULT 'pending_email'
                         CHECK (status IN ('pending_email','registered','active','out_of_ranking','disqualified','withdrawn')),
  terms_version          text NOT NULL,
  terms_accepted_at      timestamptz NOT NULL DEFAULT now(),
  registration_ip_prefix text,
  challenge_id           uuid REFERENCES openfund_challenges (id),
  out_of_ranking_at      timestamptz,
  out_of_ranking_rule    text,
  disqualified_reason    text,
  disqualified_by        text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_registrations_email ON tournament_registrations (tournament_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_registrations_challenge ON tournament_registrations (challenge_id) WHERE challenge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_status ON tournament_registrations (tournament_id, status);

CREATE TABLE IF NOT EXISTS tournament_email_codes (
  id               bigserial PRIMARY KEY,
  registration_id  uuid NOT NULL REFERENCES tournament_registrations (id) ON DELETE CASCADE,
  code_hash        text NOT NULL,
  expires_at       timestamptz NOT NULL,
  attempts         integer NOT NULL DEFAULT 0,
  consumed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tournament_email_codes_registration ON tournament_email_codes (registration_id, id DESC);

CREATE TABLE IF NOT EXISTS tournament_snapshots (
  id               bigserial PRIMARY KEY,
  tournament_id    uuid NOT NULL REFERENCES tournaments (id),
  registration_id  uuid NOT NULL REFERENCES tournament_registrations (id),
  equity           numeric(20,2) NOT NULL,
  balance          numeric(20,2) NOT NULL,
  observed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tournament_snapshots_reg ON tournament_snapshots (registration_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS tournament_standings (
  tournament_id     uuid NOT NULL REFERENCES tournaments (id),
  registration_id   uuid NOT NULL REFERENCES tournament_registrations (id),
  rank              integer,
  ranked            boolean NOT NULL,
  not_ranked_reason text,
  final_equity      numeric(20,2) NOT NULL,
  max_drawdown_usd  numeric(20,2) NOT NULL,
  reached_at        timestamptz,
  best_day_share    numeric(8,4),
  closed_trades     integer NOT NULL,
  frozen_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, registration_id),
  CHECK ((rank IS NOT NULL) = ranked)
);
DROP TRIGGER IF EXISTS tournament_standings_append_only ON tournament_standings;
CREATE TRIGGER tournament_standings_append_only BEFORE UPDATE OR DELETE ON tournament_standings FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE IF NOT EXISTS tournament_awards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id     uuid NOT NULL REFERENCES tournaments (id),
  registration_id   uuid NOT NULL REFERENCES tournament_registrations (id),
  rank              integer,
  kind              text NOT NULL CHECK (kind IN ('cash','account','hardware','coupon','badge')),
  item              text NOT NULL,
  amount_usd        numeric(20,2),
  entitlement_id    uuid REFERENCES granted_entitlements (id),
  coupon_id         uuid REFERENCES coupons (id),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','issued','in_progress','fulfilled','cancelled')),
  fulfilment_note   text,
  updated_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, registration_id, kind, item)
);

-- tournament certificates (badges on certificates)
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_kind_check;
ALTER TABLE certificates ADD CONSTRAINT certificates_kind_check CHECK (kind IN ('purchase','completion','payout','tournament'));

-- ==================================================================
-- Migration to Openfund (migration.js, ADR 0051). Additive.
--   migration_firms     editable list of recognised prop firms (names only)
--   migration_settings  singleton: proof rules, eligible plans, retention
--   migration_requests  one trader's request (one approved migration per person)
--   migration_evidence  evidence items; files live in private storage only
--   migration_events    append-only audit of every request step
--   migration_passes    single-use, wallet-bound pass issued on approval;
--                       a normal-price order that carries it starts funded
-- ==================================================================
CREATE TABLE IF NOT EXISTS migration_firms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE CHECK (length(name) BETWEEN 2 AND 60),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO migration_firms (name, sort) VALUES ('FTMO', 1), ('FundingPips', 2), ('FundedNext', 3), ('E8 Markets', 4)
  ON CONFLICT (name) DO NOTHING;
/* firm details shown on /migrate (owner update 2026-11-23): official site,
   accepted program types, the evidence the firm provides, and an optional
   logo uploaded by the owner in Backstage (never downloaded or recreated) */
ALTER TABLE migration_firms ADD COLUMN IF NOT EXISTS website_url text CHECK (website_url IS NULL OR (length(website_url) <= 200 AND website_url ~ '^https://'));
ALTER TABLE migration_firms ADD COLUMN IF NOT EXISTS program_types jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(program_types) = 'array');
ALTER TABLE migration_firms ADD COLUMN IF NOT EXISTS evidence_types jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(evidence_types) = 'array');
ALTER TABLE migration_firms ADD COLUMN IF NOT EXISTS logo bytea CHECK (logo IS NULL OR octet_length(logo) <= 204800);
ALTER TABLE migration_firms ADD COLUMN IF NOT EXISTS logo_type text CHECK (logo_type IS NULL OR logo_type IN ('image/png','image/jpeg','image/webp'));
ALTER TABLE migration_firms ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz;
/* seed values fill empty fields only, so owner edits are never overwritten */
UPDATE migration_firms f SET website_url = v.site FROM (VALUES ('FTMO','https://ftmo.com'), ('FundingPips','https://fundingpips.com'),
  ('FundedNext','https://fundednext.com'), ('E8 Markets','https://e8markets.com')) AS v(name, site) WHERE f.name = v.name AND f.website_url IS NULL;
UPDATE migration_firms SET program_types = '["Funded account after an evaluation"]' WHERE program_types = '[]' AND name IN ('FTMO','FundingPips','FundedNext','E8 Markets');
UPDATE migration_firms SET evidence_types = '["Payout certificate with a verification link","Payout history in the trader dashboard"]' WHERE evidence_types = '[]' AND name IN ('FTMO','FundingPips','FundedNext','E8 Markets');

CREATE TABLE IF NOT EXISTS migration_settings (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  min_payouts         integer NOT NULL DEFAULT 3 CHECK (min_payouts BETWEEN 1 AND 20),
  window_months       integer NOT NULL DEFAULT 12 CHECK (window_months BETWEEN 1 AND 36),
  plans               jsonb NOT NULL DEFAULT '["standard","one-phase"]' CHECK (jsonb_typeof(plans) = 'array'),
  retention_days      integer NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 7 AND 365),
  pass_expires_days   integer NOT NULL DEFAULT 30 CHECK (pass_expires_days BETWEEN 1 AND 180),
  updated_by          text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
INSERT INTO migration_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS migration_requests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES openfund_users (id),
  firm_id                uuid NOT NULL REFERENCES migration_firms (id),
  status                 text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','withdrawn')),
  claimed_max_size_usd   numeric(20,2) NOT NULL CHECK (claimed_max_size_usd > 0),
  approved_max_size_usd  numeric(20,2) CHECK (approved_max_size_usd IS NULL OR approved_max_size_usd > 0),
  full_name              text CHECK (full_name IS NULL OR length(full_name) BETWEEN 2 AND 120),
  kyc_verified           boolean NOT NULL DEFAULT false,
  name_matched           boolean NOT NULL DEFAULT false,
  decision_reason        text,
  decided_by             text,
  decided_at             timestamptz,
  files_purge_after      timestamptz,
  files_purged_at        timestamptz,
  submitted_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
/* one open or approved request per person; a rejected trader may apply again */
ALTER TABLE migration_requests ADD COLUMN IF NOT EXISTS contact_email text CHECK (contact_email IS NULL OR (length(contact_email) <= 254 AND contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_migration_requests_user_open ON migration_requests (user_id) WHERE status IN ('draft','submitted','approved');
CREATE INDEX IF NOT EXISTS idx_migration_requests_queue ON migration_requests (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_migration_requests_purge ON migration_requests (files_purge_after) WHERE files_purged_at IS NULL AND files_purge_after IS NOT NULL;

CREATE TABLE IF NOT EXISTS migration_evidence (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid NOT NULL REFERENCES migration_requests (id),
  kind           text NOT NULL CHECK (kind IN ('identity','funded_account','payout_certificate','payout_tx','statement','recording')),
  payout_date    date,
  amount_usd     numeric(20,2) CHECK (amount_usd IS NULL OR amount_usd > 0),
  url            text CHECK (url IS NULL OR (length(url) <= 500 AND url ~ '^https://')),
  chain_id       integer,
  tx_hash        text CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'),
  object_key     text,
  content_type   text,
  size_bytes     integer,
  sha256         text,
  verification   jsonb,
  note           text CHECK (note IS NULL OR length(note) <= 500),
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_migration_evidence_request ON migration_evidence (request_id, created_at);

CREATE TABLE IF NOT EXISTS migration_events (
  id          bigserial PRIMARY KEY,
  request_id  uuid NOT NULL REFERENCES migration_requests (id),
  actor       text NOT NULL,
  action      text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_migration_events_request ON migration_events (request_id, id);
DROP TRIGGER IF EXISTS migration_events_append_only ON migration_events;
CREATE TRIGGER migration_events_append_only BEFORE UPDATE OR DELETE ON migration_events FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE IF NOT EXISTS migration_passes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL UNIQUE REFERENCES migration_requests (id),
  user_id       uuid NOT NULL REFERENCES openfund_users (id),
  plans         jsonb NOT NULL CHECK (jsonb_typeof(plans) = 'array'),
  max_size_usd  numeric(20,2) NOT NULL CHECK (max_size_usd > 0),
  status        text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','redeemed','revoked')),
  expires_at    timestamptz NOT NULL,
  purchase_order_id uuid UNIQUE,
  redeemed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_migration_passes_user ON migration_passes (user_id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS migration_pass_id uuid REFERENCES migration_passes (id);
/* a pass backs at most one live order at a time */
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_orders_migration_pass ON purchase_orders (migration_pass_id)
  WHERE migration_pass_id IS NOT NULL AND status IN ('pending','paid');

-- ============================================================
-- Terminal Funding tab (item G). Gains publishes no funding history, so
-- the backend samples the funding block of the documented /markets list
-- once per hour (market-funding.js sampleFunding). Kept for 400 days.
-- Market data only: no user or account columns.
-- ============================================================
CREATE TABLE IF NOT EXISTS market_funding_samples (
  market                text        NOT NULL CHECK (length(market) BETWEEN 3 AND 33),
  sampled_at            timestamptz NOT NULL,
  funding_long_hourly   numeric     NOT NULL,
  funding_short_hourly  numeric     NOT NULL,
  borrowing_hourly      numeric,
  oi_long_usd           numeric,
  oi_short_usd          numeric,
  PRIMARY KEY (market, sampled_at)
);
CREATE INDEX IF NOT EXISTS idx_market_funding_samples_time ON market_funding_samples (sampled_at);

-- ==================================================================
-- Funded-trader agreement (funded-agreement.js, ADR 0054). Additive.
-- One signed acceptance per funded account: the wallet signs a fixed message
-- naming the terms version, the account and the wallet. Append-only.
-- ==================================================================
CREATE TABLE IF NOT EXISTS funded_agreements (
  id              bigserial PRIMARY KEY,
  challenge_id    uuid NOT NULL UNIQUE REFERENCES openfund_challenges (id),
  user_id         uuid NOT NULL REFERENCES openfund_users (id),
  wallet_address  text NOT NULL CHECK (wallet_address = lower(wallet_address)),
  terms_version   text NOT NULL CHECK (length(terms_version) BETWEEN 1 AND 40),
  message         text NOT NULL CHECK (length(message) <= 2000),
  signature       text NOT NULL CHECK (signature ~ '^0x[0-9a-fA-F]+$'),
  signed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funded_agreements_user ON funded_agreements (user_id, signed_at DESC);
DROP TRIGGER IF EXISTS funded_agreements_append_only ON funded_agreements;
CREATE TRIGGER funded_agreements_append_only BEFORE UPDATE OR DELETE ON funded_agreements FOR EACH ROW EXECUTE FUNCTION reject_mutation();
