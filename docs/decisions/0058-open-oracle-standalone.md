# ADR 0058 — Standalone Open Oracle reference-price research

- Status: Accepted within owner-authorized standalone development scope;
  implementation acceptance remains In Progress.
- Context: a complete multi-provider market universe and independently computed
  reference prices must be developed without changing production trading feeds.
- Decision: implement `@openfund/open-oracle` as an isolated Node 26 package with
  typed deterministic GAACP v1, explicit identity evidence, native candles and
  causal audit history. Keep the current terminal data path and the separate
  dormant Solidity protocol unchanged. Use a loopback read-only research API.
- Consequences: provider access, reference semantics, quote equivalence,
  upstream dependencies and usage terms remain independently verifiable gates.
  Confidence is an internal quality indicator; it is not a correctness probability.
  Never infer complete market coverage or successful live validation from fixtures.
- Evidence: [methodology](../research/OPEN_ORACLE_METHODOLOGY.md),
  [validation](../research/OPEN_ORACLE_VALIDATION.md).
