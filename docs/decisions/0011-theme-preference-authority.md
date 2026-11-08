# ADR 0011: Theme preference authority

Status: proposed; source implemented on an unreleased branch.

## Context

The existing `of-theme` key was written on page entry as well as after a
manual toggle, so it cannot distinguish a user's choice from a default.
Public routes and the terminal also read it independently and could reset the
theme during navigation. The operating system should choose only the default;
after a user toggles, their choice should take priority.

## Decision

Store an explicit manual choice in `of-theme-choice`. If that key has no valid
value, use `prefers-color-scheme` for the initial paint and follow its changes.
Keep `of-theme` as the resolved value for the classic runtime and existing
integrations, but never interpret it as user intent. A shared root theme
controller updates public pages, the React terminal, and the terminal iframe;
the existing Vela bridge applies the matching chart palette.

## Consequences

Existing users without `of-theme-choice` start with their system preference,
even if `of-theme` contains an older auto-saved value. Browser-level forced
recoloring is outside the site's rendering authority: a browser that ignores
`color-scheme: only light` needs its own site exception. Acceptance must cover
fresh light/dark OS contexts, an OS change, explicit choice, reload, route
handoff and native chart paint. PR #50 layout changes remain independent.
