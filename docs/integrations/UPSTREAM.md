# Upstream Source Management

Openfund vendors selected third-party source projects for future integration.

## LuxAlgo Vela

- Upstream: https://github.com/LuxAlgo/Vela
- Local path: `vendor/vela`
- Upstream HEAD observed during setup: `57d011ab796c541cbb9e1282722ad6cd521c8f55`
- License files: `vendor/vela/LICENSE`, `vendor/vela/NOTICE`
- Openfund integration path: `packages/openfund-charts`
- Status: Source imported; integration not implemented.

## Gains Network SDK

- Upstream: https://github.com/GainsNetwork-org/sdk
- Local path: `vendor/gains-sdk`
- Upstream HEAD observed during setup: `aa7a05a4919ba6667513c128e6bf5806af0be181`
- License file: `vendor/gains-sdk/LICENSE`
- Openfund integration path: `packages/openfund-gains-adapter`
- Status: Source imported; integration not implemented.

## Development Rules

1. Preserve original licenses, notices, and copyright information.
2. Keep Openfund-specific integration code in `packages/`.
3. Avoid modifying `vendor/` unless necessary.
4. Document every upstream update and its exact source commit.
5. Review upstream changes before replacing vendored source.
6. Update integration documentation whenever an implementation changes.
7. Never claim an integration is operational until verified through testing.

## Upstream Updates

Before updating vendored code:

1. Identify the exact upstream commit or release.
2. Review changes, licenses, and compatibility.
3. Update the vendored source in a dedicated feature branch.
4. Run applicable tests.
5. Record the source revision and changes in the Pull Request.
