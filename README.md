# Agent Desk

Single-file dashboard for a multi-agent BTC paper-trading desk. Pure HTML, no build step.

- Live BTCUSDT price, candles, open interest, funding and order book from the Bybit public API.
- Paper trades only, starting bank $2,000. 5x, 0.055% taker fee per side, TP +0.15%, SL -0.10%, 90s max hold.
- Scan and Vet scores come from real momentum and order-book data. Results reset on page reload.

Deploy: connect this repo to Netlify, publish directory `/`. It must run on a normal site, not inside a sandboxed iframe, so the browser can reach the Bybit API.
