# Claude Code instructions

Claude Code follows the same rules as every other coding agent in this
repository. They live in one place so they cannot drift:

@AGENTS.md

## README and documentation (merge rule)

Follow the merge rule in `AGENTS.md` and `docs/development/README_STRUCTURE.md`:
every pull request updates the matching `docs/readme/*.json` (and status,
gallery, changelog) for what it changes, runs `npm run docs:write`, and commits
the regenerated README and graphics. The README is complete and graphical by
owner decision; never condense it or remove sections, icons or graphics.

## Developer docs

Follow "Developer docs (merge rule)" in `AGENTS.md`: changes to routes, the
backend API, schema, `render.yaml`/environment, package scripts, CI, releases or
`apps/open-trade` also update `docs/developer-portal/` in the same pull request.

## Editorial content

Follow the Editorial content section in `AGENTS.md`. New pages and new
user-facing components register their static copy, all five locales, stable
ids, Directus records and visual-editing references. Do not replace the
instruction above, and do not add hardcoded editorial copy that skips the
content registry.
