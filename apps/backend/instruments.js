/** Explicit virtual-USD linear contracts; never imply futures lots or FX conversion. */
import { D } from "./trading-math.js";
const groups = new Set(["crypto", "forex", "stocks", "indices", "commodities"]);
export function instrumentSpec(meta, market) {
  const fail = (reason) => {
    throw Object.assign(new Error(reason), { status: 400 });
  };
  if (!meta || !groups.has(String(meta.group).toLowerCase()))
    fail("unsupported_instrument");
  const quote = meta.quote || market.split("/")[1];
  if (quote !== "USD") fail("unsupported_quote_conversion");
  if (meta.contractSize != null && !D(meta.contractSize).eq(1))
    fail("unsupported_contract_size");
  const quantityPrecision =
    meta.sizePrecision == null ? 10 : Number(meta.sizePrecision);
  if (
    !Number.isInteger(quantityPrecision) ||
    quantityPrecision < 0 ||
    quantityPrecision > 10
  )
    fail("unsupported_quantity_precision");
  return {
    model: "linear_virtual_usd_v1",
    quote: "USD",
    contractSize: "1",
    quantityPrecision,
    minMargin: D(meta.minCollateralUsd || 1),
    minNotional: D(meta.minPositionUsd || 0),
    maxLeverage: D(meta.maxLeverage || 100),
  };
}
