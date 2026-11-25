# Open Oracle local development supplement

The standalone `packages/open-oracle/` package is separate from the deployed
application API. It requires Node 26 and its own `npm ci`. Run package-local
`typecheck`, `lint`, `test`, `test:socket`, `benchmark`, `calibrate` and
`validate:live` commands. The main CI adds isolated deterministic and socket
validation; a separate manually dispatched workflow collects public data.

This supplement is repository documentation only; it does not publish CMS copy,
change application routes or enable the production terminal. Public-page seed
and translated editorial updates are deferred with the production integration.

Source baseline inspected: `8b9e4b7ba1b7d0dc57005148307e64f33578e265`.
See [the interface and acceptance limits](../integrations/OPEN_ORACLE.md) and
[actual validation results](../research/OPEN_ORACLE_VALIDATION.md).
