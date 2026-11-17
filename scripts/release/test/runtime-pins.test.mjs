import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runtimePins } from '../manifest.mjs';
import { root, json } from '../lib.mjs';

test('runtime pins derive from render.yaml and the backend engine, with no hardcoded literals', () => {
  const blueprint = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  const pins = runtimePins();
  const nodeVersion = blueprint.match(/-\s*key:\s*NODE_VERSION\s*\n\s*value:\s*"?(\d+)(?:\.\d+)*"?/)[1];
  const postgres = blueprint.match(/postgresMajorVersion:\s*"?(\d+)"?/)[1];
  const image = blueprint.match(/url:\s*(?:docker\.io\/)?(directus\/directus:[0-9A-Za-z.\-]+)/)[1];
  assert.equal(pins.nodeMajor, Number(nodeVersion));
  assert.equal(pins.postgresMajor, Number(postgres));
  assert.equal(pins.directusImage, image);
  const engine = json(path.join(root, 'apps/backend/package.json')).engines.node;
  assert.equal(String(pins.nodeMajor), engine.match(/(\d+)/)[1]);
  const manifestSource = fs.readFileSync(path.join(root, 'scripts/release/manifest.mjs'), 'utf8');
  assert.ok(!/nodeMajor\s*:\s*\d/.test(manifestSource), 'nodeMajor must not be a literal');
  assert.ok(!/directusImage\s*:\s*'/.test(manifestSource), 'directusImage must not be a literal');
  assert.ok(!manifestSource.includes('11.9.1'), 'stale Directus pin must not reappear');
});

test('runtime pins reject a blueprint that disagrees with the backend engine', () => {
  const blueprint = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  assert.throws(() => runtimePins({ renderYaml: blueprint, backendEngines: '>=22' }), /must agree/);
  assert.throws(() => runtimePins({ renderYaml: 'services: []', backendEngines: '>=26' }), /must pin/);
});
