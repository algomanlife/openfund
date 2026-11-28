# Pine indicator provenance review (Historical)

**Historical, superseded on 2026-11-28 by the owner's decision in
[ADR 0066](../../decisions/0066-indicator-ownership.md):** Openfund owns the
three indicators and two libraries in `indicators/` and publishes them as open
source. This file keeps the earlier review as it stood, for the record only.
It is not the current licence or ownership statement; that is
[Licensing](../LICENSING.md#pine-indicator-sources) and
[indicators/README.md](../../../indicators/README.md).

## From docs/legal/LICENSING.md (item 3)

**Pine indicator sources (`indicators/`).**
   The owner states that the three indicators and two libraries are
   owner-controlled and intended to be open source (recorded 2026-11-21 in the
   optimization task; no authorship records accompany the statement). A
   file-by-file review of the repository found:

   | File | Header / marks | Evidence of other origin | Status |
   | --- | --- | --- | --- |
   | `smc-v1.pine` | CC BY-NC-SA 4.0, "© Openfund" | Structure, identifiers and doc comments closely resemble a widely published third-party "Smart Money Concepts" script distributed under CC BY-NC-SA 4.0 | Not relicensable without the original author's permission; notice kept |
   | `pac v1.pine` | None; title "Open source"; scanner shows "SDK © Algoman.life" | "Price Action Concepts" is a commercial third-party product name | Unresolved |
   | `Open algo v5.pine` | None (original first line "I made it better yay") | Original imports `ayvaliktrading/EyopsTelegram` and `ayvaliktrading/JoinUsEyopsTelegram`; the removed dashboard was titled "SMRT Algo" | Unresolved |
   | `Overlayslibrary.pine` | None | Served in place of `ayvaliktrading/EyopsTelegram` | Unresolved |
   | `sdk.pine` | None | Description wording of a published Nadaraya–Watson kernel library | Unresolved |

   The November 2026 optimization changed the indicator code (see
   [ADR 0048](../../decisions/0048-pine-indicator-optimization-and-provenance.md)).
   Those changes are derivative work on these files and do not change their
   licence status. **Prepared change, not applied:** for each file the owner
   proves wholly owner-authored (commit history, original drafts or a written
   assignment), add an `SPDX-License-Identifier: Apache-2.0` header with the
   owner's copyright line, add `indicators/LICENSE` (Apache-2.0) scoped to
   those files, and list them in the root README licence table. For a file of
   third-party origin, record the upstream author, URL and licence, then either
   obtain permission or keep (or restore) the upstream licence and attribution.
   CC BY-NC-SA material cannot be offered commercially. The Openfund monorepo
   licence is not affected by this item.

## From indicators/README.md

### Licence and provenance

**Unresolved.** The owner states that these sources are owner-controlled and
should be open source. The repository does not yet contain evidence that every
file is wholly owner-authored, and several files carry signs of third-party
origin:

- `smc-v1.pine` declares *CC BY-NC-SA 4.0* with "© Openfund". That is a
  non-commercial ShareAlike licence. Its structure and comments closely
  resemble a widely published third-party Smart Money Concepts script that is
  distributed under the same licence.
- `pac v1.pine` has no licence header. Its title says "Open source" and its
  scanner shows "SDK © Algoman.life". "Price Action Concepts" is also the
  name of a commercial third-party product.
- `sdk.pine` describes itself as a kernel library for Nadaraya–Watson
  estimators, in the wording of a published third-party library.
- Open Algo originally imported libraries named `ayvaliktrading/...`.

Until the owner provides authorship records or the original upstream
licences, no file here is relabelled, and the existing CC BY-NC-SA notice
stays. The prepared change, which applies Apache-2.0 only to the files proven
owner-authored, is in [the licensing record](../LICENSING.md#pine-indicator-sources).
The PineTS runtime (AGPL-3.0-only) and Vela (Apache-2.0 with NOTICE) have
their own terms, independent of these sources.
