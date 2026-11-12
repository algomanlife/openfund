-- ============================================================
-- Footprint market data (Hyperliquid executed trades, chart analytics only).
-- Additive and idempotent. Deliberately self-contained: no foreign keys to
-- users, accounts, positions or payments, so it can live in the main database
-- or in a dedicated FOOTPRINT_DATABASE_URL without any coupling.
--   footprint_minutes  one row per (coin, UTC minute): exact per-price-level
--                      aggressor volume. levels = [[pu, bidLots, askLots,
--                      bidCount, askCount], …]; pu = price × 10^price_decimals,
--                      lots = size × 10^size_decimals.
--   footprint_gaps     intervals with no verified coverage (service restart,
--                      upstream reconnect). Never back-filled with synthetic data.
-- ============================================================
CREATE TABLE IF NOT EXISTS footprint_minutes (
  coin            text    NOT NULL CHECK (coin ~ '^[A-Za-z0-9:_-]{1,32}$'),
  minute          bigint  NOT NULL CHECK (minute > 0 AND minute % 60000 = 0),
  price_decimals  smallint NOT NULL CHECK (price_decimals BETWEEN 0 AND 8),
  size_decimals   smallint NOT NULL CHECK (size_decimals BETWEEN 0 AND 8),
  levels          jsonb   NOT NULL CHECK (jsonb_typeof(levels) = 'array'),
  last_pu         bigint  NOT NULL,
  last_time       bigint  NOT NULL,
  trades          integer NOT NULL CHECK (trades >= 0),
  source          text    NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'archive')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coin, minute)
);
CREATE TABLE IF NOT EXISTS footprint_gaps (
  coin        text   NOT NULL CHECK (coin ~ '^[A-Za-z0-9:_-]{1,32}$'),
  from_ms     bigint,
  to_ms       bigint NOT NULL,
  reason      text   NOT NULL CHECK (reason ~ '^[a-z_]{1,32}$'),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS footprint_gaps_coin_to ON footprint_gaps (coin, to_ms);
