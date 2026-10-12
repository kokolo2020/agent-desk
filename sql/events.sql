-- Every event around a trade (signals, Claude's verdict, orders, fills, misses, cancels). Closed trades stay in paper_trades.
create table if not exists desk_events (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  run text, session text, coin text not null, kind text not null,
  side text, price numeric, data jsonb
);
alter table desk_events enable row level security;
drop policy if exists "anon insert events" on desk_events;
drop policy if exists "anon read events" on desk_events;
create policy "anon insert events" on desk_events for insert to anon with check (true);
create policy "anon read events" on desk_events for select to anon using (true);
