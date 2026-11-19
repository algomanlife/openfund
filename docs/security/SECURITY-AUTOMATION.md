# Security automation

The scanners from the [November 2026 assessment](SECURITY-AUDIT-2026-11.md)
now run as repeatable CI controls instead of one-time manual checks. Each
scanner runs from an image pinned by digest. No scanning job receives a
repository secret, and every job has read-only `contents` permission.

## Controls

| Control | Where | Trigger | Gate |
| --- | --- | --- | --- |
| actionlint 1.7.12 | `security.yml` → `workflow-lint` | PR, `main`, weekly | **Blocking**: every finding. Reviewed exceptions live in `.github/actionlint.yaml` (SC2016 for intentional single-quoted JavaScript) |
| zizmor 1.32.0 | `security.yml` → `workflow-lint` | PR, `main`, weekly | **Blocking** at medium severity and above. Reviewed exceptions are inline `# zizmor: ignore[...]` comments with a reason |
| Semgrep 1.185.0 (`p/javascript`, `p/nodejsscan`, `p/github-actions`) | `security.yml` → `semgrep` | PR | **Blocking** on new ERROR findings compared with the PR base (`--baseline-commit`). `.semgrepignore` limits the scan to first-party source |
| Semgrep full scan | `security.yml` → `semgrep` | `main`, weekly, dispatch | Report-only (JSON artifact and step summary) |
| Trivy 0.76.2, filesystem | `security.yml` → `trivy` | PR, `main`, weekly | **Blocking** on fixable Critical/High in the shipping lockfiles (`apps/backend`, `apps/backstage`, `apps/web-react`). Dated exceptions live in `.trivyignore` |
| Trivy 0.76.2, configuration | `security.yml` → `trivy` | PR, `main`, weekly | **Blocking** on Critical/High misconfigurations in `infra/` and `infrastructure/` |
| Trivy, built edge image | `deploy-liara-iran.yml` → `validate` | PR touching the edge, dispatch | **Blocking** on fixable Critical/High in the built image. Uploads the scan and a CycloneDX SBOM |
| OSV-Scanner 2.7.1 | `security.yml` → `osv` | PR, `main`, weekly | Report-only (see rollout). A scanner error (exit code > 1) still fails |
| OWASP ZAP 2.17.0 baseline | `security.yml` → `zap-baseline` | PR, `main`, weekly | **Blocking** for the 14 rules promoted to FAIL in `.zap/rules.tsv` (security headers, cookie flags, information leaks). Other alerts are reported. Runs against a local candidate only, never production |
| Syft 1.57.1 SBOM | `security.yml` → `sbom` | PR, `main`, weekly | CycloneDX per app and dormant package, kept 90 days |
| Release SBOM | `release.yml` → `package`; `publish.mjs` | Release | **Required**: a CycloneDX SBOM of the extracted release archive, checked by `sbom-check.mjs` and attached to the GitHub Release |
| Database role isolation and Directus controls | `ci.yml` → `CMS security` | PR, `main`, nightly | **Blocking** ([database roles](DATABASE_ROLES.md)) |
| Protocol activation block | `scripts/ci/protocol-dormant.test.mjs` | PR (`changes` job) | **Blocking** |
| CodeQL | Default setup | PR, `main` | Unchanged |
| gitleaks | `ci.yml` → `secrets`; release secret scan | PR, `main`, release | Unchanged and blocking. `.gitleaksignore` holds only reviewed commit fingerprints |
| Production dependency gate | `ci.yml` → `audit-production` | PR, `main`, nightly | Unchanged and blocking |

## Baseline at introduction (2026-11-19)

| Scanner | Result on `main` |
| --- | --- |
| actionlint | 13 shellcheck notes in 6 workflows, fixed in the same change (unused loop variables, an unquoted substitution, masked return values, an intentional word split replaced with an array). Two SC2016 notes on intentional single-quoted JavaScript are ignored by configuration |
| zizmor (medium+) | 3 findings, all resolved. `secrets: inherit` in `release.yml` now passes the one secret the deploy uses (`RENDER_API_TOKEN`), declared in `deploy-release.yml`. The two upstream proposal workflows push branches, so credential persistence is now explicit and recorded as a reviewed exception; their artifacts never include `.git` |
| Semgrep | 147 findings: 14 ERROR, 132 WARNING, 1 INFO. All 14 ERRORs were reviewed and are false positives: redirects to a configured origin or a local path, constant names containing "passed", an HMAC computation, whitepaper prose, an allow-listed SSE stream, a scope-equality check and Playwright tests. The PR gate therefore blocks only new ERRORs |
| Trivy filesystem | 0 fixable Critical/High in `apps/backend` and `apps/backstage`. `apps/web-react` had only the documented `decode-uri-component` advisory (OF-2026-11-04), which is listed in `.trivyignore` with a re-review date |
| Trivy configuration | 0 Critical/High in `infra/` and `infrastructure/` |
| ZAP baseline | 0 FAIL, 6 WARN: CSP wildcard (accepted, OF-2026-11-16), COEP missing, non-storable content, timestamp disclosure, suspicious comments in bundled code, and the modern-web-app notice |

Each blocking gate was also shown to fail when it should:

- Semgrep failed on a committed file with an open redirect and an XSS sink.
- ZAP returned FAIL on a bare server with no security headers.
- Trivy without `.trivyignore` and the protocol guard with a workflow that mentions `hardhat` both reported findings.
- The Directus probes failed on Directus's default configuration.

## Rollout of the report-only controls

- **OSV-Scanner** reports every lockfile, including the dormant protocol
  package (OF-2026-11-09) and vendored lockfiles that are never installed
  (OF-2026-11-18). These carry known advisories that are not shipped. Make it
  blocking for the shipping lockfiles once a per-path policy file exists, or
  rely on the blocking Trivy gate, which already covers those lockfiles.
- **Semgrep full scan:** reduce the 132 WARNING findings, which are mostly
  `regex_dos` and `node_insecure_random_generator` in non-security code,
  through rule tuning. Then raise the PR gate to WARNING.
- **ZAP:** promote more rules to FAIL as the remaining warnings are fixed, for
  example COEP once the chart and wallet embeds allow it.

Scanner rule packs (Semgrep registry packs, the Trivy and OSV databases) are
fetched when each job runs, so results can change when upstream data
changes. The images are pinned by digest, and Dependabot proposes updates
to them.
