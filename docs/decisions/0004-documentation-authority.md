# 0004 — Documentation authority and evidence

Date: 2026-11-02. Status: Accepted for repository documentation. Baseline: `2f5cf93`.

## Context

Historical architecture pages described browser-local trading and a one-service optional deployment, while merged PRs #23/#24 introduced the current three-resource Render and server-authoritative account model. Duplicate feature tables combined delivered and planned claims. Persian reports and old screenshots obscured the current English repository presentation.

## Decision

Use `docs/README.md` as the central index, `docs/product/FEATURE_STATUS.md` as the capability register and `docs/roadmap/MILESTONES.md` as the acceptance/dependency register. Statuses are Completed, In Progress, Planned and Blocked, qualified by scope and evidence. Existing references to superseded architecture/roadmap paths resolve to compatibility pointers. Historical reports retain their original dates and validation limits, with English translations and immutable historical screenshot links.

Documentation and explanatory prose are English. Product translations, Persian/RTL behavior and localization test fixtures remain intact. Automated documentation gates validate prose, links, image paths, Markdown and Mermaid. Current screenshots must come from the latest source build and carry provenance; diagrams and future-state art cannot masquerade as application captures.

## Consequences

Contributors read current contracts before coding, update status/milestones alongside changes, preserve approved branding and Render decisions, and distinguish configured, locally tested and deployed behavior. No business metrics, approvals, partnerships or execution capability may be inferred from aspirational copy. Protocol integration remains outside Task 1.
