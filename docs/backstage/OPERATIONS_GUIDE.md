# Openfund Backstage operations guide

This is the first reviewable stage of the operations application in
`apps/backstage/operations`. Editorial administration uses the existing
Directus login and workspace.

## Provision the owner

1. Choose a dedicated owner identifier made of letters, digits or `._@-`.
   Use a unique high-entropy password from the owner's password manager.
2. Run `node apps/backstage/operations/provision.js` in a private terminal
   with the password supplied on stdin. For example, in Bash:

   ```bash
   read -rs -p 'Backstage owner password: ' backstage_password
   printf '\n'
   printf '%s' "$backstage_password" | node apps/backstage/operations/provision.js
   unset backstage_password
   ```

3. Store the returned verifier as a secret named
   `BACKSTAGE_PASSWORD_VERIFIER`. Set `BACKSTAGE_OWNER` to the chosen
   identifier. Supply `BACKSTAGE_BACKEND_TOKEN` from the selected backend's
   existing operator secret. Treat the verifier and token as secrets.
4. Configure the three origins from the
   [environment reference](../deployment/ENVIRONMENT.md#backstage-operations-service).
   Set `BACKSTAGE_ORIGIN=https://backstage.openfi.cloud` for production.
   Set `BACKSTAGE_BACKEND_ORIGIN=https://openfi.cloud` and
   `BACKSTAGE_DIRECTUS_ORIGIN=https://openfund-cms.onrender.com`.
   Local loopback HTTP
   is available outside production. On a local test runtime, set the six
   Backstage variables and run `npm --prefix apps/backstage ci`, then
   `npm --prefix apps/backstage start`.

## Add operators and access levels

The `BACKSTAGE_BACKEND_TOKEN` (the backend's `ADMIN_API_TOKEN`) is a service
credential for Backstage only; no person holds it. Each person signs in to
Backstage with their own operator account, and the backend checks the
operator's role on every admin request.

Roles: `owner` (everything, including operators, runtime/regional controls,
the admin console, tournaments, migration decisions, payment settings and
manual deposit association), `finance` (payments, withdrawals, economy, live
funding, coupons, certificates, partners, rewards), `support` (support and
user status), `content` (guides, campaigns, site search, calendar and the
Directus content workspace) and `viewer` (read only). Every role can
read; changes still need password re-entry.

From a shell with the backend's `DATABASE_URL` (the Render shell of the API
service), create your own owner first, with the same name as
`BACKSTAGE_OWNER`:

```sh
npm --prefix apps/backend run operator -- set <owner-name> owner
npm --prefix apps/backend run operator -- set <name> finance
npm --prefix apps/backend run operator -- list
```

The password is asked on standard input (16 to 256 characters) and only an
scrypt verifier is stored. Creating the first operator switches enforcement
on: from then on an admin request that names an unknown or disabled operator
is refused (`403 operator_unknown_or_disabled`), as is a change outside the
operator's role (`403 operator_role_forbidden`). Disable a person with
`set <name> <role> disabled`; the last active owner cannot be disabled or
demoted. Until the first operator exists, Backstage keeps the single-owner
behaviour.

## Deploy after review

1. Confirm the security review and acceptance results in the pull request.
   Provision all six Backstage variables before starting the service.
2. With owner authorization, review the Blueprint's planned changes.
   Use the existing `openfund-backstage` service and deploy the reviewed
   commit manually. Confirm the live GLOBAL backend includes the challenge
   inspection endpoint and the controlled challenge contract from PRs #126
   and #125. Verify its SHA at `/version` and follow the
   [official backend release procedure](../deployment/RELEASES.md) if it
   needs an update. The backend's `ADMIN_API_TOKEN` must match
   `BACKSTAGE_BACKEND_TOKEN` on the Backstage service. It runs one instance so session revocation is immediate within
   that instance. Keep automatic deploys off.
3. In Render, confirm `backstage.openfi.cloud` is the custom domain and
   the Render subdomain is disabled. Use the CNAME target Render lists for
   that service. Verify DNS and the managed TLS certificate in Render.
   See [Render's domain configuration](https://render.com/docs/custom-domains).
4. Check `/health`, then sign in at the custom HTTPS origin. Verify the
   default Render hostname and a signed-out browser cannot access records.
   Check both languages, and review log retention and owner credential
   recovery before granting access to production data. Backstage writes
   structured security events to service logs. Configure restricted,
   externally retained logs if durable security audit retention is required.

A successful build followed by `Backstage configuration is incomplete or
invalid` indicates that runtime configuration did not pass validation.
Check all six Backstage settings on the service's **Environment** page.
The password verifier is a salted verifier generated by the provisioning
command. Sessions use random server-held identifiers and require no
separate session-secret variable.

## Owner workflow

Use the navigation to open the action counts, trader directory, challenges,
final-pass reviews and payout requests. Search traders by registered wallet
or display name. Open a trader to see linked challenges, purchases and payouts.
Open a challenge to inspect its frozen rules, observed equity, positions and
evaluation history. Open a purchase to inspect payment attempts and verified evidence. In the
support inbox, open a reference to read the submission, private notes and
status history. Select an allowed status and confirm it with a private note.
For a retryable payment attempt, **Retry verification** runs the backend's
existing verifier and reconciliation rules.

Approve or reject an eligible final pass or pending payout by supplying a
decision note and re-entering the owner password. Existing backend checks
determine the outcome. View payout decisions and correspondence from the payout record. Send a reply
or record the outcome of a pending reconsideration. The payout detail shows
the recorded profit, payout amount, trader share, approved recipient and
available settlement evidence. A replicated or fenced account is read-only
for real settlement recording.

### Operations sections (launch completion)

Every change below re-enters the owner password and runs only against the
connected GLOBAL backend.

- **Partner applications:** open an application to review its submission
  and history; start a review, approve with verification evidence (audience
  and content checks for ambassadors, track-record evidence for coaches),
  reject, suspend or reinstate. **Partner commissions** lists earned,
  reversed, paid and pending balances and records a completed commission
  transfer by its reference.
- **Finance:** *Financial position* shows the computed position and can
  refresh the treasury snapshot. *Verified expenses* records an expense with
  its evidence source and reference; a different operator identity must
  verify it (four-eyes), then mark it paid or void it. *Capital reserves* and
  *Obligations* record reserves and liabilities; obligations close as
  settled or void. Paid IB distributions show an approve and record control
  on the payout record; recording an IB payment follows
  `BACKSTAGE_REAL_SETTLEMENT`.
- **Audit trail:** the operational and financial audit logs in one list,
  filtered by trail, action or actor.
- **Traders:** suspend or reactivate a trader with a recorded reason. A
  suspended trader's sessions end and sign-in is refused.
- **Coupons:** *New coupon* creates an inactive commercial coupon (code,
  percent or fixed value, limits, window, eligible plans, sizes, customers);
  activate, disable, edit or revoke it permanently. Pricing locks after the
  first redemption. Controlled test coupons keep their own section.
- **Support inbox:** filter by department; open a message and use *Reply to
  trader*. Replies reach the trader's Inbox and notifications; internal notes
  stay private.
- **Live risk board:** read-only open positions, exposure per market,
  distance to the daily and total loss limits, market-feed freshness and
  engine-loop lag. It never runs or changes the engine.
- **Global search:** a wallet address, support reference, challenge, order
  or payout id, or a transaction hash.
- **Notifications:** what was delivered to whom and whether it was read.

### Content workspace

*Content → Content workspace* edits editorial copy in Directus without
leaving Backstage: choose a page and a language, review the live read-only
preview, pick interface copy or a structured surface field, edit it and
save; then publish or move it back to draft. Only plain text is accepted,
placeholders must match the English source, and financial collections,
links, destinations and contact fields are never editable here.
*Visual mode* opens the same page in the Directus Studio visual editor.
Writes need `BACKSTAGE_DIRECTUS_TOKEN` (a user with the *Backstage Content
Editor* role from `register_backstage_editor.py`); without it the workspace
is read-only.

### Record a real payout transfer

1. Open an approved commercial reward request. Inspect the account, amount,
   destination and Arbitrum One DAI token details.
2. After the transfer is completed externally through the approved treasury
   process, choose **Verify and record settlement**. Enter the actual transfer
   hash, a decision note and the owner password.
3. Review the updated status and the evidence in the payout record. If the
   verifier cannot confirm the finalized transfer, the request stays approved.
   Review the transfer and retry verification with the same genuine hash when
   appropriate.

This screen requires `BACKSTAGE_REAL_SETTLEMENT=true` after security
acceptance. The backend uses its configured treasury sender, frozen recipient
and stored amount for verification. It claims the hash and records the payout
decision using the existing accounting transaction.

With the PR #125 backend available, open **Coupons → Controlled test
challenges** and enter the registered wallet for each model. Re-enter the
password to issue or revoke access. Copy the generated code privately
while the issue dialog is open. The section displays descendants and test
payout outcomes. On an approved controlled payout, **Complete simulated
settlement** sends the dedicated backend action. The backend checks the
classification. Review the result in the decision history.

Use **Language** to switch between English and Persian. Wallet addresses,
transaction hashes and identifiers stay left-to-right. The language and
theme preferences stay on the browser.

## Security and recovery

Sessions expire after 30 minutes of inactivity or eight hours total. Logout,
a fresh login and a service restart revoke the previous session. To recover
access, replace the verifier through the service configuration and restart.
A single process-wide throttling window limits owner authentication attempts,
including password confirmation. Upstream requests are allowlisted and
redirects are refused. No browser-origin CORS grant is configured.

The initial stage uses password confirmation. A separate second factor,
central audit explorer, shared session storage, support messaging and
attachments, commercial coupon writes,
specialized risk inspection, detailed analytics, partner decisions and
cross-region operations remain follow-up work. Current regional data views
show the configured backend's authority only. Mutations require the
authoritative backend to report the GLOBAL region in connected mode.

To withdraw the operations UI, stop the Backstage service and remove its
custom domain through the reviewed deployment procedure. The original
backend and Directus continue to own the business records.
