# Nubra Options Chain Dashboard

A production-grade, real-time options chain dashboard built with **Next.js 14**, connecting to the **Nubra Python REST & WebSocket API**. Displays live Greeks, OI, GEX, IV Smile, Max Pain, and supports order placement directly from the chain view.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App                              │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────┐ │
│  │  /api/auth   │   │ /api/options │   │    /api/order       │ │
│  │  (AUTH-01-04)│   │  -chain      │   │    (UI-07)          │ │
│  └──────┬───────┘   │  (DATA-01)   │   └──────────┬──────────┘ │
│         │           └──────┬───────┘              │            │
│         └──────────────────┼──────────────────────┘            │
│                            │                                    │
│                     NubraClient (singleton)                     │
│                    ┌───────┴────────┐                           │
│                    │ SessionManager  │  AUTH-02, AUTH-03        │
│                    │ RateLimiter    │  OPS-01, OPS-04           │
│                    └───────┬────────┘                           │
│                            │                                    │
│  ┌─────────────────────────┼────────────────────────────────┐  │
│  │            Client-Side (React)                            │  │
│  │                         │                                 │  │
│  │  useLiveOptionChain ────┤                                 │  │
│  │   ├─ REST bootstrap ────┤ (Step 3)                        │  │
│  │   └─ WS connect ────────┤ (Step 4)                        │  │
│  │        │                │                                 │  │
│  │  NubraWebSocketManager  │ DATA-02, DATA-03, DATA-05       │  │
│  │   ├─ subscribe()        │ OPS-02, OPS-03                  │  │
│  │   ├─ heartbeat          │                                 │  │
│  │   └─ reconnect logic    │                                 │  │
│  │                         │                                 │  │
│  │  Zustand Store ─────────┘ (Step 7)                        │  │
│  │   ├─ applyTick()  PROC-01, PROC-02, PROC-03               │  │
│  │   ├─ flashState   (UI-06)                                  │  │
│  │   └─ filteredRows                                          │  │
│  │                                                            │  │
│  │  UI Components (Step 8)                                    │  │
│  │   ├─ OptionChainTable  (UI-01)                             │  │
│  │   ├─ OIProfileChart    (UI-04)                             │  │
│  │   ├─ IVSmileChart      (UI-03)                             │  │
│  │   ├─ GEXChart          (UI-02)                             │  │
│  │   └─ OrderPanel        (UI-07)                             │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                     Nubra API (External)
                    ┌─────────┴──────────┐
                    │  REST API          │  DATA-01
                    │  WebSocket Stream  │  DATA-02
                    │  Greeks Channel    │  DATA-03
                    └────────────────────┘
```

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd nubra-options-dashboard
npm install
```

### 2. Configure environment

```bash
cp .env.local .env.local
# Edit .env.local with your Nubra credentials
```

```env
NUBRA_EMAIL=your_email@example.com
NUBRA_TOTP_SECRET=your_totp_secret_base32
NUBRA_MPIN=your_mpin
NUBRA_DEVICE_ID=your_device_id
NUBRA_BASE_URL=https://api.nubra.io
NUBRA_WS_URL=wss://stream.nubra.in/v1/ws
```

### 3. Run

