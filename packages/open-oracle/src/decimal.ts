/** 24 fractional decimal places. Division rounds half away from zero.
 * Log/exp use integer series with range reduction, bounded iteration and
 * an absolute truncation tolerance of 1e-24. Monetary inputs never use Number.
 */
export const SCALE = 10n ** 24n;
export function divRound(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new RangeError('zero_denominator');
  const negative = (n < 0n) !== (d < 0n);
  const a = n < 0n ? -n : n, b = d < 0n ? -d : d;
  const q = (a + b / 2n) / b;
  return negative ? -q : q;
}
export function decimal(input: string | number): bigint {
  const s = String(input);
  if (s.length > 128 || !/^[+-]?\d+(?:\.\d{1,24})?$/.test(s)) throw new RangeError('invalid_decimal');
  const negative = s.startsWith('-'), unsigned = s.replace(/^[+-]/, '');
  const [a = '0', b = ''] = unsigned.split('.');
  return (BigInt(a) * SCALE + BigInt(b.padEnd(24, '0'))) * (negative ? -1n : 1n);
}
export function format(n: bigint): string {
  const sign = n < 0n ? '-' : '', a = n < 0n ? -n : n;
  const fraction = (a % SCALE).toString().padStart(24, '0').replace(/0+$/, '');
  return sign + (a / SCALE).toString() + (fraction ? '.' + fraction : '');
}
export const mul = (a: bigint, b: bigint): bigint => divRound(a * b, SCALE);
export const divide = (a: bigint, b: bigint): bigint => divRound(a * SCALE, b);
export const abs = (a: bigint): bigint => a < 0n ? -a : a;
export const clamp = (a: bigint): bigint => a < 0n ? 0n : a > SCALE ? SCALE : a;
export const LN2 = 693147180559945309417232n;
export function ln(a: bigint): bigint {
  if (a <= 0n) throw new RangeError('log_domain');
  let x = a, exponent = 0n;
  while (x >= SCALE * 2n) { x = divRound(x, 2n); exponent++; }
  while (x < SCALE) { x *= 2n; exponent--; }
  const y = divide(x - SCALE, x + SCALE), y2 = mul(y, y);
  let term = y, sum = 0n;
  for (let k = 1n; k <= 401n; k += 2n) {
    const increment = divRound(term, k); sum += increment;
    if (abs(increment) <= 1n) break;
    term = mul(term, y2);
  }
  return 2n * sum + exponent * LN2;
}
export function exp(a: bigint): bigint {
  if (abs(a) > 64n * SCALE) throw new RangeError('exp_domain');
  const negative = a < 0n;
  let x = abs(a), reductions = 0;
  while (x > SCALE / 2n) { x = divRound(x, 2n); reductions++; }
  let sum = SCALE, term = SCALE;
  for (let k = 1n; k < 100n; k++) {
    term = divRound(mul(term, x), k); sum += term;
    if (term <= 1n) break;
  }
  for (let i = 0; i < reductions; i++) sum = mul(sum, sum);
  return negative ? divide(SCALE, sum) : sum;
}
export function median(values: bigint[]): bigint {
  if (!values.length) throw new RangeError('empty_median');
  const a = [...values].sort((x, y) => x < y ? -1 : x > y ? 1 : 0);
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i]! : divRound(a[i - 1]! + a[i]!, 2n);
}
