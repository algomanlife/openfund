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
   Set `BACKSTAGE_ORIGIN=https://backstage.openfund.cloud` for production.
   Use the authoritative GLOBAL backend and existing Directus HTTPS origins. Local loopback HTTP
   is available outside production. On a local test runtime, set the six
   Backstage variables and run `npm --prefix apps/backstage ci`, then
   `npm --prefix apps/backstage start`.

## Deploy after review

1. Confirm the security review and acceptance results in the pull request.
   Provision all six Backstage variables before starting the service.
2. With owner authorization, review the Blueprint's planned changes.
   Apply the new `openfund-backstage` service and deploy the reviewed commit
   manually. It runs one instance so session revocation is immediate within
   that instance. Keep automatic deploys off.
3. In Render, confirm `backstage.openfund.cloud` is the custom domain and
   the Render subdomain is disabled. Use the CNAME target Render lists for
   that service. Verify DNS and the managed TLS certificate in Render.
   See [Render's domain configuration](https://render.com/docs/custom-domains).
4. Check `/health`, then sign in at the custom HTTPS origin. Verify the
   default Render hostname and a signed-out browser cannot access records.
   Check both languages, and review log retention and owner credential
   recovery before granting access to production data. Backstage writes
   structured security events to service logs. Configure restricted,
   externally retained logs if durable security audit retention is required.

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
or record the outcome of a pending reconsideration.

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
attachments, commercial coupon writes, real settlement UI,
specialized risk inspection, detailed analytics, partner decisions and
cross-region operations remain follow-up work. Current regional data views
show the configured backend's authority only. Mutations require the
authoritative backend to report the GLOBAL region in connected mode.

To withdraw the operations UI, stop the Backstage service and remove its
custom domain through the reviewed deployment procedure. The original
backend and Directus continue to own the business records.
