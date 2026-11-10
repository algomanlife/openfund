#### v12.6.1 2026-11-04T20:19:38Z
### ✨ New Features & Improvements

- **@directus/app**
  - Added an "Allowed Link Protocols" option to the WYSIWYG interface so text and image links with custom URL schemes (e.g. `myapp://`) are kept, and made the link drawer show an error for a scheme that is not allowed instead of saving an empty link ([#28447](https://github.com/directus/directus/pull/28447) by @alvarosabu)
- **@directus/utils**
  - Fixed searching a many-to-many list so it matches the related fields shown in the list, not only the junction's own fields. Searching a number no longer matches hidden ID fields, such as the junction row ID ([#28422](https://github.com/directus/directus/pull/28422) by @robluton)
- **@directus/cli**
  - Added presets to Environment Sync. Global and role-scoped bookmarks and default views are synced; personal presets stay on their instance, and role presets whose role is missing on the target are skipped with a warning and counted in the new `skipped` field of the `--json` data report. Fixed add-mode pushes silently skipping a new permission whose source ID matched an unrelated target record ([#28357](https://github.com/directus/directus/pull/28357) by @bryantgillespie)

### 🐛 Bug Fixes & Optimizations

- **@directus/app**
  - Improved table, select, menu, and color display rendering performance by replacing per-instance CSS `v-bind()` with inline styles ([#28435](https://github.com/directus/directus/pull/28435) by @bryantgillespie)
  - Fixed searching a many-to-many list so it matches the related fields shown in the list, not only the junction's own fields. Searching a number no longer matches hidden ID fields, such as the junction row ID ([#28422](https://github.com/directus/directus/pull/28422) by @robluton)
  - Updated `vue-i18n`, `joi`, `follow-redirects`, `decode-uri-component`, `qs`, `glob`, and `@hono/node-server` to address CVEs ([#28451](https://github.com/directus/directus/pull/28451) by @br41nslug)
  - Added a check to prevent the public page shader and video backgrounds from downloading and rendering on narrow screens when they are hidden. ([#28432](https://github.com/directus/directus/pull/28432) by @bryantgillespie)
  - Sped up table row selection checks by looking up selected keys in a set instead of scanning the whole selection for every row ([#28438](https://github.com/directus/directus/pull/28438) by @bryantgillespie)
  - Fixed login redirects normalizing into protocol-relative URLs ([#28456](https://github.com/directus/directus/pull/28456) by @br41nslug)
- **@directus/api**
  - Fixed searching a many-to-many list so it matches the related fields shown in the list, not only the junction's own fields. Searching a number no longer matches hidden ID fields, such as the junction row ID ([#28422](https://github.com/directus/directus/pull/28422) by @robluton)
  - Updated `vue-i18n`, `joi`, `follow-redirects`, `decode-uri-component`, `qs`, `glob`, and `@hono/node-server` to address CVEs ([#28451](https://github.com/directus/directus/pull/28451) by @br41nslug)
  - Fixed login redirects normalizing into protocol-relative URLs ([#28456](https://github.com/directus/directus/pull/28456) by @br41nslug)
  - Fixed sandbox request URL scope validation not being applied to redirect destinations ([#28457](https://github.com/directus/directus/pull/28457) by @br41nslug)
  - Fixed Run Script operations and sandboxed extensions failing with "illegal access" when their data contained errors, such as the validation errors from a failed Condition operation. Errors are now passed into the sandbox as plain objects (with `name`, `message`, `code`, `status` and `extensions`) instead of `Error` instances ([#28441](https://github.com/directus/directus/pull/28441) by @AlexGaillard)
  - Bumped nodejs from 26.12.1 to 26.13.0 ([#28459](https://github.com/directus/directus/pull/28459) by @br41nslug)
- **@directus/composables**
  - Updated `vue-i18n`, `joi`, `follow-redirects`, `decode-uri-component`, `qs`, `glob`, and `@hono/node-server` to address CVEs ([#28451](https://github.com/directus/directus/pull/28451) by @br41nslug)
- **@directus/extensions-sdk**
  - Updated `vue-i18n`, `joi`, `follow-redirects`, `decode-uri-component`, `qs`, `glob`, and `@hono/node-server` to address CVEs ([#28451](https://github.com/directus/directus/pull/28451) by @br41nslug)
- **@directus/update-check**
  - Updated `vue-i18n`, `joi`, `follow-redirects`, `decode-uri-component`, `qs`, `glob`, and `@hono/node-server` to address CVEs ([#28451](https://github.com/directus/directus/pull/28451) by @br41nslug)
- **@directus/utils**
  - Updated `vue-i18n`, `joi`, `follow-redirects`, `decode-uri-component`, `qs`, `glob`, and `@hono/node-server` to address CVEs ([#28451](https://github.com/directus/directus/pull/28451) by @br41nslug)
- **@directus/validation**
  - Updated `vue-i18n`, `joi`, `follow-redirects`, `decode-uri-component`, `qs`, `glob`, and `@hono/node-server` to address CVEs ([#28451](https://github.com/directus/directus/pull/28451) by @br41nslug)

### 📦 Published Versions

- `@directus/app@19.1.0`
- `@directus/api@41.0.1`
- `@directus/cli@12.5.0`
- `@directus/composables@11.7.1`
- `create-directus-extension@12.1.8`
- `@directus/env@7.0.1`
- `@directus/extensions@4.1.1`
- `@directus/extensions-sdk@18.1.1`
- `@directus/memory@4.1.2`
- `@directus/pressure@4.0.8`
- `@directus/storage-driver-azure@13.0.8`
- `@directus/storage-driver-cloudinary@14.0.5`
- `@directus/storage-driver-gcs@13.0.8`
- `@directus/storage-driver-s3@14.0.5`
- `@directus/storage-driver-supabase@5.0.5`
- `@directus/themes@3.0.3`
- `@directus/update-check@14.0.2`
- `@directus/utils@14.1.0`
- `@directus/validation@3.0.8`

