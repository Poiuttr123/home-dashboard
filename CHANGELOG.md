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

## v1.3.0

- **New `status` list**: colour-coded on/off indicators across the top of
  the Daily Information card — green on, dim off, red wrong. Built for
  "is the fridge in Shabbos mode" and "is the mikvah on", but it takes any
  switch, `binary_sensor` or `input_boolean`.
- Three separate things turn a row red, because they mean different
  things: the entity is unavailable (`Unavailable`), the entity doesn't
  exist (`Missing` — never silently rendered as "Off"), or an optional
  `expected` entity disagrees with the real one (`Off (want On)`).
- That last case catches the failure that otherwise looks like success: a
  switch that was told to turn on and didn't. Set `expected` to the sensor
  holding the intent and the mismatch shows up in red.
- Per-entry `name`, `on_label` and `off_label`, plus a **Status
  Indicators** section in the visual editor with add/remove rows.
- Leaving `status` empty collapses the row entirely, so existing cards are
  unchanged.

## v1.4.0

- **New `status_position` setting** (`daily_bottom` — the new default —
  `daily_top`, or `footer`), with a **Position** dropdown in the editor.
  The indicator row can now sit under the Daily Information sensors, above
  them, or as its own card in the bottom bar.
- **Fixes a CSS collision introduced in v1.3.0.** The new indicators used
  `.status-dot`, which the footer's "HA Connected" pill already owned. The
  pre-existing rule is declared later in the stylesheet, so it won its
  unset properties — giving every indicator dot a fixed 7px size and, worse,
  a **green glow even when off or in error**. The indicator classes are now
  `.indicator*`, leaving the footer's own `.status` rules untouched.

## v1.5.0

- **Error rows now blink bright red** instead of just tinting the text, so
  a problem is visible from across the room. Honours
  `prefers-reduced-motion` by staying bright but still.
- **New offline detection** (`stale_after`, in minutes, plus an optional
  `stale_entity` heartbeat). A cloud integration can stop delivering
  updates without ever marking anything `unavailable` — it keeps serving
  the last value it saw, so a stalled feed renders as a calm, healthy
  `Off`. That is the worst way for a Shabbos indicator to fail, and it is
  now caught and shown as `Offline (3h21m)`.
- `stale_entity` exists because a switch can legitimately sit unchanged
  for hours and makes a poor heartbeat; the busiest entity on the same
  device (typically a power sensor) is a far better one.
- Offline outranks a disagreement: if the device can't be seen, what it
  should be is beside the point.
- The staleness display is driven off the existing one-second clock, so
  the age keeps counting even when no state arrives to trigger a redraw —
  which is precisely the case when a feed has died.
- Fixes indicator chips stretching to the full height of their row. They
  inherited the flex default of `stretch`; harmless until the new pill
  radius turned it into large red discs.

## v1.6.0

- **Stops the indicators crying wolf.** `unavailable` turned a row red
  instantly, and cloud-backed devices blip out for a few seconds many
  times an hour — one Samsung fridge here blips up to ~140s, several
  times an hour — so a blinking red alarm would have fired constantly and
  taught the eye to ignore it. The last trustworthy value is now held for
  `grace` seconds (default 180) before an outage counts. A real outage
  lasts hours, so a genuine alarm is only delayed by the grace period.
- With no earlier good value to fall back on, it still alarms
  immediately rather than inventing a reassuring one. `grace: 0` restores
  the old alarm-at-once behaviour.

## v1.7.0

- **The זמני היום row is shorter.** Its height share drops from 20 to 14
  out of 100, and the space goes to Daily Information. Adjustable via
  `layout.zmanim` (6–30) and a **Layout** section in the editor.
- **New `layout.bottom_crop`** for displays that show less of the page
  than the browser renders. On a DW Spectrum video-wall tile the page is
  laid out at full height while the tile shows only the top, so the
  footer lands past the visible edge and looks missing rather than
  cropped. Setting the percentage lost makes the card lay itself out
  inside the visible area.
