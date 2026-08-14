# Home Display Card

A full dashboard-style Lovelace card for Home Assistant: clock, weather, zmanim,
special times, a configurable "Daily Information" sensor list, and a toggleable
bottom-right panel (wedding countdown iframe by default, or your own uploaded
image).

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
sensors:
  - entity: sensor.example_one
  - entity: sensor.example_two
    name: Custom label
image_panel:
  enabled: true
  image: ""
```

### `entities`

Maps each part of the card to a Home Assistant entity. All keys are optional;
unspecified keys fall back to the defaults shown above.

### `sensors`

A list of entities to show in the **Daily Information** grid, in the order
given. Each entry is either an entity ID string, or an object:

```yaml
sensors:
  - sensor.example_one
  - entity: sensor.example_two
    name: Custom label   # optional, overrides the friendly name
```

Add and remove rows for this list from the card's visual editor, or edit the
YAML directly.

If `sensors` is empty, the card falls back to auto-detecting entities that
have a `sheet_name` attribute (e.g. sensors created from a Google Sheet),
sorted by their `row_index` attribute — this preserves the card's original
behavior.

### `image_panel`

Controls the bottom-right panel:

- `enabled` — `true`/`false`. When `false`, the panel is hidden and the
  Daily Information card expands to fill the row.
- `image` — a URL to display as a static image instead of the wedding
  countdown iframe. Leave empty to keep the iframe.

In the visual editor, use the **Bottom Right Panel** section to toggle
visibility and upload an image file directly — the file is uploaded to Home
Assistant's built-in Image Upload integration (`/api/image/upload`) and the
resulting `/api/image/serve/<id>/original` URL is stored in `image`. Uploading
a new image or clicking **Remove uploaded image** reverts to the wedding
countdown iframe.

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