```bash
npm run dev
# Open http://localhost:3000
```

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/route.ts           # AUTH-01..04: session management
│   │   ├── options-chain/route.ts  # DATA-01: option chain snapshots
│   │   └── order/route.ts          # UI-07: order placement
│   ├── dashboard/page.tsx          # Main dashboard page
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/
│   │   ├── TopBar.tsx              # Underlying/expiry selector + spot
│   │   ├── ConnectionBar.tsx       # WS/REST/Auth status
│   │   ├── StatsRow.tsx            # PCR, OI totals, Max Pain, IVR
│   │   └── ChainControls.tsx       # Strike range, Greeks toggle
│   ├── charts/
│   │   ├── OIProfileChart.tsx      # UI-04: OI distribution (Recharts)
│   │   ├── IVSmileChart.tsx        # UI-03: IV skew (Recharts)
│   │   └── GEXChart.tsx            # UI-02: Gamma exposure (Recharts)
│   ├── OptionChainTable.tsx        # UI-01: Main chain table with flash
│   ├── OrderPanel.tsx              # UI-07: Buy/Sell from selected strike
│   └── SidePanel.tsx               # Tab container for charts + order
├── hooks/
│   ├── useLiveOptionChain.ts       # Data pipeline orchestrator
│   └── useOrderPlacement.ts        # Order placement hook
├── lib/
│   ├── nubra-client.ts             # Nubra REST API client + auth
│   ├── websocket-manager.ts        # WS connect, subscribe, reconnect
│   ├── store.ts                    # Zustand global state
│   └── analytics.ts                # Max Pain, PCR, GEX, VWAP, formatters
└── types/index.ts                  # All TypeScript interfaces
```

---

## Requirements Coverage

| Req ID  | Description                    | Implementation                     |
| ------- | ------------------------------ | ---------------------------------- |
| AUTH-01 | MPIN-based auth                | `NubraClient.authenticate()`       |
| AUTH-02 | Session token in headers       | `Authorization: Bearer <token>`    |
| AUTH-03 | Proactive token refresh        | `SessionManager.scheduleRefresh()` |
| AUTH-04 | Secure credential storage      | `.env.local` environment variables |
| DATA-01 | REST option chain snapshots    | `/api/options-chain` route         |
| DATA-02 | WebSocket streaming            | `NubraWebSocketManager`            |
| DATA-03 | Greeks WebSocket channel       | `ws.subscribeGreeks(tokens)`       |
| DATA-04 | 20-level market depth          | `MarketDepth` type + depth display |
| DATA-05 | Bulk subscriptions             | `ws.subscribe(tokens[])`           |
| PROC-01 | Real-time tick processing      | `applyTick()` in Zustand store     |
| PROC-02 | Greeks computation             | `analytics.ts` + API data          |
| PROC-03 | OI analytics                   | `calculateMaxPain`, `calculatePCR` |
| PROC-04 | Volume aggregation / VWAP      | `calculateVWAP()`                  |
| UI-01   | Interactive option chain table | `OptionChainTable.tsx`             |
| UI-02   | GEX Dashboard                  | `GEXChart.tsx`                     |
| UI-03   | IV Smile/Skew                  | `IVSmileChart.tsx`                 |
| UI-04   | OI Profile chart               | `OIProfileChart.tsx`               |
| UI-05   | OI Tracker & Max Pain          | `StatsRow` + `calculateMaxPain`    |
| UI-06   | Real-time updates (no refresh) | Zustand + WebSocket ticks          |
| UI-07   | PlaceOrder from chain          | `OrderPanel.tsx` + `/api/order`    |
| OPS-01  | Rate limit compliance          | `RateLimiter` (60 req/min)         |
| OPS-02  | Connection resilience          | Exponential backoff reconnect      |
| OPS-03  | Resource management            | `ws.disconnect()` cleanup          |
| OPS-04  | 429 handling                   | Retry-After backoff in client      |

---

## Adapting to Nubra's Actual API

The `NubraClient` in `src/lib/nubra-client.ts` is wired to Nubra's documented endpoints. Adjust these if the API paths differ:

```ts
// Authentication
POST /auth/login          → { client_id, mpin }
GET  /auth/ws-token       → { ws_token }

// Market data
GET  /market/option-chain?underlying=NIFTY&expiry=2025-03-27
GET  /market/expiries?underlying=NIFTY

// Orders
POST /orders              → PlaceOrderRequest
GET  /orders              → { orders: Order[] }
```

### WebSocket Protocol

The `NubraWebSocketManager` sends JSON subscription messages:

```json
{ "type": "subscribe", "tokens": ["NFO:NIFTY25MAR24000CE", ...], "mode": "full" }
{ "type": "subscribe", "tokens": [...], "mode": "greeks" }
```

And expects tick payloads:

```json
{ "type": "ticks", "data": [{ "instrument_token": "...", "ltp": 245.3, "oi": 150000, "greeks": { "iv": 14.2, "delta": 0.42, ... } }] }
```

Adjust `handleMessage()` in `websocket-manager.ts` if Nubra uses a binary protocol or different JSON schema.

---

## Production Deployment

### Redis (optional but recommended)

For multi-instance deployments, use Redis pub/sub instead of direct WebSocket connections:

```bash
# Add to .env.local
REDIS_URL=redis://localhost:6379
```

The backend subscribes to Nubra WS once, publishes ticks to Redis, and each Next.js server instance subscribes from Redis.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables (production)

Set these in your deployment platform (Vercel, Railway, etc.):

```
NUBRA_EMAIL=...
NUBRA_TOTP_SECRET=...
NUBRA_MPIN=...
NUBRA_DEVICE_ID=...
NUBRA_BASE_URL=https://api.nubra.io
NUBRA_WS_URL=wss://stream.nubra.in/v1/ws
```

---

## License

MIT
