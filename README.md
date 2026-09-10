# Home Display Card

A full dashboard-style Lovelace card for Home Assistant: clock, weather with 5-day
and hourly forecasts, zmanim, special times, a configurable "Daily Information" sensor
list, and a toggleable bottom-right panel (wedding countdown iframe by default,
or your own uploaded image).

This is a **frontend card** (plain JavaScript, no backend integration), installed
through HACS as a **Plugin**.

## Installation (HACS)

1. In Home Assistant, go to **HACS → Frontend**.
2. Click the **⋮** menu → **Custom repositories**.
3. Add this repository URL, category **Plugin**.
4. Install **Home Display Card**.
5. Home Assistant should add the resource automatically. If not, go to
   **Settings → Dashboards → Resources** and add:
   - URL: `/hacsfiles/home-dashboard/home-display-card.js`
   - Type: `JavaScript Module`

## Usage

Add the card through the dashboard UI ("Add Card" → search for **Home Display
Card**) to use the visual editor, or add it directly via YAML:

```yaml
type: custom:home-display-card
entities:
  weather: weather.home
  jewish_date: sensor.yidcal_full_display
  daf_yomi: sensor.yidcal_daf_hayomi
  alos: sensor.yidcal_alos
  netz: sensor.yidcal_netz
  shma_mga: sensor.yidcal_sof_zman_krias_shma_mga
  shma_gra: sensor.yidcal_sof_zman_krias_shma_gra
  shkia: sensor.yidcal_shkia
  maariv: sensor.yidcal_zman_maariv_rt
  erev: sensor.yidcal_zman_erev
  motzi: sensor.yidcal_zman_motzi
status:
  - entity: switch.refrigerator_sabbath_mode
    name: Fridge Shabbos
    on_label: "Yes"
    off_label: "No"
  - entity: switch.100w_mikvah
    name: Mikvah
    expected: binary_sensor.mikvah_should_be_on
status_position: daily_bottom   # daily_bottom | daily_top | footer
layout:
  zmanim: 14        # height share of the זמני היום row, out of 100
  bottom_crop: 0    # % of the page your display cuts off the bottom
forecast:
  enabled: true
  days: 5
  hourly: true
  hours: 6
sensors:
  - entity: sensor.example_one
  - entity: sensor.example_two
    name: Custom label
image_panel:
  enabled: true
  mode: default   # "default" | "image" | "custom"
  image: ""
  custom_code: ""
```

### `entities`

Maps each part of the card to a Home Assistant entity. All keys are optional;
unspecified keys fall back to the defaults shown above.

### `forecast`

Controls the two forecast strips on the weather card: a **daily** one under
the current conditions, and an **hourly** one filling the space to their
right.

- `enabled` — `true`/`false` for the daily strip. When `false`, it's hidden
  and the details line falls back to today's `High … / Low …` instead.
- `days` — how many days to show, `1`–`7` (default `5`).
- `hourly` — `true`/`false` for the hourly strip.
- `hours` — how many hours to show, `1`–`12` (default `6`). On a wide
  dashboard, raise this: the strip spreads its columns across the whole
  width, so more hours read better than fewer. The first column
  is labelled `Now`, and clock times follow Home Assistant's 12/24-hour
  setting.

Both are requested over Home Assistant's websocket connection
(`weather/subscribe_forecast`), so they update as the integration pushes new
data. Home Assistant removed the old `forecast` entity attribute in 2024.4;
the daily strip still falls back to it if present, so older cores keep
working.

The two are independent: each is its own subscription, so a weather entity
offering only one kind still shows that strip and quietly hides the other.
Fewer columns are drawn if the entity provides fewer than requested, and a
strip with no data at all stays hidden without affecting the rest of the
card.

### `status`

A list of on/off indicators shown as a row of chips, where the colour
carries the meaning:

| Colour | Meaning |
| --- | --- |
| Green | On |
| Dim blue-grey | Off |
| Red | Something is wrong — see below |

Each entry is either an entity ID string, or an object:

