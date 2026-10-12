-- Autopilot tables. Writes come only from the Netlify functions (service key). The dashboard reads with the anon key.
create table if not exists ap_positions (
  id bigint generated always as identity primary key,
  coin text not null, side text not null,
  entry_price numeric not null, size numeric not null, notional numeric not null,
  tp numeric not null, sl numeric not null,
  max_hold_until timestamptz not null,
  opened_at timestamptz not null default now(),
  status text not null default 'open',
  exit_price numeric, closed_at timestamptz, pnl numeric, fees numeric, close_reason text,
  decision_id bigint
);
create table if not exists ap_decisions (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  coin text not null, action text not null, confidence numeric, reason text,
  price numeric not null, formula_mom numeric, news_summary text,
  tp_pct numeric, sl_pct numeric, hold_min numeric,
  outcome_price numeric, outcome_at timestamptz,
  taken boolean not null default false
);
create table if not exists ap_news (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  coin text not null, sentiment text, strength numeric, catalyst text, summary text, sources jsonb
);
-- Market snapshots every 5 minutes with what happened next, for pattern mining (no trading involved).
create table if not exists ap_samples (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  coin text not null, price numeric not null,
  ret_5m numeric, ret_15m numeric, ret_30m numeric, ret_60m numeric,
  pullback_pct numeric, bounce_pct numeric, range_60m numeric, vol_1m numeric,
  change24h numeric, funding numeric, spread_bps numeric,
  news_sentiment text, news_strength numeric,
  fwd_15m numeric, fwd_60m numeric
);
create index if not exists ap_samples_coin_ts on ap_samples (coin, ts desc);
alter table ap_samples enable row level security;
create policy "anon read samples" on ap_samples for select to anon using (true);
alter table ap_positions enable row level security;
alter table ap_decisions enable row level security;
alter table ap_news enable row level security;
create policy "anon read positions" on ap_positions for select to anon using (true);
create policy "anon read decisions" on ap_decisions for select to anon using (true);
create policy "anon read news" on ap_news for select to anon using (true);
