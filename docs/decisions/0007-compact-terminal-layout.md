# ADR 0007: Compact shared terminal presentation

Status: Accepted for locally verified frontend implementation, 2026-11-02.

## Context

The shared product shell and framed classic terminal preserved financial isolation, but wrapping headers and a vertically scrolling order panel wasted chart space and hid essential controls. Persian text must not reverse trading geometry. Website work is concurrent and must remain independent.

## Decision

Keep the existing React shell, disposable iframe, product adapters, chart engine and legacy event targets. Scope the 40px application navigation to trading routes. Load a dedicated raw iframe stylesheet after the established terminal stylesheet. Arrange existing fields and estimates in shared presentation markup, with critical risk information outside the details disclosure. Use LTR grid geometry with local RTL text and isolated numbers.

Constrain desktop layout with viewport grid rows and min-size boundaries. Keep the form visible without scrolling. Variable book levels and activity tables scroll internally. Use explicit workspace views on narrow/short screens, including a horizontal order layout on short desktops. Keep account and order logic outside the presentation helper.

## Consequences and acceptance

Both products receive one visual system without sharing financial state or changing capabilities. CSS extraction requires the existing reduced-motion source assertion to follow the new file. Browser acceptance measures real rectangles and content dimensions in both languages, all three order types, anonymous/authenticated states and all four requested desktop sizes. CI runs both modes. Generated chart bundles and backend/deployment contracts remain unchanged.

[Delivery and screenshots](../reviews/terminal-ui/DELIVERY.md) · [Terminal contract](../trading/TERMINAL.md)
