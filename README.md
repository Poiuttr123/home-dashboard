# Home Display Card

A full dashboard-style Lovelace card for Home Assistant: clock, weather with a
5-day forecast, zmanim, special times, a configurable "Daily Information" sensor
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
forecast:
  enabled: true
  days: 5
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

Controls the multi-day forecast strip under the current conditions.

- `enabled` — `true`/`false`. When `false`, the strip is hidden and the
  details line falls back to today's `High … / Low …` instead.
- `days` — how many days to show, `1`–`7` (default `5`). Fewer are shown if
  the weather entity provides fewer.

The forecast is requested over Home Assistant's websocket connection
(`weather/subscribe_forecast`), so it updates as the integration pushes new
data. Home Assistant removed the old `forecast` entity attribute in 2024.4;
the card still falls back to it if it's present, so older cores keep working.

Not every weather integration provides a daily forecast. If yours doesn't,
the strip stays hidden and the rest of the weather card is unaffected.

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

The **Weather Forecast** section of the visual editor has a matching toggle
and a **Days** dropdown.

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