- `entity` — the switch, `binary_sensor` or `input_boolean` to read.
- `name` — optional label (defaults to the entity's friendly name).
- `on_label` / `off_label` — optional text for each state (default `On`
  and `Off`). Use `Yes`/`No` where that reads better.
- `expected` — optional entity describing what this one *should* be.
- `stale_after` — optional minutes of silence before the device counts as
  offline. Omit to skip the check.
- `stale_entity` — optional entity to check the freshness of instead of
  this one.
- `grace` — seconds an `unavailable` blip must last before it turns red
  (default `180`; `0` alarms immediately).

A red row **blinks brightly** so it can't be missed from across a room.
(Under the system's reduced-motion setting it stays bright but still.)

A row turns red in four cases:

1. **Unreachable** — the entity is `unavailable`, `unknown`, or has no
   state, so the card can't vouch for what it shows. Displays
   `Unavailable`, once the outage outlasts `grace`.

   Cloud-backed devices drop out for a few seconds many times an hour;
   one Samsung fridge here blips up to ~140 seconds, several times an
   hour. Alarming on each blip would teach you to ignore the colour, so
   the last trustworthy value is held until the outage lasts long enough
   to mean something. A real outage lasts hours, so this only delays a
   genuine alarm by `grace`. With no earlier trustworthy value to fall
   back on, it alarms straight away rather than inventing a reassuring
   one.
2. **Missing** — no such entity, usually a typo or a removed device.
   Displays `Missing`. This is deliberately not shown as "Off", which
   would be a confident lie.
3. **Offline** — `stale_after` is set and nothing has been written for
   that entity in that long. Displays `Offline (3h21m)`.
4. **Disagreement** — `expected` is set and the two entities disagree,
   i.e. the device didn't do what it was told. Displays the real state
   plus what was wanted, e.g. `Off (want On)`.

Case 3 exists because a cloud integration can stop delivering updates
without ever marking anything `unavailable` — it keeps serving the last
value it saw, which renders as a calm, healthy-looking `Off`. That is the
most dangerous way for an indicator like this to fail.

Pick `stale_entity` carefully: a switch can legitimately sit unchanged for
hours, so it makes a poor heartbeat. The busiest entity on the same device
(a power or energy sensor) is a much better one. For example, watching a
fridge's Sabbath switch but checking its power sensor's freshness:

```yaml
- entity: switch.refrigerator_sabbath_mode
  name: Fridge Shabbos
  on_label: "Yes"
  off_label: "No"
  stale_after: 30
  stale_entity: sensor.refrigerator_power
```

Offline outranks disagreement: if the device can't be seen, what it
*should* be is beside the point.

That third case is the useful one for anything driven by an automation:
pair the switch with the sensor that says whether it should be on, and a
command that silently failed shows up in red instead of looking normal.

If `status` is empty the row collapses and the card looks exactly as it
did before.

### `top_right`

The top-right box is a stack of blocks. Each one shows only when its own
conditions pass, so the same corner can carry different things on
different days.

```yaml
top_right:
  # The built-in erev / motzi / daf rows, only when they matter
  - type: special_times
    show_when:
      - binary_sensor.yidcal_no_melucha   # Shabbos and Yom Tov
      - binary_sensor.yidcal_erev         # erev
  # Indicators, always
  - type: status
  # Your own rows, on weekdays only
  - type: sensors
    title: Shul
    show_when: []
    sensors:
      - entity: sensor.shul_zmanim_skver_shachris
        name: שחרית
```

Block types:

- `special_times` — the built-in erev / motzi / daf rows. Heading
  defaults to "Special Times"; set `title` to change it.
- `status` — the indicator chips from `status`. A visible `status` block
  here overrides `status_position`.
- `sensors` — your own name/value rows, same shape as the top-level
  `sensors` list.

Every block takes:

- `title` — optional heading.
- `show_when` — a list of entities. The block shows when **any** of them
  is on; an empty list means always. An entity that is missing,
  `unavailable`, or off counts as off.

Blocks render in the order listed. If none qualify, the box disappears
entirely and the clock and weather take the width back. If more blocks
qualify than fit, the box clips at the bottom rather than letting them
overlap — so keep the conditions tight enough that only what matters is
showing at once.

### `bottom`

The bottom of the card works like `top_right`: a stack of blocks, each
shown only when its conditions pass. Use it to put a printed sheet up
instead of the sensor list on the days you have one.

```yaml
bottom:
  - type: image
    image: /api/image/serve/<id>/original
    fill: full
    show_when:
      - binary_sensor.yidcal_upcoming_yomtov
  - type: sensors        # the usual Daily Information list
    show_when: []
```

- `sensors` — the Daily Information grid (the top-level `sensors` list).
- `image` — an uploaded image, drawn with `object-fit: contain` so a
  page of times is never cropped at the edges.

`fill` decides how much room an image gets:

| `fill` | Where | A 5000×3520 sheet on a 1440×505 screen |
| --- | --- | --- |
| `full` | The whole card, hiding the dashboard while it shows | 692×487 — 14% of original |
| `row` | The whole bottom row; the side panel stands down | 270×190 |
| `daily` | Inside the Daily Information box (default) | 270×190 |

Height is the constraint, and every inner box is short, so `full` is the
only one that makes a page of small print readable — `row` buys width
the image cannot use. For a simple graphic the smaller fills are fine.

Upload the image from the **Bottom Area** section of the editor; it uses
Home Assistant's Image Upload integration, same as the bottom-right
panel. An `image` block with no image set is skipped, so a later
`sensors` block still shows.

If no block qualifies, the Daily Information card is dropped rather than
left as a titled blank.

### `status_position`

Where the indicator row goes. One of:

- `daily_bottom` (default) — below the sensor rows in the **Daily
  Information** card, in the space under them.
- `daily_top` — above the sensor rows, directly under the card title.
- `footer` — its own card in the bottom bar, between the daf yomi and
  the connection pill. Doesn't wrap, so it suits two or three short
  indicators rather than many.

The **Position** dropdown in the editor's **Status Indicators** section
sets this. Whichever two slots aren't in use collapse to nothing.

### `layout`

- `zmanim` — how much of the card's height the זמני היום row takes, out
  of 100 (default `14`, range 6–30). Whatever it gives up goes to the
  Daily Information card below it, so the shares always total 100.
- `bottom_crop` — percent of the page height your display cuts off at
  the bottom (default `0`, max `40`).

`bottom_crop` exists for screens that show less of the page than the
browser renders. A DW Spectrum video-wall tile does this: the page is
laid out at full height, the tile shows only the top of it, and the
footer falls past the visible edge — so it looks like the footer is
missing rather than cropped. Setting the percentage being lost makes the
card lay itself out inside what is actually on screen. Leave it at `0`
for a normal browser or tablet.

To find the right value, measure how much of the card you can see and how
much you expect: a tile showing 500px of a 555px render is losing ~10%.

### `sensors`

A list of entities to show in the **Daily Information** grid, in the order
given. Each entry is either an entity ID string, or an object:

```yaml
sensors:
  - sensor.example_one
  - entity: sensor.example_two
    name: Custom label       # optional, overrides the friendly name
    attribute: Alos_Simple   # optional, reads this attribute instead of state
```

Add and remove rows for this list from the card's visual editor, or edit the
YAML directly. Each row also has a **Value** dropdown, populated from the
selected entity's current attributes — pick one to display that attribute
instead of the entity's state (defaults to "State").

If `sensors` is empty, the card falls back to auto-detecting entities that
have a `sheet_name` attribute (e.g. sensors created from a Google Sheet),
sorted by their `row_index` attribute — this preserves the card's original
behavior.

### `image_panel`

Controls the bottom-right panel:

- `enabled` — `true`/`false`. When `false`, the panel is hidden and the
  Daily Information card expands to fill the row.
- `mode` — `default` (wedding countdown iframe), `image` (a static uploaded
  image), or `custom` (your own JavaScript).
- `image` — used when `mode: image`. A URL to display, normally set for you
  by the visual editor's upload button.
- `custom_code` — used when `mode: custom`. Raw JavaScript, run inside a
  sandboxed `<iframe sandbox="allow-scripts">` with `srcdoc` (an
  origin-isolated environment: no access to Home Assistant, your login
  session, cookies, or the rest of the dashboard — it can only draw into its
  own document). Whatever it renders fills the panel.

The **Weather Forecast** section of the visual editor has a toggle and a
count dropdown for each strip.

In the visual editor, the **Bottom Right Panel** section has a toggle, a
**Content** dropdown for the three modes above, and mode-specific controls:
an upload button for `image` mode (uploads to Home Assistant's built-in
Image Upload integration, `/api/image/upload`, and stores the resulting
`/api/image/serve/<id>/original` URL), or a code textarea for `custom` mode.

There's no generic file-upload API in Home Assistant for arbitrary files
like `.js` — the Image Upload integration only accepts and processes images.
To run your own script/widget, paste its code directly into `custom_code`.
(The `default` mode's file path, `/local/wedding-countdown-new.html`, is
still fixed — same as the card's original behavior — so replacing that
countdown with something else entirely means either using `custom_code`, or
overwriting that file yourself in `config/www/`.)

## Updating

Because this is a HACS **Plugin** resource, browsers can cache the old
`home-display-card.js` aggressively. After updating through HACS, do a hard
refresh (Ctrl/Cmd+Shift+R) or bump the resource version query string under
**Settings → Dashboards → Resources** (e.g. `...home-display-card.js?v=2`) so
the new visual editor (including sensor add/remove and the image panel
controls) actually loads.

## Development

The card is a single, dependency-free JavaScript file
(`home-display-card.js`) that registers two custom elements:

- `home-display-card` — the card itself.
- `home-display-card-editor` — the visual configuration editor, used by
  Home Assistant's dashboard editor UI (`getConfigElement`).
