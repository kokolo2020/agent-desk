# Changelog

Every push bumps the version. The version shows next to the title on the page, so you can tell which build Netlify is serving.

## v1.14.2
- Automatic 6h recap video: a GitHub Action runs at 00:05, 06:05, 12:05 and 18:05 Bangkok time, records the 3 minute recap of the live page and posts it as an MP4 on the repo's Releases page.

## v1.14.1
- Autopilot page: 6h recap button. Replays the last 6 hours of the race over 3 minutes and records it to a video file (WebM) you can download.

## v1.14
- Autopilot now covers the top 50 coins by market cap (OKX swaps; the list has spares so 50 stay live). Every coin gets $250 on the Algo desk and the AI desk. Claude still only looks at the 4 biggest movers per scan, so AI cost stays flat.
- Forward-return backfill runs in parallel so the 5 minute run stays fast with 50 coins.

## v1.13.1
- Autopilot page refreshes every 5 minutes, lined up with the server scan, with a countdown and a refresh-now button.

## v1.13
- Autopilot now covers the top 20 coins (BTC, ETH, XRP, BNB, SOL, DOGE, TRX, ADA, LINK, AVAX, SUI, XLM, BCH, HBAR, LTC, TON, DOT, UNI, AAVE, NEAR). Contract sizes come from OKX at run time, and a coin OKX does not list is dropped.
- Every 5 minutes it scans all of them (one snapshot row each for pattern mining), then asks Claude only about the 4 coins whose move is biggest compared with their own noise, plus any coin with an open trade. At most 5 AI trades open at once; skips a coin when the spread is over 8 bps.
- New Algo desk: plain rules, no AI, $250 per coin, stored as coin `XXX:algo` in `ap_positions` (no new table needed). Rule: range fade (30m range 1.2%+, price 0.35%+ from its 20m average, not trending, price has turned, not fighting a 60m move of 0.5%+), take profit 0.6%, stop 0.6%, 30 minute hold, 10 minute cooldown.
- Both desks start at $250 per coin (was $150 for the AI desk), so the Autopilot page compares them side by side with a total and an "AI minus Algo" column.
- AI thinking upgrade: it now sees market breadth across the top 20, BTC's trend, how the coin moves against BTC, and the desk's recent win/loss by side. The prompt makes it reason in order (regime, edge, catalyst, cost, track record), defines confidence as the chance of hitting take profit first, raises the minimum take profit to 0.5%, and tells it a rule-based desk is being compared with it. Reasons are stored up to 340 characters.
- News scan: one coin every 15 minutes (BTC, coins with an open trade, or the biggest 24h movers, oldest scan first) instead of fixed BTC and NEAR jobs.
- Autopilot page redesigned (decisions list is collapsible, one line each until opened): summary tiles, the "$250 race": an animated chart where every coin starts at $250 and the line shows what that $250 is worth over time (3h/6h/24h/3d). Switch between just holding the coin, the Algo desk and the AI desk (real value including open trades). Live leaderboard beside it, hover to spotlight a coin, click a coin to see Holding vs Algo vs AI with trade open/close markers, Replay button. Table view underneath, decisions with a confidence bar and what price did afterwards.

- Race chart: every coin has its own fixed colour (lines, labels, leaderboard dots, tooltips); value text is green above $250 and red below.
- All times on both pages are Bangkok time (UTC+7): the clock, chart axes, tooltips, activity tape and the Autopilot status line.

- Race chart tabs for leverage: Holding 1x, 1.5x, 2x, 3x. Value = $250 x (1 + leverage x the coin's move since the start of the window), no fees or funding; a coin that falls far enough to hit zero is shown as wiped out at $0. The Algo and AI desk tabs are labelled 5x, which is what those desks use. Opening a coin also draws the selected leverage line.

- Race chart now starts at 18:00 Bangkok time on 14 Oct 2026 (new default tab "Since 18:00"; every line starts at $250 there). 3h, 6h, 24h and 3d tabs remain. To restart the race later, change `RACE_START` in `autopilot.html`.

## v1.12
- Tuned from the first two days of data (162 trades, -$167 net, $119 of it fees; NEAR longs -$151, NEAR shorts +$4).
- Fade bot trades less: needs a 1.2% range (was 0.8%) and a 0.35% stretch (was 0.25%), and it no longer buys a dip when the last hour is down 0.5%+ (or shorts a bounce when it is up 0.5%+).
- Autopilot news: the scan is told today's date and must say whether a named event (CPI, Fed) has already happened; conflicting sources are read conservatively. Scans older than 6 hours are no longer shown to the decision step.
- Autopilot asks Claude in a quiet market when news is 0.4+ strength and under 3 hours old (was 0.6 and 6 hours). The 0.55 confidence gate is unchanged: both skipped 0.50 shorts would have lost.

## v1.11
- "Jev stand-in" panel. We don't have the Jev model, so this is our version of the idea: the same paper spread quoter, but it only opens a position on the side a signal picks. Signal = order-book imbalance over the top 10 levels (buy side if the bid side is 25%+ heavier and price isn't falling, sell side for the reverse, otherwise stay out). The side that reduces inventory is always quoted. It runs beside the plain two-sided quoter so the two can be compared.
- Both quoters now log the signal (book imbalance, 10-second flow) with every fill and every minute (`mm_*` and `jev_*` events in `desk_events`), so we can later train a real buy/sell classifier on our own data.
- Inventory cap now counts the next quote, so it no longer overshoots $225.