- Row shares always total 100, whatever `layout.zmanim` is set to.

## v1.9.0

- **The top-right box becomes a stack of conditional blocks** (`top_right`).
  Each block — the built-in Special Times rows, the status indicators, or
  your own sensor rows — shows only when its own conditions pass, so the
  same corner can carry different things on different days. Times on
  Shabbos and Yom Tov, something else the rest of the week.
- Conditions are a list of entities per block: the block shows when any of
  them is on, empty means always. A missing or unavailable entity counts
  as off rather than as a reason to show.
- If no block qualifies the box disappears and the clock and weather take
  the width back. If more qualify than fit, the box clips rather than
  letting blocks draw over each other.
- `status_position` gains `special` as shorthand for putting the
  indicators here; an explicit `status` block overrides it either way.
- Existing cards are unchanged: with no `top_right` configured the box is
  a single always-on Special Times block, exactly as before.

## v1.10.0

- **The bottom area becomes conditional blocks too** (`bottom`), matching
  `top_right`. The Daily Information sensor list is now just one block,
  so it no longer has to be on all the time.
- **New `image` block** for putting an uploaded sheet on screen instead,
  with `fill: full | row | daily`. Uploaded from the editor through Home
  Assistant's Image Upload integration, drawn with `object-fit: contain`
  so a page of times is never cropped.
- `fill: full` hides the dashboard while the image shows. Height is what
  limits a printed sheet and every inner box is short: a 5000×3520 sheet
  renders 692×487 at `full` against 270×190 in the Daily Information box,
  so `full` is the only placement that makes small print readable.
- An image block with no image is skipped rather than blanking the card,
  and if nothing qualifies the Daily Information card is dropped instead
  of showing an empty titled box.

## v1.10.1

- Fixes an image block and a sensors block drawing over each other when
  both conditions passed. They share a grid row, which is the normal
  setup — a conditional image plus an always-on sensor list — so the
  image now takes the row and the grid stands down.

## v1.10.2

- A second `special_times` or `status` block in `top_right` rendered as an
  empty heading. Each type draws a single shared element that gets moved
  into place, so only one block of that type can hold it — the duplicate
  is now dropped. Easy config to reach by mis-clicking the type dropdown.
  Multiple `sensors` blocks are independent and all still render.

## v1.10.3

- Fixes the Daily Information sensor rows drawing on top of an image
  sharing their row. The code hid the grid correctly, but `.daily-grid`
  and `.daily-card` carry an author `display` rule, which beats the
  browser's `[hidden]` rule — so setting `.hidden` did nothing. Every
  other hideable element already had its own `[hidden]` rule; these two
  were missed.

## v1.11.0

- **The footer stands down while a sheet is showing in the card**, and its
  row share goes to the sheet rather than being left as an empty track.
  The **Daily Information heading** goes too — it labels the sensor list,
  and names nothing beside a sheet.
- On a 951x499 screen that takes the sheet from 253x178 to 324x228, about
  65% more area, with everything else on the dashboard untouched.
- Both return as soon as the image stops showing. A `fill: full` image
  hides the dashboard anyway, so it leaves the footer and heading alone.

## v1.11.1

- **Fixes the dashboard running off the bottom of the screen on a DW
  Spectrum tile.** The card divides one height into rows, so it needs a
  definite height to divide. A Lovelace view usually hands the card one,
  but the DW tile hands it none — and then `height: 100%` quietly falls
  back to `auto`, every row grows to fit its contents, and a sheet in the
  daily box dragged the dashboard to 1186px inside a 499px window.
- The card now probes whether the view gave it a height at all, and when
  it did not, measures the window itself. In an auto-height container a
  951x499 window now lays out identically to a fixed one.
- `layout.bottom_crop` worked the same way — a percentage of a height
  nobody had handed out — so it had been doing nothing on that tile. It
  now crops the measured height, and still crops the view's height when
  the view provides one.
