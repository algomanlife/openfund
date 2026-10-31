# Openfund

**Openfund** is an independent, brand-led project exploring a unified web trading interface, interactive charts, wallet connectivity and testnet-oriented trading workflows. This repository is the single source of truth for product planning, frontend prototypes, integration architecture and design assets.

> **Status:** Early-stage prototype and architecture preparation. Do not interpret a dependency, directory or design document as a working integration. No production trading functionality is claimed.

## What exists today

- Existing landing/account frontend in `dist/index.html` and associated assets.
- Existing terminal prototype in `dist/terminal.html`.
- Source files in `src/` and an npm project at repository root.
- Vela package dependency may be installed; its presence alone does not constitute UI integration.
- Brandbook archive and selected visual assets, when present, organized in `brand/`.
- Architecture and integration specifications for future agents in `docs/`.

## What is planned (not yet implemented)

- Embedded LuxAlgo Vela charting with Openfund design integration.
- Gains Network market-data adapter and testnet-only wallet/trade lifecycle integration after official API/contract verification.
- Real-time portfolio, orders, positions, account state and transaction reconciliation.
- Shared UI design system, modular applications, backend services, automated tests and deployment.

## Repository map

| Path | Purpose | Status |
| --- | --- | --- |
| `dist/` | Current static frontend and terminal | Existing prototype; preserve |
| `src/` | Existing frontend source | Existing; inspect before modifying |
| `apps/web/` | Future account/landing application boundary | Scaffold only |
| `apps/terminal/` | Future trading terminal application boundary | Scaffold only |
| `packages/openfund-charts/` | Vela adapter boundary | Specification only |
| `packages/openfund-gains-adapter/` | Gains adapter boundary | Specification only |
| `packages/openfund-ui/` | Shared design system boundary | Specification only |
| `brand/` | Brand assets and source archive | Available files copied if present |
| `docs/` | Product, architecture, integration and delivery specs | Documentation |

## Local preview

From the repository root, if Python 3 is installed:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/dist/` for the landing page and `http://127.0.0.1:4173/dist/terminal.html` for the terminal prototype. This preview does **not** imply that wallet or trading integrations work.

Install existing npm dependencies using `npm install` as appropriate; inspect `package.json` for actual scripts. No build command is promised until verified.

## Product and engineering documentation

- [Vision and scope](docs/product/VISION.md)
- [Feature status](docs/product/FEATURE_STATUS.md)
- [System architecture](docs/architecture/ARCHITECTURE.md)
- [Vela integration contract](docs/integrations/VELA.md)
- [Gains integration contract](docs/integrations/GAINS.md)
- [Design system](docs/design/DESIGN_SYSTEM.md)
- [Roadmap](docs/development/ROADMAP.md)
- [Security guidelines](docs/security/SECURITY.md)
- [Agent instructions](AGENTS.md)
- [Change history](CHANGELOG.md)

## Contribution workflow

Use task-specific branches, open Pull Requests to `main`, document verification, and update feature status and changelog for meaningful changes. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). The GitHub repository is canonical; do not maintain disconnected agent copies.

## Third-party technology and rights

Openfund is independent of LuxAlgo, Gains Network and Arbitrum. Product names are used descriptively and do not indicate affiliation. Third-party components retain their own licenses, copyright notices, trademarks and attribution requirements. Verify upstream terms before bundling, modifying or distributing third-party source. Openfund's own repository-wide license has not yet been finalized; do not assume that all assets or code are freely reusable.

## Safety and limitations

The project is not a production trading service, investment recommendation or security audit. Do not place real funds or secrets in test configurations. Never claim a live integration without a reproducible test and verified network configuration.
