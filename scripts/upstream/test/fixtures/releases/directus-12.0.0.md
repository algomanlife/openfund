#### v12.0.0 2026-06-10T17:15:01Z
**License Enforcement**

> [!NOTE]
> Directus is free for individuals and organizations under $5M annual revenue and 50 employees.\
> Get your free license key at [directus.com/oig](http://directus.com/oig)

Directus 12 introduces active license enforcement. Self-hosted instances run on the **Core tier** by default. Higher limits and additional features require a valid license. See [Licensing](https://directus.com/docs/licensing/overview) for a complete overview.

This change affects instances previously using features that now require a license, including:

- **SSO** — SSO login will no longer work. Users who authenticate through SSO will be unable to log in and must be converted to email and password users to regain access.
- **Custom permission rules** — custom rules on access policies will be ignored.
- **Custom or self-hosted LLMs** — connections to custom LLMs will no longer work. 
- **AI Translations** — AI-powered translations are not available.

Enforcement is immediate on new instances. Instances upgrading to Directus 12 get a 30-day [grace period](https://directus.com/docs/releases/breaking-changes/version-12#post-upgrade-grace-period) from the time of upgrade, after which these are enforced unless a license that enables them is configured.

If your instance uses any of these features, add a license that includes them to continue to do so. If your instance uses only Core tier features, no action is required.

**Changed license to MSCL-1.0-GPL ([#27417](https://github.com/directus/directus/pull/27417))**
- Breaking Change: Relicensed from BUSL-1.1 to MSCL-1.0-GPL (Monospace Sustainable Core License, Version 1.0).

**Changed the default of `IP_TRUST_PROXY` from `true` to `false` to harden the default deployment against IP spoofing. ([#27607](https://github.com/directus/directus/pull/27607))**
- The `IP_TRUST_PROXY` default was changed from `true` to `false`. If you run Directus behind a reverse proxy and rely on `X-Forwarded-For` (or similar) headers for client IP resolution, you must now explicitly set `IP_TRUST_PROXY` to `true` or a more specific trust configuration.

**Fixed health check results not being shared in multi-instance settings. Restricted `/server/health` to authenticated users ([#27160](https://github.com/directus/directus/pull/27160))**
- Health checks are cached by default and shared across multi-instance deployments
  - `/server/health` will return 404 for unauthenticated requests, use `/server/ping` for liveness checks
  - `cache`, `rateLimiter` and `rateLimiterGlobal` health checks have been replaced by a generic `redis` check using the `redis:` prefix

**Introduced VERSION_KEY_* constants and renamed main to published @alvarosabu ([#27397](https://github.com/directus/directus/pull/27397))**
- Backward Compatibility: You can now use `?version=published` to resolve versions of the main item(s) via the version query parameter. For backward compatibility, `?version=main` will continue to work.

**Replaced status field with archived boolean in collection settings @alvarosabu ([#27397](https://github.com/directus/directus/pull/27397))**
- Backward Compatibility: Existing collections with string-based status fields continue to work unchanged; newly created collections now default to a boolean "Archived" field instead of the string "Status" field

**Deprecated the `VResizeable` component @formfcw ([#27437](https://github.com/directus/directus/pull/27437))**
- Deprecation for extensions: The globally registered `VResizeable` component has been deprecated. Extension authors using `<v-resizeable>` should migrate to `@directus/vue-split-panel` or their own implementation.

**Updated type system, borders, and theme variables @formfcw ([#27437](https://github.com/directus/directus/pull/27437))**
- Potential breaking change for theme extensions: headerShadow and sidebarShadow removed from LayoutConfig interface
- Potential breaking change for theme extensions: boxShadow removed from header theme rules schema
- Potential breaking change for theme extensions: sidebarShadow no longer exposed in layout wrapper state

**Updated module navigation bar spacing and styling @HZooly ([#27437](https://github.com/directus/directus/pull/27437))**
- Potential breaking change in theme extensions: Removed `navigation.project.borderColor` / `navigation.project.borderWidth` / `navigation.project.background` from theming. No action is required — these props will simply no longer have any effect.

**Locked published items in versioned collections from editing and added a header action button to edit in the draft version @alvarosabu ([#27397](https://github.com/directus/directus/pull/27397))**
- **Breaking change — new behavior for versioned collections** Published items in versioned collections are now locked. Edits must be made through the draft version.

**Removed rounded buttons and adopted shared header action button across all views @formfcw ([#27437](https://github.com/directus/directus/pull/27437))**
- Potential breaking change for extensions: The `rounded` prop has been removed from `v-button`. Extensions using `rounded` will still render correctly but buttons will appear as rounded rectangles instead of circles. No functional impact.

**Updated header and navigation bar base design and merged their theme properties into a new shell scope @formfcw ([#27437](https://github.com/directus/directus/pull/27437))**
- Potential breaking change for theme extensions: The theme properties `navigation.background`, `navigation.backgroundAccent`, `navigation.borderWidth`, `navigation.borderColor`, `header.background`, `header.borderWidth`, and `header.borderColor` have been removed and replaced by `shell.background`, `shell.backgroundAccent`, `shell.borderWidth`, and `shell.borderColor`.
- Potential breaking change for theme extensions: Custom themes overriding any of these removed properties must migrate to the new `shell` scope. The corresponding CSS variables ch