## v1.10
- New "Spread quoter" panel on each desk (paper only). It rests a bid at the best bid and an ask at the best ask, never crosses the spread, and shows spread capture before fees plus the net result at three fee levels: standard maker 0.02%, 0%, and a 0.005% rebate. This tests whether market-making (the Jev idea) beats fees.
- Fill rule is strict: a bid fills only when a trade prints below it (an ask: above it), with no credit for queue position. Quotes refresh from each book snapshot (now every 3 seconds, was every 9), and a filled side stays empty until the next snapshot.
- Risk: inventory capped at $225 per side; a 0.4% adverse move flattens at the touch as taker. Fills are logged as `mm_fill` and `mm_flatten`, plus a once-a-minute `mm_snap`, in `desk_events`. Nothing goes to `paper_trades`.
- Open the page with `?mm=only` to run only the quoter (the formula desks, twin and fade bot stay off), so it can run beside a fade-bot tab without doubling trades.

## v1.9
- Tuned from the overnight run (42 trades, -$26.65; the judge's 30 early exits lost $31.10, the plain rules made +$4.47).
- The judge can now only cut a LOSING trade: it is asked only once the trade is down 0.3% and held 30s+, and a CLOSE acts only at down 0.4% or worse. Winners are left to the take profit.
- Trend filter: no entry when the 30-minute net move (measured up to 5 minutes ago, so the dip itself does not count) is over 40% of the range, or the 60-minute move is 1% or more.
- Circuit breaker: 3 losses in a row pauses the bot for 30 minutes (`fade_pause` event).
- Gate logging: once a minute the reason for staying out is logged as `fade_gate`, and the panel shows seconds spent out per gate (range, trend, stretch, turn, pause).

## v1.8
- Fade bot now has an "instinct" layer. Every 20 seconds while a trade is open, a new Netlify function (`exit-judge`, Claude Haiku) is shown the position (entry, price, P&L, peak, worst, time held, last 12 one-minute closes, range, distance from average) and answers HOLD or CLOSE.
- A CLOSE exits at market (taker fee). The hard rules stay as guardrails: take profit 0.5%, stop 0.8%, exit after 6 minutes. If the function is down, the bot just follows the rules.
- Every judgement is logged as `fade_judge` in `desk_events` (action, reason, P&L, time held), so we can later check whether the judge's early exits beat simply holding.

## v1.7
- Fade bot on each coin, copying the manual range pattern (7 wins, 1 loss on NEAR). Own $150 bank, compounding, runs on its own with no clicks.
- Rules: only in a range wide enough to beat fees (30-minute high to low of at least 0.8%); price at least 0.25% away from its 20-minute average; buy the dip or short the bounce only once price has turned (no catching a falling knife). Take profit 0.5% (maker), stop 0.8%, exit after 6 minutes, 60-second cooldown.
- Entry is market (taker 0.055%), take profit is a limit (maker 0.02%), stop and time exit are taker. Round trip is about $0.80 on a $750 position.
- Closed trades saved to Supabase under run `v1.7-fade`; entries logged as `fade_entry` in `desk_events`.
- The numbers are first guesses from 8 manual trades, to be tuned on real data.

## v1.6
- Manual order: TP and SL boxes reset to blank after every close or cancel. A blank box now means the default: TP 3% in profit and SL 3% against, from the entry price (before: +0.4% / −0.2%).
- You can still type your own prices, or change them later with UPDATE TP / SL.

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
