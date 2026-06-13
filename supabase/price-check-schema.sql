-- =============================================================================
-- Project Vaal — Price Check addition
-- Adds the price_entries table (planning doc §6 / §15)
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================

CREATE TABLE public.price_entries (
  league          text NOT NULL,
  category        text NOT NULL,    -- 'currency','essences','runes','fragments','uniques', etc.
  api_id          text NOT NULL,    -- stable id/slug from the source API
  name            text NOT NULL,
  icon_url        text,
  exalted_value   numeric,          -- price in Exalted Orbs (PoE2 de facto trade currency)
  divine_value    numeric,          -- price in Divine Orbs (for high-value items)
  snapshot        jsonb,            -- raw API line stored for future extensibility
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league, category, api_id)  -- upsert replaces stale rows on conflict
);

CREATE INDEX price_entries_name_idx ON public.price_entries (league, name);

ALTER TABLE public.price_entries ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read prices
CREATE POLICY "Price data is publicly readable"
  ON public.price_entries FOR SELECT
  TO PUBLIC
  USING (true);

-- No INSERT/UPDATE/DELETE policies: only the service role (cron) writes,
-- and the service role bypasses RLS.