# Adapted source — drkxbt/charts

- **Upstream repository:** <https://github.com/drkxbt/charts>
- **Reviewed commit SHA:** `7e5f50e999e0a677e3da4b495018517cbd2e50e3` (2026-10-29)
- **License:** MIT, © 2026 drk. [LICENSE](LICENSE) and [NOTICE](NOTICE) are
  byte-identical copies of the upstream files.
- **Shipped notice:** `apps/web-react/public/assets/notices/drkxbt-charts-MIT.txt`
  (LICENSE followed by NOTICE).

## What Openfund uses

| Upstream | Openfund location | Changes |
| --- | --- | --- |
| `heatmap/heatmap.ts` — `squarify` (squarified treemap of Bruls, Huizing and van Wijk) | `apps/web-react/src/features/radar/HeatmapPage.tsx` | Same algorithm, typed for React |
| `heatmap/heatmap.ts` — change-to-colour scale with a ±10% cap, group zoom with Escape to return | same file | Re-implemented with DOM buttons instead of a canvas so tiles are reachable by keyboard, touch and screen readers; colours come from the Openfund theme |

The upstream canvas renderer, `core/`, the candles/line/depth charts, the demo
and its Geist Mono font are **not** used.

The upstream heatmap is a *market treemap*. Openfund presents it as such: it is
not a liquidation heatmap or an order-book liquidity heatmap.
