<div align="center">

# OPENFUND

### A Unified Trading Experience

**A branded trading platform combining a custom web experience, professional trading interfaces, wallet connectivity, and planned on-chain demo trading infrastructure.**

**Status: Pre-alpha · Frontend foundation implemented · Integrations under development**

</div>

---

## Overview

Openfund is an independent trading-platform project. Its goal is to combine a distinctive brand and product experience with a custom trading terminal, market visualization, wallet integration, and blockchain-based trading infrastructure.

The initial website, account-related interface, and trading terminal are present in this repository. The longer-term architecture targets Gains Network testnet trading and suitable LuxAlgo Vela charting components. These integrations are **not yet complete**.

## Product Areas

| Area | Objective | Current state |
| --- | --- | --- |
| Website | Branded entry point and product presentation | Initial frontend available |
| Accounts dashboard | Account-related UI and navigation | Initial frontend available |
| Trading terminal | Market and trading interface | Initial frontend available |
| Wallet | Connect supported wallets and networks | Source/dependencies present; end-to-end validation pending |
| Gains integration | Testnet trading and position lifecycle | Research and implementation planned |
| Vela charts | Market charts and data adapters | Evaluation and integration planned |
| Market data | Price feeds, candles, updates | Integration planned |
| Backend | API, synchronization, operational services | Planned |

## Interface Preview

The source pages are `dist/index.html` and `dist/terminal.html`. Real screenshots should be added under `docs/images/` after review for personal or sensitive information.

## Technical Direction

The intended system separates frontend experiences from trading execution, wallet connectivity, market-data adapters, and chart rendering. It is not yet a production-grade trading platform.

- **Frontend:** HTML, CSS, JavaScript, React (wallet-related source)
- **Wallet stack:** RainbowKit, wagmi, viem, TanStack Query
- **Tooling:** esbuild dependency; no complete build pipeline currently configured
- **Trading target:** Gains Network contracts on supported testnets, subject to verification
- **Charting target:** LuxAlgo Vela, subject to technical and licensing evaluation

See [Architecture](docs/architecture/ARCHITECTURE.md), [Gains Integration](docs/integrations/GAINS.md), and [Vela Integration](docs/integrations/VELA.md).

## Branding

Openfund's existing brandbook, logo variants, and project typography are preserved in `brand/`. Runtime copies remain in `dist/assets/` to avoid breaking the existing frontend.

- [Brand assets and usage notes](brand/README.md)
- [Brandbook archive](brand/brandbook/Openfund-brandbook.zip)
- [Design and content notes](DESIGN_AND_CONTENT_NOTES.md)

Brand narratives, mission and vision wording should be checked against the approved brandbook before being treated as final. Third-party fonts, images, and logos require independent rights verification.

## Project Documentation

| Document | Purpose |
| --- | --- |
| [Product vision](docs/product/VISION.md) | Product concept, audience, experience principles |
| [Architecture](docs/architecture/ARCHITECTURE.md) | Current implementation and target components |
| [Gains integration](docs/integrations/GAINS.md) | Demo-trading integration plan and unknowns |
| [Vela integration](docs/integrations/VELA.md) | Chart integration and market-data constraints |
| [Roadmap](docs/development/ROADMAP.md) | Phases, deliverables and acceptance criteria |
| [Branding](brand/README.md) | Assets, sources and governance |

## Repository Layout

```text
openfund/
├── brand/                   # Brandbook, logos, typography, imagery
├── docs/                    # Product, architecture, integrations, roadmap
├── dist/                    # Current runnable frontend files
│   ├── index.html
│   ├── terminal.html
│   └── assets/
├── src/wallet.jsx           # Wallet-related React source
├── DESIGN_AND_CONTENT_NOTES.md
├── package.json
└── README.md
```

A monorepo structure with `apps/` and `packages/` is a future refactor, **not the current repository layout**.

## Run Locally

```bash
# Requires access to this private repository
git clone https://github.com/algomanlife/openfund.git
cd openfund
npm ci
python3 -m http.server 4173 --bind 127.0.0.1
```

- Website: http://127.0.0.1:4173/dist/
- Accounts view: http://127.0.0.1:4173/dist/#accounts
- Trading terminal: http://127.0.0.1:4173/dist/terminal.html

The current `package.json` does not provide a complete build/start/test workflow. The Python command serves existing frontend files only.

## Roadmap

1. **Foundation:** preserve the existing frontends, organize branding and documentation, establish source-control conventions.
2. **Wallet and testnet:** validate wallet connectivity, Arbitrum Sepolia configuration, and supported Gains deployments.
3. **Demo trading:** implement contract interactions, transaction feedback, position/order synchronization, and error handling.
4. **Market data:** integrate supported price feeds, candles, and real-time updates with documented limitations.
5. **Charting:** evaluate Vela licensing and architecture, connect data adapters, and validate chart features.
6. **Platform maturity:** modularize code, add testing, CI/CD, backend services, observability, and deployment environments.

Detailed milestones: [Roadmap](docs/development/ROADMAP.md).

## Security and Limitations

Never commit private keys, seed phrases, API secrets, or production credentials. Contract addresses and testnet support must be verified against current official documentation. Demo trading must be clearly distinguished from real-money trading. Market depth and footprint features require underlying data that may not be available from Gains.

## Independence and Licensing

Openfund is independent. References to Gains Network, LuxAlgo Vela, Arbitrum, and wallet providers do not imply endorsement, partnership, or completed integration. The repository's project-wide license has not been finalized. Third-party source and assets remain subject to their own licenses.

---

<div align="center"><strong>OPENFUND — Building a Unified Trading Experience.</strong></div>
