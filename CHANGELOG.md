# Changelog

## v1.0.0

Initial HACS release. Turns the original standalone web component into a
proper Lovelace custom card:

- `setConfig` / `getStubConfig` / `getConfigElement` / `getCardSize`.
- Every entity ID driven by config (`entities`), with the original hardcoded
  IDs kept as defaults.
- Visual editor (`home-display-card-editor`) with entity pickers for every
  entity, plus add/remove for the "Daily Information" sensor list.
- Toggleable bottom-right panel (`image_panel`): shows the wedding countdown
  iframe by default, or an uploaded image; can be turned off entirely.
- `.page` sized to `100%` instead of `100vw`/`100vh` so the card behaves
  correctly inside a normal dashboard grid, not just full-panel.
- Packaged as a HACS **Plugin** (`hacs.json`).

## v1.0.1

- Adds an on-load version banner in the browser console
  (`HOME-DISPLAY-CARD v1.0.1`) so it's easy to confirm which build is
  actually loaded — handy given how aggressively browsers cache HACS
  plugin JS.
- Adds this changelog.

## v1.0.2

- `image_panel` gets a `mode` field (`default` / `image` / `custom`) instead
  of only image-or-not. `custom` mode runs pasted JavaScript inside a
  sandboxed, origin-isolated `<iframe sandbox="allow-scripts">` — no access
  to Home Assistant, your login, or the rest of the dashboard. The editor's
  Bottom Right Panel section gets a matching Content dropdown and, for
  `custom` mode, a code textarea. Existing configs with just `image` set
  keep working (treated as `mode: image`).
- Editor hardening: the "Daily Information Sensors" and "Bottom Right Panel"
  sections now build first (so they're visible without scrolling past the
  entity pickers), each section is visually boxed, and a failure building
  one section no longer silently prevents the others from rendering.