- A phone in portrait is left alone: it is meant to stack up and scroll,
  and squeezing the whole dashboard into one screen there would make it
  unreadable.

## v1.11.2

- v1.11.1 measured the right thing and drew the wrong conclusion from it.
  It collapsed the page, read the host's height, and treated any non-zero
  answer as "the view gave the card a height, leave it alone". Home
  Assistant's view gives the card a **minimum** of the full height, not a
  height: collapsed it reads as the window, and then it grows with the
  content. So the card stood down on exactly the layout it was written to
  fix, and the DW tile stayed at 1172px inside a 499px window.
- The collapsed reading is now used as the height rather than as a reason
  to do nothing — it answers the only question that matters, which is how
  much room the view gives the card when nothing inside is pushing. A
  height from the view is used as-is; a card the view gives nothing at all
  still falls back to measuring the window.
- The height is also capped at what is visible below where the card starts,
  so a view handing out a minimum taller than the screen cannot push the
  card off the bottom either.

## v1.12.0

- **New image size: `side`.** The sheet takes the whole lower half of the
  card, and זמני היום folds into two columns beside it — six tiles as 2×3
  rather than a strip of six, so each tile gets a third of the height
  instead of a sliver. The clock, weather and status indicators are
  untouched; the Daily Information row and the footer stand down, as they
  already did for an in-card sheet.
- On a 951×499 screen that takes a 5000×3520 sheet from 345×243 to
  **476×335** — 1.85× the area — with the rest of the dashboard still up.
  `full` is still bigger (683×481) but shows nothing else.
- In side mode the card is two rows rather than four, so `layout.zmanim`
  no longer divides anything — the columns do that instead. It still
  applies to every other mode, and everything returns the moment the
  sheet stops showing.
- Pick it from **Size** in the editor's Bottom Area section.

## v1.13.0

- **New bottom block: `schedule`.** Draws a whole week's shul zmanim from
  `sensor.shul_zmanim`'s `days` attribute — a day to a column, zman ·
  dotted leader · time, note underneath, shaped like the printed luach.
- It takes **no list of rows**. The sheet behind it is rewritten weekly
  and its row keys change with it, so a card naming those keys quietly
  rots: on this setup `skver_tish_day` and `skver_gitvoch` were already
  `unavailable` and `skver_kabalas_shabbos` — labelled Kabbolas Shabbos —
  was showing מנחה. Reading the sheet's own structure ends that whole
  class of breakage.
- Hebrew sheets render right-to-left and English ones don't, decided per
  sheet. Times are bidi-isolated so `3:15 PM` doesn't invert inside an
  RTL row, notes set their own direction line by line, and a time cell
  Google hands over as `0` draws blank rather than as a zero.
- The Daily Information heading and the footer stand down while it shows,
  as they already do for a sheet image. An `image` block outranks it.
- Rows that expire through the sheet's `remove by` column simply aren't
  in the data, so nothing here has to know about them.

## v1.13.1

- **Schedule notes wrap in full** instead of being cut at two lines.
- Which means a wordy sheet is taller than a terse one while the box
  stays the same size, so the block now measures itself and shrinks as
  one piece until it fits — down to 70%, past which it stops, since
  unreadable is worse than not fitting. A sheet that already fits is
  never shrunk. Re-fits when the sheet changes or the window resizes.
- On this setup the real sheet needs no shrinking at all (every note
  still lands on one line); a deliberately wordy one, every note long
  enough to wrap twice, fits at 90% with all 18 rows intact.

## v1.13.2

- **A day with one zman no longer lands alone at the bottom of its
  column.** The rows were spread to fill the column height, which reads
  well on a full day and absurdly on a short one — a single סליחות row
  sat at the very bottom of an otherwise empty box. Rows now start at
  the top and read down, which is how the printed sheet reads too.
- Caught on a three-day sheet with 1, 10 and 9 rows; the two full days
  still fill their columns, because their content nearly does anyway.
