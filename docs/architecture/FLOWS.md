# System flows

These diagrams describe the current repository. Protocol routing and live perpetual execution are not implemented connections.

## Authentication

Wallet connection precedes SIWE. Only the backend creates an owned application session.

```mermaid
sequenceDiagram
  participant W as Wallet
  participant B as React browser
  participant A as Node SIWE API
  participant D as PostgreSQL
  B->>W: Connect and request product network
  B->>A: POST /auth/nonce
  A->>D: Store address-bound nonce with expiry
  A-->>B: Nonce
  B->>W: Sign EIP-4361 message
  W-->>B: Signature or rejection
  B->>A: POST /auth/verify
  A->>A: Validate domain URI time chain and signature
  A->>D: Consume unused nonce atomically
  A->>D: Find user and store hashed session
  A-->>B: HttpOnly session cookie
  B->>A: Owned product requests with cookie
  B->>A: Logout on disconnect or account switch
  A->>D: Revoke session
```

## Trading lifecycle

Prop execution is simulated. Rejection and retry states do not create duplicate financial events.

```mermaid
flowchart TD
  Submit[Prop order intent and idempotency key] --> Auth[Session ownership and request validation]
  Auth --> Retry{Owned key already used?}
  Retry -->|same payload| Stored[Return recorded result]
  Retry -->|new request| Risk[Fresh server mark and fee-aware margin check]
  Risk --> Kind{Order type}
  Kind -->|market| Fill[Spread-adjusted simulated fill]
  Kind -->|limit or stop| Pending[Persist pending order]
  Pending --> Trigger[Engine crossing and fresh risk recheck]
  Trigger --> Fill
  Fill --> Commit[Atomic position and ledger commit]
  Commit --> Monitor[Engine SL TP liquidation monitoring]
  Monitor --> Close[Full or proportional partial close]
  Close --> Ledger[Atomic settlement and provenance]
  Commit --> SSE[Owned SSE state update]
  Ledger --> SSE
```

## Market data

Browser chart prices and server execution marks have separate freshness checks. Wallet records use native Gains endpoints.

```mermaid
flowchart LR
  G[Gains REST and WS] --> Browser[Browser Gains adapter]
  Browser --> Vela[Vela candles and current chart]
  Browser --> Markets[Markets discovery and freshness UI]
  G --> Server[Backend market-data.js]
  Server --> Fresh{Fresh valid mark?}
  Fresh -->|yes| Engine[Prop validation and monitoring]
  Fresh -->|no| Unknown[Unknown valuation and execution rejection]
  Wallet[Gains wallet endpoints] --> Read[gains-portfolio.js session wallet reads]
  Read --> Perp[Perpetual records and provider stats]
```

## Deployment

Three Render resources share a region. Blueprint apply and deployed acceptance remain external operations.

```mermaid
flowchart TB
  Git[GitHub reviewed main] --> Build[Render openfund build]
  Build --> Web[React assets at site root]
  Build --> API[Node API one process]
  API --> Migrate[Additive schema migration at startup]
  Migrate --> DB[(openfund-db PostgreSQL 17)]
  CMS[openfund-cms Directus 11.17.4] --> DB
  CMS --> Disk[5 GB uploads disk]
  API --> Health[DB-aware /health]
  CMS --> CMSHealth["/server/ping"]
  CI[CI checks] -.->|validation evidence; no apply| Git
```

[System architecture](ARCHITECTURE.md) · [Product contracts](PRODUCT_TERMINALS.md) · [Render runbook](../deployment/RENDER.md)
