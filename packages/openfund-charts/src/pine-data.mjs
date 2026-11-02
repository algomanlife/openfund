// Missing oracle volume is Pine na, rather than the addon's default zero.
const unknownVolume = bars => bars.map(bar => bar.volume == null ? { ...bar, volume: NaN } : bar);

export function preserveUnknownVolume(engine) {
  return {
    language: engine.language,
    capabilities: engine.capabilities,
    prepare: (source, id) => engine.prepare(source, id),
    execute(request, handlers) {
      return engine.execute({
        ...request,
        bars: unknownVolume(request.bars),
        getBars: () => unknownVolume(request.getBars ? request.getBars() : request.bars),
        ...(request.fetchSeries ? {
          fetchSeries: async (...args) => unknownVolume(await request.fetchSeries(...args)),
        } : {}),
      }, handlers);
    },
    terminate: () => engine.terminate?.(),
  };
}
