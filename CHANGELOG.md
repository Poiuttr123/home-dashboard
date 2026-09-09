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

## v1.0.3

- **Fixes the real bug** behind "clicking Add Sensor / selecting Custom code
  kicks me into the YAML editor": the editor's `config-changed` events were
  sending Home Assistant a config object missing the `type` key. Home
  Assistant's card-editor dialog treats `config-changed` payloads as the
  complete card config, so a config without `type` looked broken and it
  fell back to the raw YAML editor on every single edit — every button,
  toggle, and dropdown in the visual editor. Now the full original config
  (type included) is preserved and merged with each update.

## v1.0.4

- Each Daily Information sensor row gets a **Value** dropdown, populated
  from that entity's live attributes, to read an attribute (e.g.
  `Alos_Simple`) instead of always using the entity's state. Selecting a
  different entity resets the attribute choice, since attribute names are
  entity-specific.
- More breathing room: sensor rows in the editor are now separated by a
  divider with real spacing, and the Daily Information grid on the card
  itself has extra row spacing/padding so names and values aren't as
  cramped.

## v1.0.5

- Fixes the Daily Information grid spreading rows far apart when there
  are only a few sensors. `grid-auto-rows: minmax(0,1fr)` made every row
  stretch to an equal share of the card's full height; with 2-3 sensors
  in a tall card that meant huge gaps between rows. Rows now size to their
  content (`min-content`) and pack toward the top (`align-content: start`),
  so they sit close together regardless of how much of the card they fill.

## v1.1.0

- **The weather card now shows a 5-day forecast.** A row of day columns
  (weekday name, condition icon, high/low) sits under the current
  conditions; the current icon and temperature shrink slightly to make
  room, and nothing else on the dashboard moves.
- **Fixes a forecast that could never have worked on a current Home
  Assistant.** The card read today's high/low from the weather entity's
  `forecast` attribute, which Home Assistant deprecated in 2023.9 and
  removed in 2024.4 — so that line has been rendering blank. The forecast
  is now requested over the websocket connection
  (`weather/subscribe_forecast`, the same mechanism the built-in forecast
  card uses), which also pushes updates as they arrive instead of only
  refreshing when some other entity changes. Cores old enough to still
  expose the attribute fall back to it.
- New `forecast` config section (`enabled`, `days`, 1-7, default 5), with a
  **Weather Forecast** section in the visual editor. With the strip turned
  off, the details line goes back to showing today's `High … / Low …`.
- The subscription follows the configured weather entity, and is torn down
  when the card leaves the DOM.

## v1.2.0

- **Adds an hourly forecast** to the weather card, in the empty space to the
  right of the current temperature — so it costs no vertical room and
  nothing else on the dashboard moves. Each column is the hour, a condition
  icon, and the temperature; the first reads `Now`, and clock times follow
  Home Assistant's 12/24-hour setting.
- New `forecast.hourly` (default `true`) and `forecast.hours` (`1`-`8`,
  default `6`), with a matching toggle and dropdown in the visual editor.
- Daily and hourly are separate `weather/subscribe_forecast` subscriptions,
  so an entity that offers only one kind still shows that strip and hides
  the other. The legacy pre-2024.4 `forecast` attribute remains a fallback
  for the daily strip only, since that is what integrations put there.

## v1.2.1

- **Fixes the large empty gap between the current conditions and the hourly
  forecast.** The strip carried `justify-self: end`, which sized it to its
  content and pinned it to the card's right edge instead of letting it fill
  the column — so every spare pixel collected into one gap in the middle.
  Very visible on a wide dashboard, barely noticeable on a narrow one, which
  is why it slipped through. The strip now stretches, starting immediately
  after the current conditions and running to the card edge, the same way
  the daily strip below it already did.
- `forecast.hours` now goes up to `12` (was `8`), so a wide card can be
  filled with columns rather than spacing.
