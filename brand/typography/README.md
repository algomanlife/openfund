# Brand typography

Openfund uses exactly two faces (owner decision, 2026-11-21):

| Face | Role | License | Canonical files |
| --- | --- | --- | --- |
| Ubuntu (Canonical) | General / Latin, Cyrillic, digits | Ubuntu Font Licence 1.0 | `apps/web-react/public/assets/ubuntu-400.ttf`, `ubuntu-700.ttf`, `Ubuntu-LICENSE.txt` |
| Dastkhat v1.210 (Dastyar) | The only Persian/Arabic face | SIL OFL 1.1 (no Reserved Font Name), based on Vazirmatn by Saber Rastikerdar | `apps/web-react/public/assets/fonts/dastkhat/` |

Binaries are stored once and reused by the site, the terminal iframe,
Backstage, Open Trade desktop (copied at build by `apps/open-trade/scripts/prepare.mjs`)
and the `dist/` snapshot; no modified forks exist. The single `@font-face` file
is `apps/web-react/public/assets/fonts/dastkhat/dastkhat.css`.

## Dastkhat provenance

- Upstream: <https://github.com/dastyar-io/dastkhat-font>, release tag `v1.210`.
- Pinned commit: `ac5b01542f36a57cd870a9d32a9b84357263fecb` (first `main` commit
  containing Dastkhat Arabic; `Dastkhat-Variable.woff2` and
  `DastkhatFaNum-Variable.woff2` are byte-identical to tag `v1.210`).
- Files are copied unmodified; the machine-readable record with SHA-256 per
  file is [SOURCE.json](../../apps/web-react/public/assets/fonts/dastkhat/SOURCE.json)
  and is verified by `apps/web-react/test/typography.test.mjs`.

| File | SHA-256 |
| --- | --- |
| `Dastkhat-Variable.woff2` | `30fe3de46a1f6615918844f7d81acbf78f78da7fd6a4287566f6382e1124b458` |
| `DastkhatArabic-Variable.woff2` | `d5b141cc6d9b0f147ee835bad3a2a50a57658e87a6fa468ae44c2931ff29e1ea` |
| `DastkhatFaNum-Variable.woff2` | `64d56947d92ce3a8150fbb99ffe4af14243990997c0f823683e8d0fbb4dcb4d5` |
| `OFL.txt` | `9bf954cbb2f2786ee9bf61e3fc13cc793e09410473b8a0fe66dfbd686146d10f` |
| `FONTLOG.txt` | `e422f18659a36f5511bf58a16ed766177ac4123908299f02eef3d7c77536334d` |
| `THIRD-PARTY-NOTICES.txt` | `6db4da336f57f6c49aa4d62ab55f07131863b347b7a3ec2fe17c98787b09d89a` |

Static weights are deliberately not vendored: every surface uses the variable
file (`font-weight: 100 900`), so static cuts would be unused weight.

## Retired

Irancell (`irancell-*.ttf`), its renamed copies (`openfund-1…5.ttf`,
`openfund-persian-*-v4.woff2`, family "Openfund Persian") and the standalone
Vazirmatn copy were removed on 2026-11-21. See
[Retired and no longer used](../../docs/development/RETIRED.md).
