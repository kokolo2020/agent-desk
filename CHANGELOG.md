# Changelog

Every push bumps the version. The version shows next to the title on the page, so you can tell which build Netlify is serving.

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
