import { mkdirSync, appendFileSync, readdirSync, statSync, createReadStream, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
const KINDS = new Set(['RAW', 'HEALTH', 'NORMALIZED', 'COMPOSITE', 'CANDLE', 'QUALITY', 'CORRECTION', 'PROVIDER_REFERENCE', 'CONFIGURATION']);
/** Append-only, bounded segments. Exhaustion fails explicitly; it never silently discards audit history. */
export class HistoryStore {
  constructor(directory, { maxSegmentBytes = 8 * 1024 * 1024, maxSegments = 128 } = {}) {
    if (!Number.isInteger(maxSegmentBytes) || maxSegmentBytes < 1024 || !Number.isInteger(maxSegments) || maxSegments < 1) throw new Error('invalid_storage_limits');
    Object.assign(this, { directory, maxSegmentBytes, maxSegments }); mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.sequence = 0; this.hash = 'GENESIS'; this.segment = 0;
    const files = this.files();
    if (files.length > maxSegments) throw new Error('history_capacity');
    for (const file of files) {
      const lines = readFileSync(join(directory, file), 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        const record = JSON.parse(line); this.verify(record); this.sequence = record.sequence; this.hash = record.hash;
      }
      this.segment = Number(file.split('.')[0]);
    }
  }
  files() { return readdirSync(this.directory).filter(f => /^\d{6}\.ndjson$/.test(f)).sort(); }
  digest(record) { return createHash('sha256').update(JSON.stringify(record)).digest('hex'); }
  verify(record) {
    const { hash, ...body } = record;
    if (body.sequence !== this.sequence + 1 || body.previousHash !== this.hash || this.digest(body) !== hash) throw new Error('history_integrity_failure');
  }
  append(kind, data, { dataKind = 'NATIVE', algorithmVersion = 'GAACP-v1', configurationVersion = 'gaacp-research-1', recordedAt = Date.now() } = {}) {
    if (!KINDS.has(kind) || !['NATIVE', 'RECONSTRUCTED', 'PROVIDER_REFERENCE'].includes(dataKind)) throw new Error('invalid_history_kind');
    if (kind === 'PROVIDER_REFERENCE' && dataKind !== 'PROVIDER_REFERENCE') throw new Error('mislabelled_provider_history');
    const body = { sequence: this.sequence + 1, previousHash: this.hash, kind, dataKind, algorithmVersion, configurationVersion, recordedAt, data };
    const record = { ...body, hash: this.digest(body) }, line = JSON.stringify(record) + '\n';
    if (Buffer.byteLength(line) > this.maxSegmentBytes) throw new Error('history_record_limit');
    let file = join(this.directory, String(this.segment).padStart(6, '0') + '.ndjson');
    let size = 0; try { size = statSync(file).size; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (size + Buffer.byteLength(line) > this.maxSegmentBytes) {
      if (this.segment + 1 >= this.maxSegments) throw new Error('history_capacity');
      this.segment++; file = join(this.directory, String(this.segment).padStart(6, '0') + '.ndjson');
    }
    appendFileSync(file, line, { mode: 0o600, flush: true }); this.sequence = record.sequence; this.hash = record.hash; return record;
  }
  async *read({ kind, from = 0, to = Infinity } = {}) {
    let sequence = 0, hash = 'GENESIS';
    for (const file of this.files()) {
      const input = createReadStream(join(this.directory, file));
      const lines = createInterface({ input, crlfDelay: Infinity });
      try {
        for await (const line of lines) {
          if (!line) continue;
          const record = JSON.parse(line), { hash: actual, ...body } = record;
          if (body.sequence !== ++sequence || body.previousHash !== hash || actual !== this.digest(body)) throw new Error('history_integrity_failure');
          hash = actual;
          if ((!kind || record.kind === kind) && record.recordedAt >= from && record.recordedAt <= to) yield record;
        }
      } finally { lines.close(); input.destroy(); }
    }
  }
}
