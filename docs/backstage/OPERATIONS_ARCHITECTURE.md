# Backstage operations architecture

## Repository findings

The reviewed integration base is `a439f24`. Open PR #124 owns visual CMS
editing and changes editorial assets under `apps/backstage`. Open PR #125
owns controlled coupons, frozen test lineage rules, and simulated payout
completion. Backstage operations uses separate files and can be reviewed
before either PR. Controlled test controls require the merged #125 contract.

The current backend owns trader SIWE identity, challenge checkout and
DePay evidence, immutable catalog snapshots, the evaluation engine and
funded account provisioning. Its admin routes already query traders,
challenges, payment attempts, withdrawals, coupon reports, support
submissions, partner applications and the financial position. Final
evaluation reviews use the named operator workflow. Payments and real
withdrawals preserve on-chain verification. The public support form
writes structured submissions. It has no authenticated trader chat
protocol or protected attachment store. Regional synchronization
projects remote rows and fences account mutations at the home region.

## Initial integration

Run an independent, same-origin Backstage service. It authenticates one
explicitly provisioned owner with a password verifier and uses a server-held
credential for a fixed list of operations on the GLOBAL backend. The
application holds only temporary sessions and login throttles. Business
records stay with the existing backend. Source and
destination are configured by the operator. Browser-supplied URLs and
credentials never reach the backend integration.

The first slice covers login, operational directories, linked trader
records, read-only challenge snapshots, observed equity, positions and
password-confirmed final-pass and payout decisions. It uses
the backend's existing status vocabulary and carries an operation
correlation ID in the Backstage log. Use the existing backend operator
decision records as the authoritative business audit trail.

Future stages need specialized risk review and investigation workflows,
coupon writes, typed notifications, contact follow-up and authenticated
support threads. Record those capabilities independently as they ship.
Directus remains the editor and requires its own login when opened from
Backstage.
