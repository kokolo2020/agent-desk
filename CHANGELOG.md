# Changelog

Every push bumps the version. The version shows next to the title on the page, so you can tell which build Netlify is serving.

## v1.5
- Manual order: new UPDATE TP / SL button. Change the TP and SL boxes, then tap it to move them on a resting limit order or an open position. A blank box keeps the current value.
- The TP and SL boxes now fill in with the position's levels when an order is placed or filled.
- Checks: TP must be beyond the current price and SL on the other side of it, so a stop can be moved up (long) or down (short) to lock in profit. Each change is logged as `manual_adjust` in `desk_events`.

## v1.4
- New table `desk_events` (SQL in `sql/events.sql`). Every step around a trade is now logged: formula signals, Claude's verdict (action, confidence, reason, whether it agreed), market entries, limit-twin orders, fills and misses, manual orders, fills and cancels. Closed trades still go to `paper_trades`.
- Logging is silent: if the table is missing, the page keeps working and only the ledger counter in the header ignores it.
- Older v0.8 tab has no ledger; its last closed trades were back-filled once under run `v0.8-backfill` (the tape only keeps the last 5 per coin, so earlier v0.8 trades are lost).

## v1.3
- Manual order: TP and SL are now entered as prices (for example TP 5.20, SL 5.75), not percentages. Leave a box blank to use the default +0.40% / −0.20% from the entry price.
- The panel checks the direction: a SHORT needs TP below and SL above the entry; a LONG needs TP above and SL below. Otherwise it shows a message and does not open the order.

## v1.2
- Manual order panel on each coin: place paper LONG or SHORT yourself, market or limit, with your own TP % and SL %, and size of 100%, 50% or 25% of the bank at 5x.
- Own $150 bank per coin, separate from the agent desk and the limit twin, so the comparison stays clean. Saved to Supabase with run `v1.2-manual`.
- Market fills at the last price (taker 0.055%). A limit rests until price trades through it by 0.01% (maker 0.02%); a limit already past the market fills at once as taker. TP exits as maker, SL and the close button as taker. No time limit; cancel or close any time.

## v1.1
- Limit-order twin on each coin. When the market desk enters (after the LLM Chief agrees), the twin rests a limit order at the near side of the book (long at the bid, short at the ask) instead of paying the spread.
- Fills only if price trades through the limit by 0.01%. If not filled within 3 minutes it counts as missed.
- Fees: maker 0.02% on entry and on take profit; taker 0.055% on stop and time exit. Same TP +0.40%, SL −0.20%, 15 min max hold. Own $150 bank.
- New "Limit twin" panel per coin compares limit vs market (wins, losses, filled, missed, P&L, fees). Twin trades are saved to Supabase with run `v1.1-limit`; market trades with run `v1.1`.

## Autopilot v1 (separate from the dashboard versions)
- New server-side desk that runs on Netlify with no browser open. Every 5 minutes it manages open paper trades and, when the market moves or news is hot, asks Claude for LONG, SHORT or PASS.
- News: every 2 hours per coin, Claude searches the web for catalysts from the last 48 hours and stores a summary, sentiment and strength in Supabase.
- Claude chooses its own take profit, stop and hold time (longer holds allowed), sees its own recent decisions and what price did 15 minutes later, and stays flat by default.
- Viewer page: `/autopilot.html`. Tables: `ap_positions`, `ap_decisions`, `ap_news` (SQL in `sql/autopilot.sql`).
- Pattern dataset: every 5 minutes it saves a snapshot per coin (rally and pullback size over 5/15/30/60 minutes, distance from the 60-minute high and low, range, volatility, funding, 24h change, news) and fills in what price did 15 and 60 minutes later (`ap_samples`). Claude also sees these swing numbers when deciding.
- Paper money only. No exchange keys, no real orders.

## v1.0
- LLM Chief. When the formula wants a trade, the desk asks a Claude model (through a small Netlify function that holds the API key) and only enters if Claude agrees. Claude sees the price, 6-minute move, spread, depth, funding, recent closes and the last 5 closed trades.
- Claude's reason shows on the desk and is saved in the ledger `reason` column (`| llm: ...`).
- If the LLM Chief is offline the desk stays flat (no trade) and says so.

## v0.9
- Every closed paper trade is now saved to a Supabase table (`paper_trades`) with run version, session, coin, side, entry/exit, size, fees, P&L and reason. Trades survive reloads, so versions can be compared fairly.
- Header shows `ledger: N saved` (turns red with the error if a save fails).
- Uses the public anon key only; the table's row rules allow adding and reading trades, nothing else. Trading logic unchanged from v0.8.

## v0.8
- Result of v0.7 after 52 minutes: about 76 trades, gross P&L +$8, fees $57, net -$49 on $300. Fees dominated.
- Far fewer trades: 10-minute cooldown after each trade, and entry only on a 6-minute move of at least 0.15% (BTC) or 0.30% (NEAR).
- Wider targets: take profit +0.40%, stop -0.20%, max hold 15 minutes. A fee of 0.11% is now a smaller share of each trade.
- Momentum score scale lowered so it no longer saturates at 0.95.

## v0.7
- BTC and NEAR now run side by side. Each coin has its own desk: six agents, live chart, $150 paper balance, activity tape and verdict. The header shows the total of both balances.
- NEAR thresholds are first guesses: momentum gate 0.06%, depth minimum $0.5M, max spread 8 bps.
- KuCoin futures added as the last backup price source, untested.
- Backup sources are keyed per coin (Bybit, Binance, OKX, KuCoin).

## v0.6
- Paper bank is now $150.

## v0.5
- Price stream tries several exchange WebSocket addresses and switches if one sends nothing for 6 seconds.
- Book depth is measured on the top of the order book only, so the threshold is now $5M and the metric is renamed book_depth_usd.
- Chief passes unless the 6-minute move is at least 0.03%, so it stops trading tiny moves that fees would eat.

## v0.4
- Trade-by-trade price from the exchange WebSocket, so the price and last candle move many times per second.
- Badge shows ticks per second.
- Polling every 2 seconds as backup.

## v0.3
- Backup price sources: Binance and OKX if Bybit is blocked.
- Feed badge shows the source name, or the exact error when down.
- Version number shown on the page.

## v0.2
- Live Bybit BTCUSDT price, candles, open interest, funding, order book.
- Paper trades fill at the real price with fees, take profit and stop.

## v0.1
- Mock dashboard with random data, $2,000 starting bank.
