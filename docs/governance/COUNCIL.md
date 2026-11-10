# Community Council

Policy source: [GOVERNANCE.md](../../GOVERNANCE.md) sections 4, 5 and 6.

## Structure

A term has exactly ten seats: two for each of the five constituencies. Creating a
term creates all ten seats; the database refuses a third seat in a constituency.

| Constituency | Key |
|---|---|
| Verified Brand Ambassadors | `ambassador` |
| Verified Trading Coaches | `coach` |
| Community Traders | `community_trader` |
| Funded Traders | `funded_trader` |
| Community and Social Media Moderators | `moderator` |

A term lasts six calendar months, computed in UTC from its start. Only one term can
be active. Activating a term ends the previous one, and memberships end with their term.

## Eligibility

Eligibility is a management-verified record for a user and constituency. It needs an
evidence reference (a pointer to the review record, never personal data), can expire,
and can be revoked. A reviewer can assign a **person reference** shared by the wallets
that belong to one person.

Self-declaration is never enough. A read-only signal about a user's challenge history
is available to administrators, but it cannot qualify anyone. There is no registry for
ambassadors, coaches or funded traders that governance can read automatically on the
current base; see [GOVERNANCE.md](../../GOVERNANCE.md) section 5.

## Appointment

Only company management appoints. An appointment checks that:

1. the seat's term is planned or active;
2. the account is active;
3. verified, unexpired eligibility exists for exactly that constituency;
4. the person (wallet or person reference) holds no other active seat;
5. the seat is free;
6. the person is not a governance reviewer or administrator.

The membership records the method (appointed or elected), the appointing actor, the
term dates and an optional public display name. **A name is public only when consent
is recorded.** Otherwise the page shows "Seated — name not published".

## Revocation and expiry

Management can revoke a membership with a reason. Expired and revoked members lose
voting rights immediately because voting checks live membership state, not only the
snapshot taken when voting opened.

## Public view

The Governance page shows each seat as seated or vacant, the term dates, the
membership type and a participation summary computed from real vote records. With no
active term it says that no council has been seated. It never invents members.
