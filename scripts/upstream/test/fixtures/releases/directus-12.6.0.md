#### v12.6.0 2026-10-27T16:59:02Z
### ⚠️ Potential Breaking Changes

**Added recommended default AI allowed models that update with Directus releases and apply while the setting is unset (null). ... ([#28344](https://github.com/directus/directus/pull/28344))**
Deprecated LLM models from providers have been removed. Please recheck AI assistant settings before trying to use the AI assistant.

**Raised the minimum required Node.js version to 26. Node.js 22 is no longer supported. ([#27737](https://github.com/directus/directus/pull/27737))**
Updated minimum nodejs version requirement to 26

**Renamed the OpenAPI schema `x-metadata` to `Metadata` for consistency with other schema names ([#28323](https://github.com/directus/directus/pull/28323))**
List responses now reference `#/components/schemas/Metadata` for `meta`, in both `@directus/specs` and `/server/specs/oas`. Update any `$ref` to `x-metadata` and regenerate clients built from the spec.

**Updated the default `TELEMETRY_URL` and `COMPLIANCE_URL` to `https://telemetry.directus.com` ([#28385](https://github.com/directus/directus/pull/28385))**
Telemetry and compliance reports are now sent to `telemetry.directus.com` instead of `telemetry.directus.io`.

If your deployment restricts outbound traffic, allow `telemetry.directus.com` before upgrading. Otherwise reporting will fail without logging an error.

- **@directus/app**
  - Raised the minimum required Node.js version to 26. Node.js 22 is no longer supported. ([#27737](https://github.com/directus/directus/pull/27737) by @br41nslug)
- **@directus/api**
  - Raised the minimum required Node.js version to 26. Node.js 22 is no longer supported. ([#27737](https://github.com/directus/directus/pull/27737) by @br41nslug)
  - Renamed the OpenAPI schema `x-metadata` to `Metadata` for consistency with other schema names ([#28323](https://github.com/directus/directus/pull/28323) by @kheiner)
- **create-directus-project**
  - Raised the minimum required Node.js version to 26. Node.js 22 is no longer supported. ([#27737](https://github.com/directus/directus/pull/27737) by @br41nslug)
- **@directus/specs**
  - Renamed the OpenAPI schema `x-metadata` to `Metadata` for consistency with other schema names ([#28323](https://github.com/directus/directus/pull/28323) by @kheiner)
- **@directus/env**
  - Updated the default `TELEMETRY_URL` and `COMPLIANCE_URL` to `https://telemetry.directus.com` ([#28385](https://github.com/directus/directus/pull/28385) by @alexvdvalk)
- **@directus/schema-builder**
  - Added `snapshot()` and `types()` to the SchemaBuilder to generate schema snapshots and TypeScript types ([#28309](https://github.com/directus/directus/pull/28309) by @Nitwel)

### ✨ New Features & Improvements

- **@directus/app**
  - Added a Default Exports Folder project setting for exports saved to the File Library. The export drawer now warns about File Library visibility and only offers options the user has permission to use. ([#28333](https://github.com/directus/directus/pull/28333) by @robluton)
  - Added recommended default AI allowed models that update with Directus releases and apply while the setting is unset (null).  ([#28344](https://github.com/directus/directus/pull/28344) by @bryantgillespie)
    Existing saved selections are unchanged.
  - Added the `richtext` app extension type, which lets extensions add Tiptap nodes, marks and toolbar buttons to the WYSIWYG interface per field ([#28384](https://github.com/directus/directus/pull/28384) by @alvarosabu)
  - Showed license warnings in the sidebar so admins see them outside Settings > License ([#28394](https://github.com/directus/directus/pull/28394) by @robluton)
- **@directus/api**
  - Added a Default Exports Folder project setting for exports saved to the File Library. The export drawer now warns about File Library visibility and only offers options the user has permission to use. ([#28333](https://github.com/directus/directus/pull/28333) by @robluton)
  - Added recommended default AI allowed models that update with Directus releases and apply while the setting is unset (null).  ([#28344](https://github.com/directus/directus/pull/28344) by @bryantgillespie)
    Existing saved selections are unchanged.
  - Added the `richtext` app extension type, which lets extensions add Tiptap nodes, marks and toolbar buttons to the WYSIWYG interface per field ([#28384](https://github.com/directus/directus/pull/28384) by @alvarosabu)
- **@directus/system-data**
  - Added a Default Exports Folder project setting for exports saved to the File Library. The export drawer now warns about File Library visibility and only offers options the user has permission to use. ([#28333](https://github.com/directus/directus/pull/28333) by @robluton)
- **@directus/types**
  - Added a Default Exports Folder project setting for exports saved to the File Library. The export drawer now warns about File Library visibility and only offers options the user has permission to use. ([#28333](https://github.com/directus/directus/pull/28333) by @robluton)
  - Added the `richtext` app extension type, which lets extensions add Tiptap nodes, marks and toolbar buttons to the WYSIWYG interface per field ([#28384](https://github.com/directus/directus/pull/28384) by @alvarosabu)
- **@directus/sdk**
  - Added a Default Exports Folder project setting for exports saved to the File Library. The export drawer now warns about File Library visibility and only offers options the user has permission to use. ([#28333](https://github.com/directus/directus/pull/28333) by @robluton)
- **@directus/specs**
  - Added a Default Exports Folder project setting for exports saved to the File Library. The export drawer now warns about File Library visibility and only offers options the user has permission to use. ([#28333](https://github.com/directus/directus/pull/28333) by @robluton)
- **@directus/cli**
  - Added a Default Exports Folder project setting for exports saved to the File Library. The export drawer now war
