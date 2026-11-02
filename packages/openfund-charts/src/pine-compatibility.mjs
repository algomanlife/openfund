// PineTS 0.13.1 slices stop before the nested PAC getTFData -> reqSeq call.
// Use its full-script secondary execution path, preserving the calculations.
export function installPineCompatibility(Indicator) {
  const original = Indicator.prototype.prepare;
  if (original.openfundCompatibility) return;
  function prepare(...args) {
    const prepared = original.apply(this, args);
    if (typeof this.source === 'string' && this.source.includes('getTFData (timeframeInfo timeframeInfoF')) {
      delete prepared.ltfSlices;
      delete prepared.fn._ltfSlices;
    }
    return prepared;
  }
  prepare.openfundCompatibility = true;
  Indicator.prototype.prepare = prepare;
}
