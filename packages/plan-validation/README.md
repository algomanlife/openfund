# Plan validation (shared)

One rule set for challenge plans, used by:

- the website catalog guard, `apps/web-react/src/data/challengePlans.ts` (`assertPlansValid`);
- the backend plan administration, `apps/backend/admin-console.js` (draft, diff and publish);
- the Backstage console, which shows the backend's problem list before publishing.

Plain ES module with types in `index.d.mts`; no dependencies. The backend's
enforced rules stay `normalizeRules()` in `apps/backend/evaluation.js`, which
the publish path also runs.
