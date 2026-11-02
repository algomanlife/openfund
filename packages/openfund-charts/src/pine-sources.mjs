// Runtime module IDs are resolver keys, not filesystem imports in Pine syntax.
export const LIBRARIES = Object.freeze({
  'openfund/Overlayslibrary/1': 'Overlayslibrary.pine',
  'openfund/sdk/1': 'sdk.pine',
});

const replacements = [
  ['ayvaliktrading/EyopsTelegram/1', 'openfund/Overlayslibrary/1', 'LAF'],
  ['ayvaliktrading/JoinUsEyopsTelegram/1', 'openfund/sdk/1', 'kernels'],
];

export function localizeOpenAlgo(source) {
  let result = source;
  for (const [external, local, alias] of replacements) {
    const declaration = `import ${external} as ${alias}`;
    if (result.split(declaration).length !== 2) {
      throw new Error(`Open Algo dependency changed: expected exactly one ${declaration}`);
    }
    result = result.replace(declaration, `import ${local} as ${alias}`);
  }
  if (/^\s*import\s+(?!openfund\/)/m.test(result)) throw new Error('Unregistered Open Algo dependency');
  return result;
}

export function createLibraryResolver(sources) {
  return (path) => {
    if (!Object.hasOwn(LIBRARIES, path)) throw new Error(`Unknown local Pine library: ${path}`);
    const source = sources[path];
    if (typeof source !== 'string' || !source.trim()) throw new Error(`Missing local Pine library: ${path}`);
    return source;
  };
}

export function createCatalog(openAlgo, pac, smc) {
  return [
    { name: 'Open Algo V5', script: localizeOpenAlgo(openAlgo) },
    { name: 'Price Action Concepts', script: pac },
    { name: 'Smart Money Concepts', script: smc },
  ].map(entry => ({ ...entry, language: 'pine', category: 'Openfund', enabled: false }));
}
