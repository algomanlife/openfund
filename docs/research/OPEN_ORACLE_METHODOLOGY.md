# GAACP v1 methodology

## Experimental configuration

GAACP means Gains-Anchored Adaptive Composite Pricing. Versioned defaults are
research parameters, not verified universal production policies. Pure pricing
functions accept an explicit evaluation boundary and configuration; source
policies may override half-life and age limits. The engine accepts separately
versioned per-market configurations for different instruments and sessions.

| Parameter | Initial value |
| --- | --- |
| Base weights: Gains / Hyperliquid / GMX | 0.40 / 0.30 / 0.30 |
| Freshness half-life / maximum age | 2 seconds / 10 seconds |
| Cross-source alignment | 2 seconds |
| Reliability window | 300 seconds |
| Robust dispersion floor | 0.0001 log-price units |
| Huber threshold | 2.5 |
| Hard deviation | 0.05 absolute log-price residual |
| Dual divergence tolerance | 0.01 absolute log-price spread |
| Event watermark | 2 seconds |
| Maximum event-ahead-of-receipt skew | 1 second; larger skew is rejected |
| Receipt-only price timestamps | Ineligible by default |
| Arithmetic | 24 decimal places, integer fixed point; half away from zero |

## Eligibility and freshness

A source has `E_i = 1` only when its price is a strictly positive valid decimal,
identity is verified, quote is valid, semantics are comparable, timestamp is
valid, its age is below policy maximum and both event/receipt times are known
at evaluation. Source observations outside cross-source alignment are excluded.

```text
age_i = max(0, evaluationTime - observationTime)
F_i = exp(-ln(2) * age_i / halfLife_i)
```

No missing index is substituted with a mark or last trade. Unverified quote
conversion and receipt-only timestamps cannot silently enter the default price.

## Reliability

```text
A_i = successful expected observations / expected observations
V_i = valid observations / received observations
T_i = timely observations / received observations
R_i = clamp(0.50*A_i + 0.30*V_i + 0.20*T_i, 0, 1)
```

No expected observations yields provisional `R_i = 1` with `calibrated = false`.
A window with expected but no received observations yields zero reliability.
Known closed-market periods are excluded. A 300-second rolling window with a
sample cap bounds memory. Health expected-arrival samples are retained for
causal history replay. Sessions without documented calendars remain unknown.

## Robust center and deviation

For three eligible comparable providers:

```text
M = median(P_i)
r_i = ln(P_i) - ln(M)
MAD = median(abs(r_i - median(r)))
sigma = max(1.4826*MAD, sigmaFloor)
z_i = abs(r_i)/sigma
D_i = 1 if z_i <= k; otherwise k/z_i
```

Subtracting logarithms avoids underflow when prices span extreme scales.
A hard outlier may be excluded only when two agreeing peers carry explicit
independence evidence and are not in the same documented dependency group.
Without sufficient evidence, the evaluation is divergent and publishes no
fresh reference. After exclusion, recalculate the eligible set and pricing mode.
For a remaining dual set the triple-source deviation coefficients reset to one.

For two sources, `spread = abs(ln(P_1)-ln(P_2))`. Above tolerance, preserve both
prices, report `DIVERGENT` and zero confidence, and optionally carry only a
clearly stale previous reference. Baseline preference never establishes truth.

## Dependencies and normalized composite

Unknown independence uses `I_i = 1` and status `UNVERIFIED`. Documented shared
upstream groups with `n` eligible members use experimental `I_i = 1/n`.
Evidence must be present; price correlation alone never assigns a group.

```text
W_i = E_i * B_i * F_i * R_i * D_i * I_i
w_i = W_i / sum(W)
P_OPEN_ORACLE = sum(w_i * P_i)
```

Zero total weight produces no fresh price. Normalized decimal weights sum
exactly to one: the rounding residue is assigned to the largest raw weight.
Final price is rounded once after summing integer weighted products. Single
source outputs equal the source price. Equal inputs reproduce that price.
Convexity bounds are tested against the eligible minimum and maximum.
No offsets, artificial volatility, random adjustments or smoothing are added.

Logarithms use range reduction by powers of two and the odd atanh series;
exponentials use range reduction, Taylor expansion and repeated squaring.
Every operation uses integer arithmetic at scale `10^24`, with bounded series
iterations and a one-unit truncation stop. This is reproducible finite-precision
numerics; a globally proven arbitrary-precision transcendental error bound is
not claimed. Tests check independent JavaScript reference values across scales;
JavaScript floating point is never used for monetary aggregation.

## Confidence

```text
Q = sum(w_i * F_i * R_i * D_i * I_i)
C = clamp(100 * coverageFactor * Q, 0, 100)
coverageFactor = 1.00 / 0.80 / 0.50 / 0.00 for 3 / 2 / 1 / 0 providers
```

Confidence has its own `quality-v1` version. It is an internal quality indicator,
not a statistically calibrated probability. Divergent, stale, closed and
unavailable outputs have zero confidence. Diagnostics include age, source
coverage, residuals, every coefficient, dependency status and original prices.

## Verification and sensitivity

The requested base example produces `95,015` from `95,000`, `95,100` and
`94,950`; without GMX the base weights renormalize to `4/7` and `3/7`.
The deterministic suite tests all availability combinations, dual disputes,
independent outlier evidence, exact weight sums, convexity and replay identity.

[Measured synthetic sensitivity](../../packages/open-oracle/benchmarks/calibration.md)
compares initial weights, equal weights, median, freshness-only adjustments,
robust adjustments and every leave-one-source-out case. The report records
availability, dispersion, staleness, HHI concentration and source-loss
price discontinuities. These scenarios are not a live calibration dataset or
accuracy ground truth. Parameters remain unchanged. Live empirical calibration,
external accuracy evidence and source-specific session-policy tuning remain open.
