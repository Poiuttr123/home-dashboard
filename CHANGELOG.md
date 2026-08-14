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
