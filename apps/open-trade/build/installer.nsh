; Open Trade Windows installer pages (electron-builder assisted NSIS).
; The sidebar and header bitmaps are rendered by scripts/prepare.mjs from
; branding/nsis-sidebar.svg and branding/nsis-header.svg.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Open Trade"
  !define MUI_WELCOMEPAGE_TEXT "Open Trade is the Openfund desktop trading workspace: multi-chart Vela workspaces, Quick Trade for Openfund Prop accounts and read-only Gains Network records.$\r$\n$\r$\nWebsite: https://openfi.cloud$\r$\nSource code: https://github.com/algomanlife/openfund$\r$\n$\r$\nThis is an internal beta build. Trading involves risk.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend
