<div align="center">

# PolyGekko

**"Greed, for lack of a better word, is good."**
*— Gordon Gekko, Wall Street (1987)*

An automated trading bot for [Polymarket](https://polymarket.com) prediction markets — built for speed, precision, and edge.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://postgresql.org)
[![Polygon](https://img.shields.io/badge/Polygon-Mainnet-purple.svg)](https://polygon.technology)

</div>

---

<div align="center">
  <img src="./assets/gekko.jpg" alt="Gordon Gekko - Wall Street" width="480" />
</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Settings Template (JSON)](#settings-template-json)
- [Strategies](#strategies)
  - [Copy Trade](#-copy-trade)
  - [Market Maker](#-market-maker)
  - [Sniper](#-sniper)
- [Dashboard](#dashboard)
- [Risk Management](#risk-management)
- [Trading Modes](#trading-modes)
- [Docker Deployment](#docker-deployment)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Database Schema](#database-schema)
- [Disclaimer](#disclaimer)
- [Contributing](#contributing)
- [Sponsoring](#sponsoring)

---

## About

**PolyGekko** is a full-stack automated trading platform for [Polymarket](https://polymarket.com) — the world's largest on-chain prediction market. Named after the iconic Gordon Gekko from the 1987 film *Wall Street*, PolyGekko brings institutional-grade automation to binary prediction markets on the Polygon blockchain.

The platform runs three independent algorithmic strategies simultaneously, each targeting different market inefficiencies. It features a real-time dashboard, configurable risk controls, Telegram alerts, and both simulation and live trading modes — all powered by a NestJS backend, a Next.js frontend, and a PostgreSQL database.

---

## Features

- **Three independent trading strategies** — Copy Trade, Market Maker, and Sniper — each independently startable and configurable
- **Simulation mode** — run all strategies paper-trading before deploying real capital
- **Live mode** — real on-chain execution via the Polymarket CLOB API and Polygon
- **Real-time dashboard** — live P&L, open positions, win rate, cumulative performance chart
- **Polymarket data integration** — pulls real on-chain activity and portfolio metrics from `data-api.polymarket.com`
- **Three risk presets** — `HIGH`, `INTERMEDIATE`, `LOW` — apply in one click
- **Global risk controls** — circuit breaker, max exposure cap, wallet margin reserve, rate limiter
- **Per-strategy controls** — stop-loss, session stop-loss, max active positions, balance usage limits
- **Kelly Criterion sizing** — dynamically size trades based on historical win rate
- **Telegram alerts** — notified on every trade, strategy stop, error, and large loss
- **Settings history** — full audit log of every configuration change
- **Backtest mode** — replay historical positions against configurable parameters
- **Settings import/export** — backup and restore full configuration as JSON
- **WebSocket real-time updates** — all UI state pushed from server via Socket.io
- **Swagger API docs** — auto-generated at `/api/docs`
- **Docker ready** — `docker-compose up` and you're live

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Frontend                  │
│         Dashboard · Strategies · Settings            │
│              (React Query + Socket.io)               │
└──────────────────────┬──────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────┐
│                   NestJS Backend                     │
│                                                     │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ Copy Trade  │  │Market Maker│  │   Sniper    │  │
│  │  Strategy   │  │  Strategy  │  │  Strategy   │  │
│  └──────┬──────┘  └─────┬──────┘  └──────┬──────┘  │
│         └───────────────┼────────────────┘          │
│  ┌──────────────────────▼────────────────────────┐  │
│  │           Polymarket Service Layer            │  │
│  │   CLOB Client · CTF Service · Gamma API      │  │
│  └──────────────────────┬────────────────────────┘  │
│                         │                           │
│  ┌──────────────────────▼────────────────────────┐  │
│  │           Risk · SimStats · Events            │  │
│  │       Settings · Logs · Notifications         │  │
│  └──────────────────────┬────────────────────────┘  │
└─────────────────────────┼───────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼──────┐  ┌─────▼──────┐  ┌───▼──────────────────┐
    │ PostgreSQL │  │  Polygon   │  │ data-api.polymarket   │
    │  (Prisma)  │  │  Mainnet   │  │   (live portfolio)    │
    └────────────┘  └────────────┘  └──────────────────────┘
```

---

## Project Structure

```
PolyGekko/
├── docker-compose.yml          # Production orchestration
├── package.json                # Root npm workspace
│
├── api/                        # NestJS backend (port 3001)
│   ├── prisma/
│   │   ├── schema.prisma       # Database models
│   │   └── migrations/         # Prisma migration history
│   ├── src/
│   │   ├── main.ts             # Entry point (CORS, Swagger, Socket.io)
│   │   ├── app.module.ts       # Root NestJS module
│   │   │
│   │   ├── prisma/             # Prisma service & module
│   │   ├── settings/           # Settings CRUD + trading mode presets
│   │   ├── positions/          # Position queries
│   │   ├── trades/             # Trade history
│   │   ├── logs/               # Strategy event logs
│   │   ├── events/             # Socket.io WebSocket gateway
│   │   ├── notifications/      # Telegram alert service
│   │   │
│   │   ├── polymarket/         # Polymarket integration layer
│   │   │   ├── clob.service.ts            # CLOB order placement & API key mgmt
│   │   │   ├── ctf.service.ts             # CTF split/merge/redeem (on-chain)
│   │   │   ├── gamma.service.ts           # Gamma market data API
│   │   │   ├── binance.service.ts         # Binance price feeds
│   │   │   ├── polymarket-data.service.ts # data-api.polymarket.com integration
│   │   │   └── polymarket.controller.ts   # /api/polymarket endpoints
│   │   │
│   │   └── strategies/         # Strategy orchestration
│   │       ├── strategies.service.ts      # Unified strategy manager
│   │       ├── strategies.controller.ts   # /api/strategies endpoints
│   │       ├── risk.service.ts            # Risk checks (exposure, rate limit)
│   │       ├── sim-stats.service.ts       # Win/loss counters & performance samples
│   │       │
│   │       ├── copy-trade/
│   │       │   ├── copy-trade.service.ts  # Lifecycle manager
│   │       │   ├── watcher.service.ts     # Trader wallet WebSocket monitor
│   │       │   ├── executor.service.ts    # Order mirroring & position tracking
│   │       │   ├── auto-sell.service.ts   # Automatic profit-taking
│   │       │   └── redeemer.service.ts    # Post-resolution cashout
│   │       │
│   │       ├── market-maker/
│   │       │   ├── market-maker.service.ts  # Lifecycle manager
│   │       │   ├── detector.service.ts      # Opportunity scanner
│   │       │   └── mm-executor.service.ts   # YES/NO split & spread capture
│   │       │
│   │       └── sniper/
│   │           ├── sniper.service.ts          # Lifecycle manager
│   │           ├── sniper-executor.service.ts # Tier-based order placement
│   │           └── sniper-sizing.service.ts   # Capital allocation across tiers
│   │
│   ├── .env.example            # Environment variable template
│   ├── Dockerfile
│   └── Dockerfile.dev
│
└── web/                        # Next.js frontend (port 3000)
    └── src/
        ├── app/
        │   ├── dashboard/page.tsx          # Main dashboard
        │   ├── strategies/
        │   │   ├── copy-trade/page.tsx
        │   │   ├── market-maker/page.tsx
        │   │   └── sniper/page.tsx
        │   ├── positions/page.tsx
        │   ├── trades/page.tsx
        │   ├── logs/page.tsx
        │   ├── settings/page.tsx
        │   └── backtest/page.tsx
        │
        ├── components/
        │   ├── layout/                     # Main layout, header, sidebar
        │   ├── dashboard/                  # Stats cards, charts, activity feed
        │   ├── strategies/                 # Per-strategy config forms
        │   ├── settings/                   # Trading mode + Telegram forms
        │   ├── logs/                       # Real-time log viewer
        │   └── ui/                         # shadcn/ui primitives
        │
        ├── hooks/
        │   ├── use-socket-events.ts        # WebSocket subscription
        │   ├── use-sim-mode.ts             # Sim/Live mode toggle
        │   └── use-theme.ts               # Dark mode
        │
        └── lib/
            ├── api.ts                      # REST fetch client
            ├── socket.ts                   # Socket.io singleton
            ├── types.ts                    # TypeScript interfaces
            ├── i18n.tsx                    # UI labels & translations
            └── utils.ts                    # Formatters & helpers
```

---

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 15+
- **A Polymarket account** with:
  - Private key (exported from Polymarket embedded wallet)
  - Proxy wallet address (from your Polymarket profile URL)
- **Polygon RPC URL** (Alchemy, QuickNode, or Ankr)
- *(Optional)* Docker + Docker Compose for containerized deployment

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/polygekko.git
cd polygekko
```

### 2. Install dependencies

```bash
npm install
cd api && npm install
cd ../web && npm install
cd ..
```

### 3. Configure environment variables

```bash
cp api/.env.example api/.env
```

Edit `api/.env` with your credentials (see [Configuration](#configuration) below).

### 4. Set up the database

```bash
cd api
npx prisma migrate deploy
npx prisma generate
```

### 5. Start the development servers

```bash
# Terminal 1 — API
cd api && npm run start:dev

# Terminal 2 — Web
cd web && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Configuration

All credentials go in `api/.env`. An annotated template is provided at [`api/.env.example`](api/.env.example).

### Wallet Setup

PolyGekko uses two addresses:

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | 64-char hex key of your **EOA** wallet — exported from Polymarket embedded wallet (Settings → Export Private Key) |
| `PROXY_WALLET_ADDRESS_MAIN` | Your **Safe/proxy wallet** address — shown on your Polymarket profile URL (e.g., `https://polymarket.com/profile/0x71812...`) |
| `SIGNATURE_TYPE` | `1` for most users (POLY_PROXY). Use `0` for EOA, `2` for Gnosis Safe |

> **Note:** The EOA (private key) and the proxy wallet are **different addresses**. The proxy wallet holds your USDC and is shown on your Polymarket profile. The EOA is the signing key used to authorize transactions.

### Core Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/polygekko

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Polymarket wallet
PRIVATE_KEY=your_64_char_hex_key
PROXY_WALLET_ADDRESS_MAIN=0xYourProxyWalletAddress
SIGNATURE_TYPE=1

# Polygon RPC (get a free key from Alchemy or QuickNode)
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY

# Telegram alerts (optional)
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_from_BotFather
TELEGRAM_CHAT_ID=your_chat_id
```

All other settings (position sizes, stop-loss %, trading pairs, etc.) are configured live through the dashboard UI and stored in the database — no restart required.

### Settings Template (JSON)

A ready-to-use settings template with safe defaults for all strategies is provided at [`settings.example.json`](settings.example.json). You can import it directly from the dashboard:

1. Open **Settings → Import / Export**
2. Click **Import** and select `settings.example.json`
3. All settings will be loaded with safe, pre-configured defaults

The template includes all 50+ settings across Copy Trade, Market Maker, Sniper, System, and Telegram categories — with every strategy in simulation mode and all risk controls pre-configured. Replace the placeholder values (`YOUR_BOT_TOKEN_FROM_BOTFATHER`, `0xYourTargetTraderAddress`, etc.) with your real data after importing.

---

## Strategies

### 📋 Copy Trade

**Mirrors the trades of any Polymarket user in real time.**

The Copy Trade strategy subscribes to a target trader's wallet via WebSocket and automatically places matching orders on your account whenever the target executes a trade. You choose how much capital to allocate and how to size relative to the target.

**How it works:**

1. Subscribe to the target trader's address via Polymarket WebSocket
2. Detect incoming BUY orders
3. Calculate position size based on your configured sizing mode
4. Execute FOK order immediately; fall back to GTC if FOK fails
5. Optionally place auto-sell limit order at configured profit target
6. Monitor for market resolution and auto-redeem winning positions

**Sizing Modes:**

| Mode | Description |
|---|---|
| `fixed` | Always trade a fixed USDC amount (e.g., $10) |
| `percentage` | % of your max position size setting |
| `balance` | % of your current live USDC balance |

**Key Settings:**

| Setting | Description | Default |
|---|---|---|
| `COPY_TRADE_TRADER_ADDRESS` | Target wallet to copy | — |
| `COPY_TRADE_SIZE_MODE` | `fixed`, `percentage`, or `balance` | `percentage` |
| `COPY_TRADE_FIXED_AMOUNT` | Fixed USDC per trade (if fixed mode) | 10 |
| `COPY_TRADE_AUTO_SELL_ENABLED` | Place limit-sell after entry | `true` |
| `COPY_TRADE_AUTO_SELL_PROFIT_PERCENT` | Exit at +X% profit | 40 |
| `COPY_TRADE_STOP_LOSS_PERCENT` | Stop-loss below entry price | 10 |
| `COPY_TRADE_SESSION_STOP_LOSS` | Pause if session drops X% | 15 |
| `COPY_TRADE_MIN_LIVE_BALANCE` | Minimum USDC to keep in wallet | 10 |
| `COPY_TRADE_MAX_BALANCE_USAGE_PERCENT` | Max % of balance deployed | 60 |
| `COPY_TRADE_GTC_FALLBACK_TIMEOUT` | Seconds to wait for GTC fill | 60 |

---

### 📈 Market Maker

**Captures the spread in binary prediction markets by providing liquidity on both sides.**

The Market Maker strategy targets 5-minute and 15-minute binary markets (YES/NO outcomes). It splits USDC into YES and NO tokens via the Conditional Token Framework (CTF), then sells both sides at a markup. Since both outcomes can't win simultaneously, the strategy profits from the spread when both limit sells fill before the market resolves.

**How it works:**

1. **Detect** an eligible market (correct duration, prices in range, spread available)
2. **Split** USDC into equal YES + NO token pairs via CTF
3. **Sell** YES at markup (e.g., $0.65) and NO at markup simultaneously as limit orders
4. **Monitor** for fills, early exit conditions, or market close
5. **Cut loss** N seconds before market resolves if orders haven't filled
6. **Redeem** any resolved winning tokens post-resolution

**Binance Trend Integration:**

When `MM_BINANCE_TREND_ENABLED=true`, the strategy reads recent Binance kline data for the underlying asset (BTC, ETH, SOL, etc.) and skews capital allocation toward the trending side, improving probability of YES or NO fills.

**Key Settings:**

| Setting | Description | Default |
|---|---|---|
| `MM_ASSETS` | Comma-separated assets to trade | `btc,eth,sol,xrp,bnb,doge,hype` |
| `MM_TRADE_SIZE` | USDC per side (min $5 on live) | 5 |
| `MM_SELL_PRICE` | Target sell price per token | 0.60 |
| `MM_DURATION` | Market duration to target | `5m` |
| `MM_CUT_LOSS_TIME` | Seconds before close to force-exit | 35 |
| `MM_ENTRY_MAX_COMBINED` | Max YES+NO combined to enter | 1.00 |
| `MM_MIN_SPREAD` | Min spread required before entry | 0.03 |
| `MM_ENTRY_MIN_TOKEN_PRICE` | Min individual token price | 0.10 |
| `MM_ENTRY_MAX_TOKEN_PRICE` | Max individual token price | 0.90 |
| `MM_EARLY_EXIT_ENABLED` | Exit early on large loss | `true` |
| `MM_EARLY_EXIT_LOSS_PCT` | Exit if value drops X% of cost | 30 |
| `MM_MAX_ACTIVE_MARKETS` | Max simultaneous open positions | 3 |
| `MM_BINANCE_TREND_ENABLED` | Use Binance momentum for skew | `true` |

---

### 🎯 Sniper

**Hunts for panic sellers dumping tokens far below fair value.**

The Sniper strategy continuously places limit buy orders at three deeply discounted price tiers (e.g., 1¢, 2¢, 3¢). When volatility spikes or a panic sell happens, the orders fill at a steep discount. The strategy then holds for a rebound or profits from resolution if the market settles YES.

**How it works:**

1. Monitor active markets for target assets
2. Place resting limit orders at 3 price tiers simultaneously:
   - **Tier 1** (1¢) — 20% of allocated capital, catches extreme panics
   - **Tier 2** (2¢) — 30% of capital, moderate dip buys
   - **Tier 3** (3¢) — 50% of capital, most likely to fill
3. When a panic seller dumps, orders fill at a fraction of fair value
4. Hold until market resolves, or sell at profit if price rebounds

**Key Settings:**

| Setting | Description | Default |
|---|---|---|
| `SNIPER_ASSETS` | Assets to snipe (comma-separated) | `eth,btc,sol` |
| `SNIPER_MAX_SHARES` | Max shares per side per market | 50 |
| `SNIPER_TIER1_PRICE` | Tier 1 buy price | 0.04 |
| `SNIPER_TIER2_PRICE` | Tier 2 buy price | 0.03 |
| `SNIPER_TIER3_PRICE` | Tier 3 buy price | 0.02 |
| `SNIPER_PAUSE_ROUNDS_AFTER_WIN` | Rounds to pause after a win | 2 |
| `SNIPER_VOLUME_SPIKE_PCT` | Min volume spike % to trigger | 0 |
| `SNIPER_SCHEDULE` | Per-asset schedule (e.g. `ETH=11:40-15:40`) | — |

---

## Dashboard

The dashboard provides a real-time view of all trading activity. In **live mode**, data is sourced directly from the Polymarket on-chain data API for accuracy. In **simulation mode**, data is sourced from local database records.

**Panels:**
- **Connection Health** — API, CLOB, and Gamma connectivity status
- **Stats Cards** — Total P&L, open positions, total trades, win rate
- **Balance Panel** — Live USDC wallet balance
- **Strategy Status** — Running/paused/stopped status for each strategy with start/stop controls
- **Performance Chart** — Cumulative P&L over time (live: built from real on-chain activity)
- **Recent Activity** — Latest trades (live: pulled from Polymarket data API)
- **Win/Loss Chart** — Win/loss breakdown per strategy *(simulation mode)*
- **Capital Allocation** — Distribution across open positions *(simulation mode)*
- **Sim Stats Panel** — Per-strategy simulation statistics *(simulation mode)*

---

## Risk Management

PolyGekko includes layered risk controls at the global and per-strategy level:

### Global Controls

| Setting | Description |
|---|---|
| `GLOBAL_WALLET_MARGIN` | Minimum USDC to always keep in wallet — never deployed |
| `GLOBAL_MAX_EXPOSURE_USDC` | Maximum total USDC in open positions across all strategies (0 = unlimited) |
| `GLOBAL_CIRCUIT_BREAKER_PCT` | Auto-pause ALL strategies if total P&L drops X% within the window (0 = disabled) |
| `GLOBAL_CIRCUIT_BREAKER_WINDOW_HOURS` | Rolling window for circuit breaker calculation |
| `GLOBAL_MAX_ENTRIES_PER_MINUTE` | Rate limit on new position entries across all strategies |

### Per-Strategy Controls

- **Stop-loss %** — Close position if price drops X% below entry
- **Session stop-loss** — Pause strategy if session P&L drops X% from starting balance
- **Max balance usage %** — Cap on total balance deployed in open positions
- **Min live balance** — USDC floor that the strategy will never touch
- **Max active markets** — Limit on simultaneously open positions

### Kelly Criterion (Copy Trade)

When `COPY_TRADE_KELLY_ENABLED=true` and at least `COPY_TRADE_KELLY_MIN_TRADES` positions have been resolved, position sizes are dynamically calculated using the Kelly formula based on historical win rate. The `COPY_TRADE_KELLY_MAX_FRACTION` cap prevents over-betting.

---

## Trading Modes

Three built-in risk presets can be applied with one click from the Settings page:

| Parameter | LOW | INTERMEDIATE | HIGH |
|---|---|---|---|
| Copy Trade amount | $5 | $20 | $50 |
| Max balance usage | 20% | 50% | 80% |
| Min wallet reserve | $50 | $20 | $10 |
| Session stop-loss | 50% | 30% | disabled |
| Auto-sell target | +80% | +50% | +30% |
| MM position size | $5 | $20 | $50 |
| MM early exit loss | 25% | 40% | 60% |
| Sniper max shares | 10 | 25 | 50 |
| Rate limit | 2/min | 5/min | 10/min |

Apply a preset via **Settings → Trading Mode**, or configure everything individually in **Custom** mode.

---

## Docker Deployment

### Development

```bash
# Start only the database
docker-compose -f api/docker-compose.yml up -d

# Run API and web locally
cd api && npm run start:dev
cd web && npm run dev
```

### Production

```bash
# Build and run everything
docker-compose up -d --build

# Check logs
docker-compose logs -f api
docker-compose logs -f web
```

The `docker-compose.yml` at the root runs:
- **api** — NestJS backend on port `3001`
- **web** — Next.js frontend on port `3000`

Ensure your `api/.env` is populated before running.

---

## API Reference

Interactive Swagger docs are available at **`http://localhost:3001/api/docs`** when the API is running.

### Strategies

```
GET    /api/strategies              # List all strategies and their status
GET    /api/strategies/health       # Health check (CLOB, Gamma, strategies)
GET    /api/strategies/sim-stats    # Simulation statistics per strategy
GET    /api/strategies/performance  # Time-series P&L samples
GET    /api/strategies/balance      # USDC balance (sim or live)
POST   /api/strategies/:name/start  # Start a strategy
POST   /api/strategies/:name/stop   # Stop a strategy
POST   /api/strategies/:name/pause  # Pause a strategy
POST   /api/strategies/:name/resume # Resume a paused strategy
POST   /api/strategies/backtest     # Run a backtest
POST   /api/strategies/trading-mode # Apply a risk preset
DELETE /api/strategies/sim-data     # Clear all simulation data
```

### Settings

```
GET    /api/settings                       # Get all settings
GET    /api/settings?category=market_maker # Filter by category
PATCH  /api/settings                       # Bulk update settings
PATCH  /api/settings/:key                  # Update single setting
GET    /api/settings/history               # Settings change audit log
GET    /api/settings/export                # Export settings as JSON
POST   /api/settings/import                # Import settings from JSON
```

### Positions & Trades

```
GET    /api/positions                      # List positions (filterable by status, strategy, isDryRun)
GET    /api/positions/:id                  # Get single position
GET    /api/positions/unrealized-pnl       # Unrealized P&L for open positions
GET    /api/trades                         # List trades (filterable)
```

### Polymarket Data

```
GET    /api/polymarket/balance             # Live USDC wallet balance
GET    /api/polymarket/portfolio           # Real on-chain portfolio metrics
GET    /api/polymarket/activity?limit=N    # Real on-chain trade history
GET    /api/polymarket/positions           # Real open positions from Polymarket
```

### Logs & Notifications

```
GET    /api/logs                           # Strategy event logs
DELETE /api/logs                           # Clear logs
POST   /api/notifications/telegram/test   # Test Telegram alert
```

---

## WebSocket Events

PolyGekko pushes real-time updates to the frontend via Socket.io. Connect to `ws://localhost:3001`.

| Event | Payload | Description |
|---|---|---|
| `strategy-status` | `{ type, running, paused, isDryRun }` | Strategy state changed |
| `trade-event` | `Trade` object | New trade executed |
| `position-update` | `Position` object | Position opened, updated, or closed |
| `log-event` | `StrategyLog` object | New log entry from any strategy |
| `sim-stats-update` | `SimStats[]` | Win/loss counters updated |

---

## Database Schema

PolyGekko uses PostgreSQL via Prisma ORM. Seven models:

| Model | Description |
|---|---|
| `Setting` | Key-value configuration store (50+ settings) |
| `SettingHistory` | Audit log of every configuration change |
| `Position` | Open/closed trading positions with P&L, status, strategy type |
| `Trade` | Individual buy/sell orders with price, size, order ID, fill status |
| `StrategyLog` | Real-time strategy events (INFO/WARN/ERROR/DEBUG) |
| `SimStats` | Per-strategy simulation counters (wins, losses, total P&L) |
| `PerformanceSample` | Time-series P&L snapshots used for the performance chart |

Run migrations:

```bash
cd api
npx prisma migrate deploy    # Apply migrations
npx prisma studio            # Browse database in browser
```

---

## Disclaimer

> **PolyGekko is experimental software. Prediction markets are highly speculative and you can lose your entire investment. This software is provided "as is", without warranty of any kind. The authors are not responsible for any financial losses incurred through its use. Always start in simulation mode (`GLOBAL_SIMULATION_MODE=true`) and never trade with funds you cannot afford to lose.**

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change. Pull requests should target the `main` branch and include a clear description of the changes.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Sponsoring

PolyGekko is open-source and built in the spare time of its contributors. If it's useful to you or you'd like to support its development, consider sponsoring:

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?style=for-the-badge)](https://github.com/sponsors/fepalemes)

Sponsorship helps fund:
- Continued development of new strategies
- Infrastructure for testing and CI
- Documentation and tutorials
- Bug fixes and security patches

---

<div align="center">

Made with greed (and caffeine) by the Fepalemes team.

*"The most valuable commodity I know of is information."* — Gordon Gekko

</div>
