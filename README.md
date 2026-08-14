# Home Display Card

A full dashboard-style Lovelace card for Home Assistant: clock, weather, zmanim,
special times, a configurable "Daily Information" sensor list, and a wedding
countdown iframe.

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

## Development

The card is a single, dependency-free JavaScript file
(`home-display-card.js`) that registers two custom elements:

- `home-display-card` — the card itself.
- `home-display-card-editor` — the visual configuration editor, used by
  Home Assistant's dashboard editor UI (`getConfigElement`).
