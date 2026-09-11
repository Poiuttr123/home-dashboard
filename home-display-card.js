/**
 * Home Display Card
 * A full dashboard-style Lovelace card: clock, weather with a multi-day
 * forecast, zmanim, special times, a configurable "Daily Information" sensor
 * list, and a toggleable bottom-right panel (wedding countdown iframe by
 * default, or an uploaded image).
 */

const CARD_VERSION = "1.13.2";

console.info(
  `%c HOME-DISPLAY-CARD %c v${CARD_VERSION} `,
  "color: white; background: #039be5; font-weight: 700; border-radius: 3px 0 0 3px; padding: 2px 0 2px 6px;",
  "color: #039be5; background: white; font-weight: 700; border-radius: 0 3px 3px 0; padding: 2px 6px 2px 0;"
);

const DEFAULT_ENTITIES = {
  weather: "weather.home",
  jewish_date: "sensor.yidcal_full_display",
  daf_yomi: "sensor.yidcal_daf_hayomi",
  alos: "sensor.yidcal_alos",
  netz: "sensor.yidcal_netz",
  shma_mga: "sensor.yidcal_sof_zman_krias_shma_mga",
  shma_gra: "sensor.yidcal_sof_zman_krias_shma_gra",
  shkia: "sensor.yidcal_shkia",
  maariv: "sensor.yidcal_zman_maariv_rt",
  erev: "sensor.yidcal_zman_erev",
  motzi: "sensor.yidcal_zman_motzi",
};

// Zmanim/special-times rows: which attribute to read off each entity, and
// which element in the template each one renders into.
const ZMAN_ROWS = [
  { key: "alos", elementId: "alos", attribute: "Alos_Simple" },
  { key: "netz", elementId: "netz", attribute: "Netz_Simple" },
  { key: "shma_mga", elementId: "shmaMga", attribute: "Krias_Shma_MGA_Simple" },
  { key: "shma_gra", elementId: "shmaGra", attribute: "krias_Shma_GRA_Simple" },
  { key: "shkia", elementId: "shkia", attribute: "Shkia_Simple" },
  { key: "maariv", elementId: "maariv", attribute: "Maariv_RT_Simple" },
];

const SPECIAL_ROWS = [
  { key: "erev", elementId: "erev", attribute: "Zman_Erev_Simple" },
  { key: "motzi", elementId: "motzi", attribute: "Zman_Motzi_Simple" },
];

const DEFAULT_IFRAME_SRC = "/local/wedding-countdown-new.html";

const IMAGE_PANEL_MODES = ["default", "image", "custom"];

const DEFAULT_FORECAST = {
  enabled: true,
  days: 5,
  hourly: true,
  hours: 6,
};

const MIN_FORECAST_DAYS = 1;
const MAX_FORECAST_DAYS = 7;

const MIN_FORECAST_HOURS = 1;
const MAX_FORECAST_HOURS = 12;

const DEFAULT_IMAGE_PANEL = {
  enabled: true,
  mode: "default",
  image: "",
  custom_code: "",
};

function buildCustomPanelHtml(code) {
  const safeCode = String(code ?? "").replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #eee4d5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  }
</style>
</head>
<body>
<script>
${safeCode}
</script>
</body>
</html>`;
}

export const ENTITY_SECTIONS = [
  {
    title: "Weather & Date",
    fields: [
      { key: "weather", label: "Weather entity", filterDomain: "weather" },
      { key: "jewish_date", label: "Jewish date sensor", filterDomain: "sensor" },
      { key: "daf_yomi", label: "Daf Yomi sensor", filterDomain: "sensor" },
    ],
  },
  {
    title: "Zmanim",
    fields: [
      { key: "alos", label: "עלות / Alos", filterDomain: "sensor" },
      { key: "netz", label: "נץ / Netz", filterDomain: "sensor" },
      { key: "shma_mga", label: "קרי׳״ש א / Shma MGA", filterDomain: "sensor" },
      { key: "shma_gra", label: "קרי׳״ש ב / Shma GRA", filterDomain: "sensor" },
      { key: "shkia", label: "שקיעה / Shkia", filterDomain: "sensor" },
      { key: "maariv", label: "מעריב / Maariv", filterDomain: "sensor" },
    ],
  },
  {
    title: "Special Times",
    fields: [
      { key: "erev", label: "זמן ערב / Erev", filterDomain: "sensor" },
      { key: "motzi", label: "זמן מוצאי / Motzi", filterDomain: "sensor" },
    ],
  },
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

// Row shares of the dashboard grid. They must total 100, so whatever the
// zmanim row gives up is handed to Daily Information — the row with slack.
const LAYOUT_TOP_FR = 28;
const LAYOUT_FOOTER_FR = 9;
const LAYOUT_ZMANIM_BASE = 20;
const LAYOUT_DAILY_BASE = 43;

const DEFAULT_LAYOUT = {
  zmanim: 14,
  bottom_crop: 0,
};

const MIN_ZMANIM_FR = 6;
const MAX_ZMANIM_FR = 30;
const MAX_BOTTOM_CROP = 40;

// Below this the host clearly has no height of its own to divide, so
// the card measures the window instead. A dashboard card shorter than
// this is not readable anyway.
const MIN_PAGE_HEIGHT = 120;

const PAGE_HEIGHT_TTL = 1000;

function normalizeLayout(source) {
  const provided = source || {};

  const zmanim = Number.parseInt(provided.zmanim, 10);
  const crop = Number.parseInt(provided.bottom_crop, 10);

  return {
    zmanim: Number.isFinite(zmanim)
      ? Math.min(MAX_ZMANIM_FR, Math.max(MIN_ZMANIM_FR, zmanim))
      : DEFAULT_LAYOUT.zmanim,
    bottom_crop: Number.isFinite(crop)
      ? Math.min(MAX_BOTTOM_CROP, Math.max(0, crop))
      : DEFAULT_LAYOUT.bottom_crop,
  };
}

const STATUS_POSITIONS = ["special", "daily_top", "daily_bottom", "footer"];

/* ============================================================
   TOP-RIGHT BLOCKS

   The top-right box is a stack of blocks, each shown only when its
   own condition passes, so the same corner can carry different
   things on different days.
   ============================================================ */

const TOP_RIGHT_TYPES = ["special_times", "status", "sensors"];

/* ============================================================
   BOTTOM BLOCKS

   The bottom area is the same idea as the top-right: a stack of
   blocks, each shown only when its own conditions pass. An image
   block is how a printed sheet gets on screen instead of the
   sensor list.
   ============================================================ */

const BOTTOM_TYPES = ["sensors", "image", "schedule"];

// The shul schedule this week, straight off the sheet: one entity with
// every row on it, grouped by day. No per-row config, because the rows
// are rewritten weekly and anything naming them goes stale.
const DEFAULT_SCHEDULE_ENTITY = "sensor.shul_zmanim";

const MAX_SCHEDULE_DAYS = 4;

// How far the schedule may shrink itself to get a long sheet to fit.
// Past this it would be unreadable from across a room, which is worse
// than the sheet not fitting.
const SCHEDULE_MIN_SCALE = 0.7;

const SCHEDULE_SCALE_STEP = 0.05;

// A day label or zman name with Hebrew in it means the whole block
// reads right to left, the way the printed luach does.
const HEBREW_RE = /[\u0590-\u05FF]/;

// Where an image block is allowed to draw. Height is what limits a
// dense sheet, and the bottom row is short. "side" folds the
// זמני היום strip into two columns and gives the image everything
// below the top row beside it; "full" takes over the whole card.
const IMAGE_FILLS = ["daily", "row", "side", "full"];

const DEFAULT_BOTTOM = [{ type: "sensors", show_when: [] }];

function normalizeBottomBlock(block) {
  if (typeof block === "string") {
    return BOTTOM_TYPES.includes(block)
      ? {
          type: block,
          show_when: [],
          image: "",
          fill: "daily",
          entity: DEFAULT_SCHEDULE_ENTITY,
          notes: true,
        }
      : null;
  }

  if (!block || typeof block !== "object") return null;

  const type = BOTTOM_TYPES.includes(block.type) ? block.type : "sensors";

  return {
    type,
    show_when: normalizeConditionList(block.show_when),
    image: block.image || "",
    fill: IMAGE_FILLS.includes(block.fill) ? block.fill : "daily",
    entity:
      typeof block.entity === "string" && block.entity
        ? block.entity
        : DEFAULT_SCHEDULE_ENTITY,
    notes: block.notes !== false,
  };
}

function normalizeBottom(source) {
  if (!Array.isArray(source)) {
    return DEFAULT_BOTTOM.map(normalizeBottomBlock);
  }

  return source.map(normalizeBottomBlock).filter(Boolean);
}

const DEFAULT_TOP_RIGHT = [{ type: "special_times", show_when: [] }];

function normalizeConditionList(value) {
  return Array.isArray(value)
    ? value
        .map(entry => (typeof entry === "string" ? entry : entry?.entity || ""))
        .filter(Boolean)
    : [];
}

function normalizeTopRightBlock(block) {
  if (typeof block === "string") {
    return TOP_RIGHT_TYPES.includes(block)
      ? { type: block, title: "", show_when: [], sensors: [] }
      : null;
  }

  if (!block || typeof block !== "object") return null;

  const type = TOP_RIGHT_TYPES.includes(block.type)
    ? block.type
    : "special_times";

  return {
    type,
    title: block.title || "",
    show_when: normalizeConditionList(block.show_when),
    sensors: Array.isArray(block.sensors)
      ? block.sensors.map(normalizeSensorEntry).filter(Boolean)
      : [],
  };
}

function normalizeTopRight(source) {
  if (!Array.isArray(source)) {
    return DEFAULT_TOP_RIGHT.map(normalizeTopRightBlock);
  }

  return source.map(normalizeTopRightBlock).filter(Boolean);
}

const DEFAULT_STATUS_POSITION = "daily_bottom";

// What counts as "on" for a switch, binary_sensor or input_boolean.
const STATUS_ON_STATES = new Set([
  "on", "true", "yes", "open", "home", "active", "enabled",
]);

// States that mean the card cannot trust the value at all.
const STATUS_ERROR_STATES = new Set([
  "unavailable", "unknown", "none", "error", "fault",
]);

// Cloud-backed devices flick to unavailable for a few seconds many times
// an hour. Alarming on each blip would train the eye to ignore the colour,
// so an outage has to last this long before it counts.
const DEFAULT_STATUS_GRACE = 180;

function normalizeGrace(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_STATUS_GRACE;
  }

  const seconds = Number.parseInt(value, 10);

  return Number.isFinite(seconds) && seconds >= 0
    ? seconds
    : DEFAULT_STATUS_GRACE;
}

function normalizeStaleAfter(value) {
  const minutes = Number.parseInt(value, 10);

  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function normalizeStatusEntry(entry) {
  if (typeof entry === "string") {
    return entry
      ? {
          entity: entry,
          name: "",
          on_label: "",
          off_label: "",
          expected: "",
          stale_after: 0,
          stale_entity: "",
          grace: DEFAULT_STATUS_GRACE,
        }
      : null;
  }
  if (entry && typeof entry === "object" && entry.entity) {
    return {
      entity: entry.entity,
      name: entry.name || "",
      on_label: entry.on_label || "",
      off_label: entry.off_label || "",
      expected: entry.expected || "",
      stale_after: normalizeStaleAfter(entry.stale_after),
      stale_entity: entry.stale_entity || "",
      grace: normalizeGrace(entry.grace),
    };
  }
  return null;
}

function normalizeSensorEntry(entry) {
  if (typeof entry === "string") {
    return entry ? { entity: entry, name: "", attribute: "" } : null;
  }
  if (entry && typeof entry === "object" && entry.entity) {
    return {
      entity: entry.entity,
      name: entry.name || "",
      attribute: entry.attribute || "",
    };
  }
  return null;
}

export function normalizeConfig(config) {
  const source = config || {};
  const entities = { ...DEFAULT_ENTITIES, ...(source.entities || {}) };
  const sensors = Array.isArray(source.sensors)
    ? source.sensors.map(normalizeSensorEntry).filter(Boolean)
    : [];

  const status = Array.isArray(source.status)
    ? source.status.map(normalizeStatusEntry).filter(Boolean)
    : [];

  const top_right = normalizeTopRight(source.top_right);

  const bottom = normalizeBottom(source.bottom);

  const status_position = STATUS_POSITIONS.includes(source.status_position)
    ? source.status_position
    : DEFAULT_STATUS_POSITION;

  const providedPanel = source.image_panel || {};
  const image_panel = { ...DEFAULT_IMAGE_PANEL, ...providedPanel };

  if (!providedPanel.mode) {
    // Back-compat: configs saved before "mode" existed only had `image`.
    image_panel.mode = providedPanel.image ? "image" : "default";
  }
  if (!IMAGE_PANEL_MODES.includes(image_panel.mode)) {
    image_panel.mode = "default";
  }

  const forecast = { ...DEFAULT_FORECAST, ...(source.forecast || {}) };

  forecast.enabled = forecast.enabled !== false;

  const days = Number.parseInt(forecast.days, 10);

  forecast.days = Number.isFinite(days)
    ? Math.min(MAX_FORECAST_DAYS, Math.max(MIN_FORECAST_DAYS, days))
    : DEFAULT_FORECAST.days;

  forecast.hourly = forecast.hourly !== false;

  const hours = Number.parseInt(forecast.hours, 10);

  forecast.hours = Number.isFinite(hours)
    ? Math.min(MAX_FORECAST_HOURS, Math.max(MIN_FORECAST_HOURS, hours))
    : DEFAULT_FORECAST.hours;

  const layout = normalizeLayout(source.layout);

  return {
    entities,
    sensors,
    status,
    status_position,
    top_right,
    bottom,
    image_panel,
    forecast,
    layout,
  };
}

class HomeDisplayCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = normalizeConfig({});
    this._clockTimer = null;
    this._lastSheetSignature = "";
    this._lastStatusSignature = "";
    this._lastTopRightSignature = null;
    // Last trustworthy value per entity, held across short outages.
    this._statusLastGood = {};
    this._lastCustomCode = null;

    // One independent subscription per forecast type.
    this._forecastState = {
      daily: this.blankForecastState(),
      hourly: this.blankForecastState(),
    };
  }

  blankForecastState() {
    return {
      data: [],
      entityId: null,
      unsub: null,
      token: null,
      pending: false,
      signature: null,
    };
  }

  static getConfigElement() {
    return document.createElement("home-display-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:home-display-card",
      entities: { ...DEFAULT_ENTITIES },
      sensors: [],
      status: [],
      status_position: DEFAULT_STATUS_POSITION,
      top_right: [{ type: "special_times", show_when: [] }],
      bottom: [{ type: "sensors", show_when: [] }],
      layout: { ...DEFAULT_LAYOUT },
      image_panel: { ...DEFAULT_IMAGE_PANEL },
      forecast: { ...DEFAULT_FORECAST },
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = normalizeConfig(config);
    if (this._hass) {
      this.syncForecastSubscriptions();
      this.updateData();
    }
  }

  getCardSize() {
    return 8;
  }

  set hass(hass) {
    this._hass = hass;

    if (!this.shadowRoot.innerHTML) {
      this.render();
      this.startClock();
    }

    this.syncForecastSubscriptions();
    this.updateData();
  }

  connectedCallback() {
    if (!this._clockTimer) {
      this.startClock();
    }

    // A height measured against the old window is worth nothing, so
    // throw it away and lay the card out again at the new size.
    if (!this._resizeListener) {
      this._resizeListener = () => {
        this._pageHeightKey = null;
        this.applyLayout();
      };

      window.addEventListener("resize", this._resizeListener);
    }

    if (this._hass) {
      this.syncForecastSubscriptions();
    }
  }

  disconnectedCallback() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }

    if (this._resizeListener) {
      window.removeEventListener("resize", this._resizeListener);
      this._resizeListener = null;
    }

    this.unsubscribeForecasts();
  }

  getEntity(entityId) {
    return entityId ? this._hass?.states?.[entityId] : undefined;
  }

  getState(entityId, fallback = "--") {
    const entity = this.getEntity(entityId);

    if (!entity) return fallback;

    const value = entity.state;

    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === "unknown" ||
      value === "unavailable"
    ) {
      return fallback;
    }

    return value;
  }

  getAttr(entityId, attribute, fallback = "--") {
    const entity = this.getEntity(entityId);

    if (!entity?.attributes) return fallback;

    const value = entity.attributes[attribute];

    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === "unknown" ||
      value === "unavailable"
    ) {
      return fallback;
    }

    return value;
  }

  setText(id, value) {
    const element = this.shadowRoot.getElementById(id);

    if (element) {
      element.textContent = value ?? "--";
    }
  }

  weatherEmoji(condition) {
    const icons = {
      "clear-night": "🌙",
      cloudy: "☁️",
      fog: "🌫️",
      hail: "🌨️",
      lightning: "⛈️",
      "lightning-rainy": "⛈️",
      partlycloudy: "⛅",
      pouring: "🌧️",
      rainy: "🌧️",
      snowy: "❄️",
      "snowy-rainy": "🌨️",
      sunny: "☀️",
      windy: "💨",
      "windy-variant": "🌬️",
    };

    return icons[condition] || "🌤️";
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 15% 0%,
              rgba(20, 95, 150, 0.16),
              transparent 28%
            ),
            #04131f;

          color: #f4f8fb;

          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Arial,
            sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        .page {
          width: 100%;
          height: 100%;
          overflow: hidden;
          padding: 9px;
        }

        .dashboard {
          width: 100%;
          height: 100%;

          display: grid;

          grid-template-rows:
            minmax(0, 28fr)
            minmax(0, 20fr)
            minmax(0, 43fr)
            minmax(0, 9fr);

          gap: 8px;
        }

        .card {
          min-width: 0;
          min-height: 0;

          overflow: hidden;

          background:
            linear-gradient(
              145deg,
              rgba(10, 35, 54, 0.98),
              rgba(6, 24, 38, 0.99)
            );

          border:
            1px solid rgba(86, 172, 225, 0.18);

          border-radius: 14px;

          box-shadow:
            0 5px 18px rgba(0,0,0,.22);
        }


        /* ======================================================
           TOP
           ====================================================== */

        .top {
          display: grid;
          grid-template-columns:
            minmax(0, 0.95fr)
            minmax(0, 1.35fr)
            minmax(0, 0.95fr);

          gap: 8px;

          min-height: 0;
        }

        .clock-card {
          height: 100%;
          padding: clamp(10px, 1.4vh, 18px);

          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .clock-line {
          display: flex;
          align-items: baseline;
          gap: 7px;
          white-space: nowrap;
        }

        #clock {
          font-size:
            clamp(38px, min(6.1vw, 9vh), 78px);

          line-height: .95;
          font-weight: 300;
          letter-spacing: -3px;
        }

        #seconds {
          font-size:
            clamp(13px, min(1.7vw, 2.8vh), 23px);

          color: #67889c;
          font-weight: 400;
        }

        #date {
          margin-top: clamp(8px, 1.5vh, 14px);

          font-size:
            clamp(12px, min(1.35vw, 2vh), 18px);

          color: #86bad8;
        }

        #jewishDate {
          margin-top: 6px;

          font-size:
            clamp(12px, min(1.4vw, 2.1vh), 19px);

          color: #d1e2ec;

          direction: rtl;
          text-align: left;

          line-height: 1.35;

          max-height: 2.8em;

          overflow: hidden;
        }


        /* ======================================================
           WEATHER
           ====================================================== */

        .weather-card {
          height: 100%;
          padding:
            clamp(9px, 1.3vh, 16px)
            clamp(12px, 1.5vw, 22px);

          display: grid;

          grid-template-rows:
            auto
            minmax(0, 1fr)
            auto
            auto;

          min-height: 0;
        }

        .section-title {
          font-size:
            clamp(10px, min(1vw, 1.6vh), 14px);

          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #5ebaf2;

          line-height: 1;
        }

        .weather-current {
          display: grid;

          /* icon | temp+condition | hourly strip. The strip takes the
             slack the first two columns don't use; with it hidden the
             block sits left exactly as before. */
          grid-template-columns:
            auto
            auto
            minmax(0, 1fr);

          gap: clamp(8px, 1.2vw, 18px);

          align-items: center;
          align-content: center;

          min-height: 0;
        }

        .weather-icon {
          font-size:
            clamp(26px, min(3.4vw, 5.4vh), 48px);

          line-height: 1;
        }

        .weather-temp {
          font-size:
            clamp(28px, min(3.8vw, 5.8vh), 52px);

          font-weight: 300;
          line-height: 1;
        }

        .weather-condition {
          margin-top: 4px;

          font-size:
            clamp(11px, min(1.2vw, 1.9vh), 17px);

          color: #8dbbd6;

          text-transform: capitalize;
        }

        .weather-details {
          display: flex;
          flex-wrap: wrap;

          gap: 5px 20px;

          color: #8eb8d1;

          font-size:
            clamp(9px, min(.95vw, 1.45vh), 13px);

          white-space: nowrap;
        }

        /* The high/low span is empty while the forecast strip is on;
           without this it would still take up a flex gap. */
        .weather-details span:empty {
          display: none;
        }

        .weather-hourly {
          display: grid;

          grid-template-columns:
            repeat(6, minmax(0, 1fr));

          gap: clamp(1px, .35vw, 6px);

          /* No justify-self here: the strip must STRETCH across its
             1fr column so it begins right after the current
             conditions and runs to the card edge. Sizing it to its
             content instead (justify-self: end) pinned it to the
             right and dumped every pixel of slack into one gap in
             the middle — very visible on a wide dashboard. */

          padding-left: clamp(8px, 1.1vw, 16px);

          border-left:
            1px solid rgba(86, 172, 225, 0.18);
        }

        .weather-hourly[hidden] {
          display: none;
        }

        /* Hour labels sit lighter than the daily weekday headers so
           the two strips don't compete. */
        .weather-hourly .forecast-name {
          color: #8dbbd6;
          letter-spacing: .2px;
        }

        .weather-hourly .forecast-icon {
          font-size:
            clamp(11px, min(1.35vw, 2.1vh), 20px);
        }

        /* Column count is set from the configured day count in
           renderForecast(); this is only the fallback. */
        .weather-forecast {
          display: grid;

          grid-template-columns:
            repeat(5, minmax(0, 1fr));

          gap: clamp(2px, .45vw, 7px);

          margin-top: clamp(5px, .9vh, 10px);
          padding-top: clamp(5px, .9vh, 10px);

          border-top:
            1px solid rgba(86, 172, 225, 0.18);
        }

        /* display:grid above would otherwise beat the UA [hidden] rule. */
        .weather-forecast[hidden] {
          display: none;
        }

        .forecast-day {
          min-width: 0;

          display: flex;
          flex-direction: column;
          align-items: center;

          gap: clamp(1px, .3vh, 3px);

          text-align: center;
        }

        .forecast-name {
          font-size:
            clamp(8px, min(.8vw, 1.25vh), 12px);

          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .6px;

          color: #5ebaf2;

          max-width: 100%;

          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .forecast-icon {
          font-size:
            clamp(13px, min(1.6vw, 2.5vh), 24px);

          line-height: 1;
        }

        .forecast-temps {
          display: flex;
          align-items: baseline;

          gap: 4px;

          white-space: nowrap;
        }

        .forecast-high {
          font-size:
            clamp(10px, min(1vw, 1.55vh), 15px);

          font-weight: 600;
        }

        .forecast-low {
          font-size:
            clamp(9px, min(.9vw, 1.4vh), 13px);

          color: #7ea6bf;
        }


        /* ======================================================
           SPECIAL TIMES
           ====================================================== */

        .special-times {
          height: 100%;

          padding:
            clamp(9px, 1.3vh, 16px)
            clamp(12px, 1.4vw, 20px);

          display: grid;

          grid-template-rows: minmax(0, 1fr);

          min-height: 0;
        }

        .special-blocks {
          display: flex;
          flex-direction: column;

          gap: clamp(4px, .7vh, 9px);

          min-height: 0;
          height: 100%;

          /* Too many blocks for the box clips at the bottom rather
             than spilling over the cards around it. */
          overflow: hidden;
        }

        .special-block {
          display: flex;
          flex-direction: column;

          /* No min-height: 0 here. That lets a block shrink below its
             own content, and the overflow then draws over the block
             beneath it instead of being clipped. Flex's default
             content-based minimum is what keeps blocks apart. */
        }

        /* The times fill whatever the other blocks leave, so a box with
           only times looks exactly as it always did. */
        .special-block-special_times {
          flex: 1 1 auto;
        }

        .special-block-status,
        .special-block-sensors {
          flex: 0 0 auto;
        }

        .special-block-title {
          margin-bottom: clamp(2px, .4vh, 5px);
        }

        .special-times[hidden] {
          display: none;
        }

        .special-rows {
          display: grid;

          /* min-content, not 0: when other blocks share the box these
             rows must stop shrinking at their text rather than
             collapsing to nothing and overlapping each other. */
          grid-template-rows:
            repeat(3, minmax(min-content, 1fr));

          min-height: 0;
        }

        .special-rows[hidden] {
          display: none;
        }

        /* With indicators sharing the box, the times give up some size
           so both fit without either being squeezed. */
        .special-times.has-indicators .special-label {
          font-size:
            clamp(9px, min(.92vw, 1.42vh), 13px);
        }

        .special-times.has-indicators .special-value {
          font-size:
            clamp(11px, min(1.25vw, 1.95vh), 17px);
        }

        .special-times.has-indicators .special-icon {
          width: clamp(16px, min(1.85vw, 2.9vh), 24px);
          height: clamp(16px, min(1.85vw, 2.9vh), 24px);

          font-size:
            clamp(9px, min(.95vw, 1.55vh), 13px);
        }

        /* This box is a narrow column, so indicators stack as rows
           rather than wrapping mid-chip. */
        /* A sheet shown instead of the sensor list. contain, never
           cover: cropping a page of times to fill a box loses the
           times at the edges. */
        .bottom-image {
          /* Explicitly the sensor grid's row. Left to flow it would get
             an implicit auto row sized to its own aspect ratio, which
             for a page-shaped sheet is far taller than the card. */
          grid-row: 3;

          width: 100%;
          height: 100%;

          min-height: 0;

          object-fit: contain;

          display: block;

          border-radius: 8px;
        }

        .bottom-image[hidden] {
          display: none;
        }

        /* fill: full - the image takes the whole card. Height is what
           limits a dense sheet and every inner box is short, so this is
           the only placement that makes small print readable. */
        .takeover {
          position: absolute;
          inset: 0;

          padding: 9px;

          background: #04131f;

          /* Plain block, not a centring grid: with place-items the
             image sizes itself against an auto grid area and grows past
             the card. object-fit does the centring anyway. */
          display: block;

          overflow: hidden;
        }

        .takeover[hidden] {
          display: none;
        }

        .takeover img {
          width: 100%;
          height: 100%;

          object-fit: contain;
        }

        .page {
          position: relative;
        }

        .indicator-strip-special {
          flex-direction: column;
          align-items: stretch;

          gap: clamp(3px, .5vh, 6px);

          margin-top: clamp(4px, .7vh, 8px);
          padding-top: clamp(5px, .8vh, 9px);

          border-top:
            1px solid rgba(86, 172, 225, 0.18);
        }

        .indicator-strip-special .indicator {
          justify-content: flex-start;
        }

        .special-row {
          display: grid;

          grid-template-columns:
            minmax(0,1fr)
            auto;

          gap: 9px;

          align-items: center;

          min-height: 0;

          border-bottom:
            1px solid rgba(255,255,255,.07);
        }

        .special-row:last-child {
          border-bottom: none;
        }

        .special-label {
          display: flex;
          align-items: center;

          gap: 7px;

          min-width: 0;

          color: #bdd5e4;

          font-size:
            clamp(10px, min(1.1vw, 1.7vh), 15px);

          direction: rtl;
          justify-content: flex-end;
        }

        .special-icon {
          width:
            clamp(21px, min(2.4vw, 3.8vh), 31px);

          height:
            clamp(21px, min(2.4vw, 3.8vh), 31px);

          display: grid;
          place-items: center;

          flex: 0 0 auto;

          border-radius: 7px;

          background:
            rgba(43, 143, 204, .12);

          font-size:
            clamp(11px, min(1.2vw, 2vh), 17px);
        }

        .special-value {
          font-size:
            clamp(13px, min(1.55vw, 2.4vh), 21px);

          font-weight: 750;

          white-space: nowrap;
        }


        /* ======================================================
           ZMANIM
           ====================================================== */

        .zmanim {
          height: 100%;

          padding:
            clamp(8px, 1vh, 12px)
            clamp(10px, 1.2vw, 16px);

          display: grid;

          grid-template-rows:
            auto
            1fr;

          gap: clamp(6px, 1vh, 10px);

          min-height: 0;
        }

        .zmanim-grid {
          display: grid;

          grid-template-columns:
            repeat(6, minmax(0,1fr));

          gap:
            clamp(4px, .6vw, 9px);

          min-height: 0;
        }

        .zman {
          min-width: 0;
          min-height: 0;

          background:
            rgba(255,255,255,.038);

          border:
            1px solid rgba(255,255,255,.055);

          border-radius: 10px;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          padding: 4px;
        }

        .zman-icon {
          font-size:
            clamp(15px, min(1.7vw, 2.7vh), 23px);

          line-height: 1;
        }

        .zman-label {
          margin-top: 3px;

          color: #a8c6d9;

          font-size:
            clamp(10px, min(1vw, 1.6vh), 14px);

          direction: rtl;
        }

        .zman-time {
          margin-top: 3px;

          font-size:
            clamp(13px, min(1.5vw, 2.4vh), 21px);

          line-height: 1;

          font-weight: 760;

          white-space: nowrap;
        }


        /* ======================================================
           BOTTOM
           ====================================================== */

        /* ======================================================
           SHUL SCHEDULE

           This week's sheet, a day to a column, shaped like the
           printed luach: name, a dotted leader, the time, and the
           note underneath.
           ====================================================== */

        .schedule {
          /* Everything inside scales off this, so the block can be
             shrunk to fit as one piece. */
          --schedule-scale: 1;

          /* The same row the sensor grid takes. Left to the implicit
             grid it lands in an auto row and sits short of the card's
             bottom edge with the space going nowhere. */
          grid-row: 3;

          min-width: 0;
          min-height: 0;

          display: grid;

          gap: clamp(5px, .9vw, 11px);

          overflow: hidden;
        }

        .schedule[hidden] {
          display: none;
        }

        .schedule-day {
          min-width: 0;
          min-height: 0;

          display: flex;
          flex-direction: column;

          /* Rows read from the top down. Spreading them to fill the
             column looks right on a full day and absurd on a day with
             one zman, which lands alone at the bottom of the box. */
          justify-content: flex-start;

          gap: 2px;

          padding: 5px clamp(6px, .8vw, 10px) 4px;

          background: rgba(255,255,255,.032);

          border: 1px solid rgba(255,255,255,.06);

          border-radius: 9px;

          overflow: hidden;
        }

        .schedule-day-label {
          color: #6fc0ef;

          font-size:
            calc(clamp(9px, min(1vw, 1.7vh), 13px) * var(--schedule-scale));
          font-weight: 800;
          letter-spacing: .3px;

          text-align: center;

          padding-bottom: 3px;
          margin-bottom: 2px;

          border-bottom: 1px solid rgba(110,190,235,.22);

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .schedule-row {
          min-height: 0;
        }

        .schedule-line {
          display: flex;
          align-items: baseline;
          gap: 5px;
        }

        .schedule-name {
          font-size:
            calc(clamp(10px, min(1.15vw, 1.9vh), 15px) * var(--schedule-scale));
          font-weight: 700;

          white-space: nowrap;
        }

        /* The leader, so the eye can run from a name to its time the
           way it does on paper. */
        .schedule-dots {
          flex: 1;

          min-width: 6px;

          border-bottom: 1px dotted rgba(255,255,255,.22);

          transform: translateY(-3px);
        }

        .schedule-time {
          color: #ffd98a;

          font-size:
            calc(clamp(10px, min(1.15vw, 1.9vh), 15px) * var(--schedule-scale));
          font-weight: 800;

          white-space: nowrap;

          font-variant-numeric: tabular-nums;

          /* Isolated, or "3:15 PM" comes out as "PM 3:15" in an RTL row. */
          direction: ltr;
          unicode-bidi: isolate;
        }

        .schedule-note {
          color: #9fbdd2;

          font-size:
            calc(clamp(7.5px, min(.85vw, 1.4vh), 11px) * var(--schedule-scale));
          line-height: 1.3;

          padding-inline-start: 2px;

          /* Each note picks its own direction - sheets mix Hebrew and
             English freely, sometimes inside one note. */
          unicode-bidi: plaintext;

        }

        /* ======================================================
           SIDE SHEET

           fill: side - the זמני היום strip folds into two columns
           down the left and the sheet takes everything beside it,
           which is the most height an image can get without hiding
           the dashboard outright.
           ====================================================== */

        .side-card {
          min-width: 0;
          min-height: 0;

          overflow: hidden;

          padding: clamp(5px, .8vh, 9px);

          display: grid;
        }

        .side-card[hidden] {
          display: none;
        }

        .side-image {
          width: 100%;
          height: 100%;

          min-width: 0;
          min-height: 0;

          object-fit: contain;

          border-radius: 8px;
        }

        .dashboard.side-sheet {
          grid-template-columns:
            minmax(0, 0.92fr)
            minmax(0, 1.58fr);
        }

        .dashboard.side-sheet .top {
          grid-column: 1 / -1;
          grid-row: 1;
        }

        .dashboard.side-sheet .zmanim {
          grid-column: 1;
          grid-row: 2;
        }

        .dashboard.side-sheet .side-card {
          grid-column: 2;
          grid-row: 2;
        }

        /* Six tiles, two across - so three rows, and each one gets a
           third of the height instead of all six sharing a strip. */
        .dashboard.side-sheet .zmanim-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .middle[hidden] {
          display: none;
        }

        .middle {
          display: grid;

          grid-template-columns:
            minmax(0, 1.55fr)
            minmax(260px, .72fr);

          gap: 8px;

          min-height: 0;
        }

        .daily-card {
          height: 100%;

          padding:
            clamp(9px, 1.2vh, 14px)
            clamp(12px, 1.4vw, 18px);

          display: grid;

          /* title | top strip | sensor grid | bottom strip. Both strip
             rows are auto, so the unused one collapses to nothing and
             the card looks exactly as it did before. */
          grid-template-rows:
            auto
            auto
            minmax(0, 1fr)
            auto;

          gap: 6px;

          min-height: 0;
        }

        .indicator-strip {
          display: flex;
          flex-wrap: wrap;

          /* Chips must size to their own content. Without this they
             inherit the flex default of stretch and grow to the strip's
             full height, which the error chip's pill radius turns into
             a large disc. */
          align-items: center;
          align-content: flex-start;

          gap: clamp(6px, .8vh, 10px) clamp(10px, 1.4vw, 22px);
        }

        /* The divider belongs on whichever side the sensor grid is. */
        .indicator-strip-top {
          padding-bottom: clamp(5px, .8vh, 9px);

          border-bottom:
            1px solid rgba(86, 172, 225, 0.18);
        }

        .indicator-strip-bottom {
          margin-top: clamp(4px, .7vh, 8px);
          padding-top: clamp(5px, .8vh, 9px);

          border-top:
            1px solid rgba(86, 172, 225, 0.18);
        }

        /* In the footer the strip is its own card, so it needs the
           padding and centring the neighbouring footer cards have, and
           must not wrap onto a second line in that short row. */
        .indicator-strip-footer {
          height: 100%;

          align-items: center;

          flex-wrap: nowrap;

          padding:
            5px
            clamp(12px, 1.4vw, 20px);

          overflow: hidden;
        }

        .indicator-strip[hidden] {
          display: none;
        }

        .indicator {
          display: flex;
          align-items: center;

          gap: 7px;

          min-width: 0;

          white-space: nowrap;
        }

        .indicator-dot {
          width: clamp(7px, .75vh, 10px);
          height: clamp(7px, .75vh, 10px);

          border-radius: 50%;

          flex: none;
        }

        .indicator-name {
          color: #bad1df;

          font-size:
            clamp(9px, min(1vw, 1.55vh), 14px);

          overflow: hidden;
          text-overflow: ellipsis;
        }

        .indicator-value {
          font-size:
            clamp(10px, min(1.05vw, 1.7vh), 15px);

          font-weight: 700;
        }

        /* The three states the strip can be in. Colour is the signal,
           so each one is distinct at a glance from across a room. */
        .indicator-on .indicator-dot { background: #43d17a; }
        .indicator-on .indicator-value { color: #43d17a; }

        .indicator-off .indicator-dot { background: #5c7c91; }
        .indicator-off .indicator-value { color: #9fbdd0; }

        /* An error has to be visible from across the room, so the whole
           chip blinks rather than just tinting the text. */
        .indicator-error {
          padding: 2px clamp(6px, .7vw, 10px);

          border-radius: 999px;

          background: rgba(255, 45, 32, .16);

          box-shadow:
            inset 0 0 0 1px rgba(255, 45, 32, .55);

          animation:
            indicator-blink 1.1s steps(1, end) infinite;
        }

        .indicator-error .indicator-dot {
          background: #ff2d20;

          box-shadow:
            0 0 10px rgba(255, 45, 32, .95),
            0 0 3px rgba(255, 255, 255, .6);
        }

        .indicator-error .indicator-value {
          color: #ff5247;
          font-weight: 800;
        }

        .indicator-error .indicator-name { color: #ffc4c0; }

        @keyframes indicator-blink {
          0%, 54%   { opacity: 1; }
          55%, 100% { opacity: .22; }
        }

        /* A permanently flashing element is genuinely painful for some
           people, so honour the system setting and stay bright-but-still. */
        @media (prefers-reduced-motion: reduce) {
          .indicator-error {
            animation: none;
            opacity: 1;
          }
        }

        /* An author display rule beats the browser's [hidden] rule, so
           anything hidden from JavaScript needs its own. Without this,
           setting .hidden here did nothing and the sensor rows drew on
           top of an image sharing the row. */
        .daily-grid[hidden],
        .daily-card[hidden],
        .footer[hidden],
        .daily-title[hidden] {
          display: none;
        }

        .daily-grid {
          grid-row: 3;

          min-height: 0;

          overflow: hidden;

          display: grid;

          grid-template-columns:
            repeat(2, minmax(0,1fr));

          grid-auto-rows:
            min-content;

          align-content: start;

          column-gap: 22px;
          row-gap: 5px;
        }

        .daily-row {
          min-width: 0;
          min-height: 0;

          display: grid;

          grid-template-columns:
            minmax(0,1fr)
            auto;

          gap: 8px;

          align-items: center;

          padding: 5px 1px;

          border-bottom:
            1px solid rgba(255,255,255,.06);
        }

        .daily-left {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          color: #bad1df;

          font-size:
            clamp(9px, min(1vw, 1.55vh), 14px);

          direction: rtl;
          text-align: left;
        }

        .daily-extra {
          color: #66879a;
          margin-right: 5px;

          font-size:
            clamp(8px, min(.8vw, 1.2vh), 11px);
        }

        .daily-value {
          font-size:
            clamp(10px, min(1.05vw, 1.7vh), 15px);

          font-weight: 700;

          white-space: nowrap;
        }


        /* ======================================================
           IMAGE PANEL (bottom right)
           ====================================================== */

        .image-panel {
          height: 100%;

          padding: 6px;

          min-height: 0;
        }

        .image-panel iframe,
        .image-panel img {
          width: 100%;
          height: 100%;

          min-height: 0;

          border: none;

          border-radius: 10px;

          display: block;

          background: #eee4d5;
        }

        .image-panel img {
          object-fit: cover;
        }

        .middle.single-column {
          grid-template-columns: minmax(0, 1fr);
        }


        /* ======================================================
           FOOTER
           ====================================================== */

        .footer {
          display: grid;

          grid-template-columns:
            minmax(0,1fr)
            auto
            auto;

          gap: 8px;

          min-height: 0;
        }

        .daf-footer,
        .status {
          height: 100%;

          display: flex;

          align-items: center;

          padding:
            5px
            clamp(12px, 1.4vw, 20px);
        }

        .daf-footer {
          justify-content: space-between;

          gap: 12px;
        }

        .daf-label {
          color: #85b4d0;

          font-size:
            clamp(9px, min(.95vw, 1.4vh), 13px);

          direction: rtl;
        }

        .daf-value {
          font-size:
            clamp(11px, min(1.15vw, 1.75vh), 16px);

          font-weight: 750;

          direction: rtl;
        }

        .status {
          gap: 7px;

          color: #7ba0b5;

          font-size:
            clamp(8px, min(.85vw, 1.3vh), 12px);

          white-space: nowrap;
        }

        .status-dot {
          width: 7px;
          height: 7px;

          border-radius: 999px;

          background: #31d388;

          box-shadow:
            0 0 8px rgba(49,211,136,.55);
        }


        /* ======================================================
           VERY SMALL DW SPECTRUM WINDOW
           ====================================================== */

        @media (max-height: 620px) {

          .page {
            padding: 6px;
          }

          .dashboard {
            gap: 5px;

            grid-template-rows:
              minmax(0, 27fr)
              minmax(0, 19fr)
              minmax(0, 46fr)
              minmax(0, 8fr);
          }

          .top,
          .middle,
          .footer {
            gap: 5px;
          }

          .card {
            border-radius: 10px;
          }

          .clock-card,
          .weather-card,
          .special-times {
            padding-top: 8px;
            padding-bottom: 8px;
          }

          .zmanim {
            padding-top: 6px;
            padding-bottom: 6px;
          }

          .daily-card {
            padding-top: 7px;
            padding-bottom: 7px;
          }
        }

        @media (max-width: 900px) {
          .top {
            grid-template-columns:
              .9fr
              1.2fr
              1fr;
          }

          .middle {
            grid-template-columns:
              1.45fr
              .8fr;
          }
        }
      </style>


      <div class="page">

        <main class="dashboard">


          <!-- ===================================================
               TOP
               =================================================== -->

          <div class="top">


            <section class="card clock-card">

              <div class="clock-line">
                <div id="clock">--:--</div>
                <div id="seconds">--</div>
              </div>

              <div id="date">
                Loading...
              </div>

              <div id="jewishDate"></div>

            </section>


            <section class="card weather-card">

              <div class="section-title">
                Weather
              </div>

              <div class="weather-current">

                <div
                  class="weather-icon"
                  id="weatherIcon">
                  🌤️
                </div>

                <div>

                  <div
                    class="weather-temp"
                    id="weatherTemp">
                    --°
                  </div>

                  <div
                    class="weather-condition"
                    id="weatherCondition">
                    --
                  </div>

                </div>


                <div
                  class="weather-hourly"
                  id="weatherHourly"
                  hidden></div>

              </div>

              <div class="weather-details">

                <span id="weatherHighLow"></span>

                <span id="humidity"></span>

                <span id="wind"></span>

              </div>


              <div
                class="weather-forecast"
                id="weatherForecast"
                hidden></div>

            </section>


            <section
              class="card special-times"
              id="specialTimes">

              <div
                class="special-blocks"
                id="specialBlocks"></div>


              <div
                class="special-rows"
                id="specialRows">


              <div class="special-row">

                <div class="special-label">
                  <span>זמן ערב</span>
                  <span class="special-icon">🕯️</span>
                </div>

                <div
                  class="special-value"
                  id="erev">
                  --
                </div>

              </div>


              <div class="special-row">

                <div class="special-label">
                  <span>זמן מוצאי</span>
                  <span class="special-icon">🍷</span>
                </div>

                <div
                  class="special-value"
                  id="motzi">
                  --
                </div>

              </div>


              <div class="special-row">

                <div class="special-label">
                  <span>דף היומי</span>
                  <span class="special-icon">📖</span>
                </div>

                <div
                  class="special-value"
                  id="dafTop">
                  --
                </div>

              </div>

              </div>


              <div
                class="indicator-strip indicator-strip-special"
                id="statusStripSpecial"
                hidden></div>

            </section>

          </div>



          <!-- ===================================================
               ZMANIM
               =================================================== -->

          <section class="card zmanim">

            <div class="section-title">
              זמני היום
            </div>

            <div class="zmanim-grid">


              <div class="zman">
                <div class="zman-icon">🌅</div>
                <div class="zman-label">עלות</div>
                <div
                  class="zman-time"
                  id="alos">
                  --
                </div>
              </div>


              <div class="zman">
                <div class="zman-icon">☀️</div>
                <div class="zman-label">נץ</div>
                <div
                  class="zman-time"
                  id="netz">
                  --
                </div>
              </div>


              <div class="zman">
                <div class="zman-icon">📖</div>
                <div class="zman-label">קרי״ש א</div>
                <div
                  class="zman-time"
                  id="shmaMga">
                  --
                </div>
              </div>


              <div class="zman">
                <div class="zman-icon">📖</div>
                <div class="zman-label">קרי״ש ב</div>
                <div
                  class="zman-time"
                  id="shmaGra">
                  --
                </div>
              </div>


              <div class="zman">
                <div class="zman-icon">🌇</div>
                <div class="zman-label">שקיעה</div>
                <div
                  class="zman-time"
                  id="shkia">
                  --
                </div>
              </div>


              <div class="zman">
                <div class="zman-icon">🌙</div>
                <div class="zman-label">מעריב</div>
                <div
                  class="zman-time"
                  id="maariv">
                  --
                </div>
              </div>


            </div>

          </section>



          <!-- ===================================================
               DAILY + WEDDING
               =================================================== -->

          <div class="middle">


            <section class="card daily-card">

              <div
                class="section-title daily-title"
                id="dailyTitle">
                Daily Information
              </div>

              <div
                class="indicator-strip indicator-strip-top"
                id="statusStripTop"
                hidden></div>

              <div
                class="daily-grid"
                id="dailyGrid">
              </div>

              <img
                class="bottom-image"
                id="bottomImage"
                alt=""
                hidden />

              <div
                class="schedule"
                id="schedule"
                hidden></div>

              <div
                class="indicator-strip indicator-strip-bottom"
                id="statusStripBottom"
                hidden></div>

            </section>


            <section class="card image-panel" id="imagePanel">

              <img id="imagePanelImg" alt="" />

              <iframe
                id="imagePanelIframe"
                src="${DEFAULT_IFRAME_SRC}"
                title="Bottom Right Panel">
              </iframe>

            </section>


          </div>



          <!-- ===================================================
               FOOTER
               =================================================== -->

          <div class="footer">


            <section class="card daf-footer">

              <span class="daf-label">
                📖 דף היומי
              </span>

              <span
                class="daf-value"
                id="dafBottom">
                --
              </span>

            </section>


            <section
              class="card indicator-strip indicator-strip-footer"
              id="statusStripFooter"
              hidden></section>


            <section class="card status">

              <span class="status-dot"></span>

              <span>
                HA Connected
              </span>

            </section>


          </div>


          <!-- ===================================================
               SIDE SHEET

               Lives out here rather than inside .middle so the grid
               can place it beside the זמני היום strip.
               =================================================== -->

          <section
            class="card side-card"
            id="sideCard"
            hidden>
            <img
              class="side-image"
              id="sideImage"
              alt="" />
          </section>


        </main>


        <div
          class="takeover"
          id="takeover"
          hidden>
          <img id="takeoverImage" alt="" />
        </div>

      </div>
    `;
  }


  startClock() {

    const updateClock = () => {

      const now = new Date();

      const timeParts =
        new Intl.DateTimeFormat(
          undefined,
          {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
          }
        )
        .formatToParts(now);

      let hour = "";
      let minute = "";
      let dayPeriod = "";

      for (const part of timeParts) {
        if (part.type === "hour") {
          hour = part.value;
        }

        if (part.type === "minute") {
          minute = part.value;
        }

        if (part.type === "dayPeriod") {
          dayPeriod = part.value;
        }
      }

      this.setText(
        "clock",
        `${hour}:${minute}`
      );

      this.setText(
        "seconds",
        `${now
          .getSeconds()
          .toString()
          .padStart(2, "0")} ${dayPeriod}`
      );

      this.setText(
        "date",
        now.toLocaleDateString(
          undefined,
          {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
          }
        )
      );

      // Staleness grows with the clock, not with incoming state, and a
      // dead feed means no state arrives to trigger a redraw. The
      // signature check makes this free when nothing has changed.
      if (this._hass) {
        this.renderStatus();
      }
    };

    updateClock();

    this._clockTimer =
      setInterval(
        updateClock,
        1000
      );
  }


  updateData() {

    if (!this._hass) {
      return;
    }

    const entities = this._config.entities;


    /* ==========================================================
       JEWISH DATE
       ========================================================== */

    this.setText(
      "jewishDate",
      this.getState(entities.jewish_date, "")
    );


    /* ==========================================================
       ZMANIM & SPECIAL TIMES
       ========================================================== */

    for (const row of ZMAN_ROWS) {
      this.setText(
        row.elementId,
        this.getAttr(entities[row.key], row.attribute)
      );
    }

    for (const row of SPECIAL_ROWS) {
      this.setText(
        row.elementId,
        this.getAttr(entities[row.key], row.attribute)
      );
    }


    const daf = this.getState(entities.daf_yomi);

    this.setText("dafTop", daf);
    this.setText("dafBottom", daf);


    /* ==========================================================
       WEATHER
       ========================================================== */

    const weather = this.getEntity(entities.weather);


    if (weather) {

      const condition =
        weather.state || "--";


      const attrs =
        weather.attributes || {};


      this.setText(
        "weatherIcon",
        this.weatherEmoji(
          condition
        )
      );


      this.setText(
        "weatherTemp",
        attrs.temperature !== undefined
          ? `${attrs.temperature}°`
          : "--°"
      );


      this.setText(
        "weatherCondition",
        condition.replaceAll(
          "-",
          " "
        )
      );


      this.setText(
        "humidity",
        attrs.humidity !== undefined
          ? `Humidity ${attrs.humidity}%`
          : ""
      );


      this.setText(
        "wind",
        attrs.wind_speed !== undefined
          ? `Wind ${attrs.wind_speed} ${attrs.wind_speed_unit || ""}`
          : ""
      );


      // With the forecast strip on, today's high/low is already the
      // first column, so the details line only carries it when the
      // strip is switched off.
      const today = this.forecastEntries("daily")[0];

      this.setText(
        "weatherHighLow",
        !this._config.forecast.enabled && today
          ? `High ${today.temperature ?? "--"}°` +
            ` / Low ${today.templow ?? "--"}°`
          : ""
      );
    }


    this.renderForecasts();


    /* ==========================================================
       SHEET DATA
       ========================================================== */

    this.applyLayout();

    this.applyTopRight();

    this.renderStatus();

    this.renderSheetData();


    /* ==========================================================
       IMAGE PANEL
       ========================================================== */

    this.updateImagePanel();

    // After the panel, so a full-width image can override it.
    this.applyBottom();
  }


  updateImagePanel() {

    const panelConfig = this._config.image_panel;

    const middle = this.shadowRoot.querySelector(".middle");
    const panel = this.shadowRoot.getElementById("imagePanel");
    const img = this.shadowRoot.getElementById("imagePanelImg");
    const iframe = this.shadowRoot.getElementById("imagePanelIframe");

    if (!panel || !middle || !img || !iframe) {
      return;
    }

    if (!panelConfig.enabled) {
      panel.style.display = "none";
      middle.classList.add("single-column");
      return;
    }

    panel.style.display = "";
    middle.classList.remove("single-column");

    const mode =
      panelConfig.mode === "image" && panelConfig.image
        ? "image"
        : panelConfig.mode === "custom" && panelConfig.custom_code
        ? "custom"
        : "default";

    if (mode === "image") {
      img.style.display = "block";
      iframe.style.display = "none";

      if (img.getAttribute("src") !== panelConfig.image) {
        img.setAttribute("src", panelConfig.image);
      }
    } else if (mode === "custom") {
      img.style.display = "none";
      iframe.style.display = "block";
      iframe.setAttribute("sandbox", "allow-scripts");

      if (this._lastCustomCode !== panelConfig.custom_code) {
        iframe.removeAttribute("src");
        iframe.srcdoc = buildCustomPanelHtml(panelConfig.custom_code);
        this._lastCustomCode = panelConfig.custom_code;
      }
    } else {
      img.style.display = "none";
      iframe.style.display = "block";
      iframe.removeAttribute("sandbox");
      iframe.removeAttribute("srcdoc");

      if (iframe.getAttribute("src") !== DEFAULT_IFRAME_SRC) {
        iframe.setAttribute("src", DEFAULT_IFRAME_SRC);
      }

      this._lastCustomCode = null;
    }
  }


  /* ==========================================================
     FORECAST

     Weather entities stopped carrying a "forecast" attribute in
     Home Assistant 2024.4 (deprecated in 2023.9), so forecasts have
     to be requested over the websocket connection, which then pushes
     updates as they come in. Daily and hourly are separate
     subscriptions; each is managed independently so one entity
     offering only daily still renders that strip. Older cores that
     still expose the attribute are covered by the fallback in
     forecastEntries().
     ========================================================== */

  forecastTypeEnabled(type) {
    return type === "hourly"
      ? this._config.forecast.hourly
      : this._config.forecast.enabled;
  }


  syncForecastSubscriptions() {
    this.syncForecastSubscription("daily");
    this.syncForecastSubscription("hourly");
  }


  syncForecastSubscription(type) {

    const state = this._forecastState[type];

    const entityId = this.forecastTypeEnabled(type)
      ? this._config.entities.weather
      : "";


    if (
      entityId === state.entityId &&
      (state.unsub || state.pending)
    ) {
      return;
    }


    if (entityId !== state.entityId) {
      // Data from the previous entity must not linger on screen.
      state.data = [];
    }


    this.unsubscribeForecast(type);

    state.entityId = entityId;


    if (
      !entityId ||
      !this._hass?.connection?.subscribeMessage
    ) {
      return;
    }


    // Guards against a subscription that resolves after we have
    // already moved on to a different entity.
    const token = {};

    state.token = token;
    state.pending = true;


    this._hass.connection
      .subscribeMessage(
        (message) => {
          if (state.token !== token) return;

          state.data = Array.isArray(message?.forecast)
            ? message.forecast
            : [];

          this.renderForecast(type);
        },
        {
          type: "weather/subscribe_forecast",
          forecast_type: type,
          entity_id: entityId,
        }
      )
      .then((unsub) => {
        state.pending = false;

        if (state.token !== token) {
          // Superseded while in flight — close what we just opened.
          unsub();
          return;
        }

        state.unsub = unsub;
      })
      .catch(() => {
        state.pending = false;

        if (state.token !== token) return;

        // Entity provides no forecast of this type, or the core
        // predates the command; the strip simply stays hidden.
        state.unsub = null;

        this.renderForecast(type);
      });
  }


  unsubscribeForecasts() {
    this.unsubscribeForecast("daily");
    this.unsubscribeForecast("hourly");
  }


  unsubscribeForecast(type) {

    const state = this._forecastState[type];

    state.token = null;
    state.pending = false;


    if (state.unsub) {

      try {
        state.unsub();
      } catch (err) {
        // The connection may already be gone; nothing to clean up.
      }

      state.unsub = null;
    }
  }


  forecastEntries(type) {

    const state = this._forecastState[type];


    if (
      Array.isArray(state.data) &&
      state.data.length
    ) {
      return state.data;
    }


    // Only the daily strip has a legacy fallback: the removed
    // attribute was daily on every integration that set it.
    if (type !== "daily") return [];


    const legacy =
      this.getEntity(this._config.entities.weather)
        ?.attributes
        ?.forecast;


    return Array.isArray(legacy) ? legacy : [];
  }


  // How long the entity has been sitting in its current state. Uses
  // last_changed (when it went unavailable), not last_reported.
  statusStateAgeSeconds(state) {

    const stamp = state?.last_changed || state?.last_updated;

    if (!stamp) return null;


    const at = new Date(stamp).getTime();

    if (Number.isNaN(at)) return null;


    return (Date.now() - at) / 1000;
  }


  forecastDayLabel(entry, index) {

    const date = entry?.datetime
      ? new Date(entry.datetime)
      : null;


    if (!date || Number.isNaN(date.getTime())) {
      return index === 0 ? "Today" : "--";
    }


    if (date.toDateString() === new Date().toDateString()) {
      return "Today";
    }


    return date.toLocaleDateString(
      this._hass?.locale?.language || undefined,
      { weekday: "short" }
    );
  }


  forecastHourLabel(entry, index) {

    const date = entry?.datetime
      ? new Date(entry.datetime)
      : null;


    if (!date || Number.isNaN(date.getTime())) {
      return "--";
    }


    const now = new Date();

    if (
      index === 0 &&
      date.getHours() === now.getHours() &&
      date.toDateString() === now.toDateString()
    ) {
      return "Now";
    }


    // Home Assistant's own 12/24-hour preference, where the user
    // has expressed one.
    const timeFormat = this._hass?.locale?.time_format;

    const options = { hour: "numeric" };

    if (timeFormat === "12") options.hour12 = true;
    if (timeFormat === "24") options.hour12 = false;


    return date
      .toLocaleTimeString(
        this._hass?.locale?.language || undefined,
        options
      )
      .replace(/\s+/g, "");
  }


  renderForecasts() {
    this.renderForecast("daily");
    this.renderForecast("hourly");
  }


  renderForecast(type) {

    const isHourly = type === "hourly";

    const container =
      this.shadowRoot?.getElementById(
        isHourly ? "weatherHourly" : "weatherForecast"
      );


    if (!container) return;


    const state = this._forecastState[type];


    if (!this.forecastTypeEnabled(type)) {

      container.hidden = true;
      container.innerHTML = "";

      state.signature = "";

      return;
    }


    const limit = isHourly
      ? this._config.forecast.hours
      : this._config.forecast.days;

    const entries =
      this.forecastEntries(type).slice(0, limit);


    const label = (entry, index) =>
      isHourly
        ? this.forecastHourLabel(entry, index)
        : this.forecastDayLabel(entry, index);


    const signature =
      entries
        .map(
          (entry, index) =>
            [
              label(entry, index),
              entry?.condition,
              entry?.temperature,
              entry?.templow,
            ].join(":")
        )
        .join("|");


    if (signature === state.signature) return;


    state.signature = signature;


    container.hidden = entries.length === 0;


    if (!entries.length) {
      container.innerHTML = "";
      return;
    }


    container.style.gridTemplateColumns =
      `repeat(${entries.length}, minmax(0, 1fr))`;


    container.innerHTML =
      entries
        .map(
          (entry, index) => `
              <div class="forecast-day">

                <div class="forecast-name">
                  ${escapeHtml(label(entry, index))}
                </div>

                <div class="forecast-icon">
                  ${this.weatherEmoji(entry?.condition)}
                </div>

                <div class="forecast-temps">

                  <span class="forecast-high">
                    ${escapeHtml(entry?.temperature ?? "--")}°
                  </span>

                  ${
                    isHourly
                      ? ""
                      : `
                        <span class="forecast-low">
                          ${escapeHtml(entry?.templow ?? "--")}°
                        </span>
                      `
                  }

                </div>

              </div>
            `
        )
        .join("");
  }


  /* ==========================================================
     STATUS

     Small on/off indicators (fridge Shabbos mode, mikvah, ...) where
     the colour carries the meaning: green on, dim off, red when the
     card cannot vouch for the value.
     ========================================================== */

  // Minutes since Home Assistant last wrote this entity's state at all
  // (last_reported ticks on every write, changed or not), so a feed that
  // has gone quiet is visible even though the old value is still there.
  statusAgeMinutes(state) {

    const stamp =
      state?.last_reported ||
      state?.last_updated ||
      state?.last_changed;


    if (!stamp) return null;


    const at = new Date(stamp).getTime();

    if (Number.isNaN(at)) return null;


    return (Date.now() - at) / 60000;
  }


  formatAge(minutes) {

    const total = Math.floor(minutes);

    if (total < 60) return `${total}m`;


    const hours = Math.floor(total / 60);
    const rest = total % 60;

    return rest ? `${hours}h${rest}m` : `${hours}h`;
  }


  statusRowFor(entry) {

    if (!entry.entity) return null;


    const onLabel = entry.on_label || "On";
    const offLabel = entry.off_label || "Off";

    const state = this.getEntity(entry.entity);

    const name =
      entry.name ||
      state?.attributes?.friendly_name ||
      entry.entity;


    // No such entity: almost always a typo or a removed device, and
    // silently showing "Off" for it would be a lie.
    if (!state) {
      return { key: entry.entity, name, value: "Missing", level: "error" };
    }


    const raw = String(state.state ?? "").trim().toLowerCase();


    if (!raw || STATUS_ERROR_STATES.has(raw)) {

      const outFor = this.statusStateAgeSeconds(state);

      const cached = this._statusLastGood[entry.entity];


      // A blip lasting seconds is normal for a cloud device and says
      // nothing about the appliance. Keep showing the last value we
      // trusted until the outage has lasted long enough to mean
      // something; a real one lasts hours, so this only delays a true
      // alarm by the grace period.
      if (
        entry.grace &&
        outFor !== null &&
        outFor < entry.grace &&
        cached
      ) {
        return {
          key: entry.entity,
          name,
          value: cached.value,
          level: cached.level,
        };
      }


      return {
        key: entry.entity,
        name,
        value: raw === "unavailable" ? "Unavailable" : "Error",
        level: "error",
      };
    }


    // A device can stop reporting without ever going "unavailable" —
    // the integration keeps serving the last value it saw. That reads as
    // a healthy Off, which is the most dangerous way for this to fail,
    // so an entity that has gone quiet is called out as offline.
    if (entry.stale_after) {

      // The freshest entity on a device makes a better heartbeat than a
      // switch that legitimately sits unchanged for hours.
      const watched =
        this.getEntity(entry.stale_entity) ||
        this.getEntity(entry.entity);

      const age = this.statusAgeMinutes(watched);


      if (age !== null && age > entry.stale_after) {
        return {
          key: entry.entity,
          name,
          value: `Offline (${this.formatAge(age)})`,
          level: "error",
        };
      }
    }


    const isOn = STATUS_ON_STATES.has(raw);
    const label = isOn ? onLabel : offLabel;


    // With an "expected" entity configured, the real failure is the
    // device disagreeing with what it was told to do — the switch that
    // never took. That reads as an error even though both entities are
    // individually healthy.
    if (entry.expected) {

      const want = this.getEntity(entry.expected);

      const wantRaw =
        String(want?.state ?? "").trim().toLowerCase();


      if (want && wantRaw && !STATUS_ERROR_STATES.has(wantRaw)) {

        const wantOn = STATUS_ON_STATES.has(wantRaw);


        if (wantOn !== isOn) {
          return {
            key: entry.entity,
            name,
            value: `${label} (want ${wantOn ? onLabel : offLabel})`,
            level: "error",
          };
        }
      }
    }


    const level = isOn ? "on" : "off";

    // Remember the last value we could vouch for, so a blip can be
    // ridden out rather than alarmed on.
    this._statusLastGood[entry.entity] = { value: label, level };


    return {
      key: entry.entity,
      name,
      value: label,
      level,
    };
  }


  statusContainers() {
    return {
      special: this.shadowRoot?.getElementById("statusStripSpecial"),
      daily_top: this.shadowRoot?.getElementById("statusStripTop"),
      daily_bottom: this.shadowRoot?.getElementById("statusStripBottom"),
      footer: this.shadowRoot?.getElementById("statusStripFooter"),
    };
  }


  /* ==========================================================
     LAYOUT

     Some hosts (a DW Spectrum video-wall tile, for one) render the
     page taller than the area they actually display, so the footer
     falls below the visible edge. bottom_crop shrinks the page by
     that percentage so everything lands inside what is on screen.
     ========================================================== */

  applyLayout() {

    const page = this.shadowRoot?.querySelector(".page");
    const dashboard = this.shadowRoot?.querySelector(".dashboard");


    if (!page || !dashboard || !this._config) return;


    const { zmanim, bottom_crop } = this._config.layout;

    let daily =
      LAYOUT_DAILY_BASE + (LAYOUT_ZMANIM_BASE - zmanim);


    // A sheet in the card wants every pixel of height it can get, and
    // the footer is not worth reading next to one - so it stands down
    // and hands its share to the sheet.
    const footer = this.shadowRoot?.querySelector(".footer");

    const sideSheet = Boolean(this.sideImageBlock());

    // A schedule fills the row with 18-odd lines of small print, so it
    // wants the footer's share exactly the way a sheet does.
    const hideFooter =
      sideSheet ||
      Boolean(this.inlineImageBlock()) ||
      Boolean(this.scheduleBlock() && !this.inlineImageBlock());

    if (footer) footer.hidden = hideFooter;


    // A side sheet puts the זמני היום strip and the sheet next to each
    // other, so the card is two rows rather than four and the zmanim
    // share no longer divides anything - the columns do that instead.
    dashboard.classList.toggle("side-sheet", sideSheet);

    if (sideSheet) {
      dashboard.style.gridTemplateRows =
        `minmax(0, ${LAYOUT_TOP_FR}fr)` +
        ` minmax(0, ${100 - LAYOUT_TOP_FR}fr)`;
    } else {
      let rows =
        `minmax(0, ${LAYOUT_TOP_FR}fr)` +
        ` minmax(0, ${zmanim}fr)`;

      if (hideFooter) {
        // Its track goes too, not just its contents, or the row it left
        // behind stays as empty space.
        rows += ` minmax(0, ${daily + LAYOUT_FOOTER_FR}fr)`;
      } else {
        rows +=
          ` minmax(0, ${daily}fr)` +
          ` minmax(0, ${LAYOUT_FOOTER_FR}fr)`;
      }

      dashboard.style.gridTemplateRows = rows;
    }


    // A percentage is only worth anything against a height the view
    // actually handed us. When it handed us none, crop the height the
    // card measured for itself instead.
    const measured = this.measuredPageHeight();

    const keep = (100 - bottom_crop) / 100;

    page.style.height = measured
      ? `${Math.round(measured * keep)}px`
      : bottom_crop
        ? `${100 - bottom_crop}%`
        : "";
  }


  /* ==========================================================
     PAGE HEIGHT

     The card splits one height into rows, so it needs a definite
     one to split. A Lovelace view usually gives the card its
     height - but not always, and a DW Spectrum tile is one of the
     views that gives none. Then `height: 100%` quietly falls back
     to auto, every row grows to fit its contents, and a sheet in
     the daily box drags the dashboard off the bottom of the
     screen.

     Collapsing the page and measuring the host answers the only
     question that matters: how much room does the view give this
     card when nothing inside is pushing? A view that hands out a
     real height reports it. HA's own reports it too - it gives the
     card a MINIMUM of the full height, which reads the same while
     the page is collapsed and then grows with the content, so a
     non-zero reading is not proof the height is fixed. Either way
     the collapsed figure is the room available, and the card should
     lay itself out inside it.

     A card the view gives nothing at all collapses to nothing, and
     then the window is the only thing left to measure. Only in
     landscape: a phone in portrait is taller than it is wide, the
     card stacks up and scrolls there, and that reads well -
     squeezing it into one screen would not.
     ========================================================== */

  // Returns the height to pin the page to, or 0 to leave the CSS
  // rule alone.
  measuredPageHeight() {

    // Probing costs a reflow and this runs on every state update, so
    // hold the answer for a second. Not longer: the view can hand the
    // card a height a moment after it first draws, and the card should
    // notice and step back out of the way.
    const now = Date.now();

    const key = `${window.innerWidth}x${window.innerHeight}`;

    if (
      this._pageHeightKey === key &&
      now - this._pageHeightAt < PAGE_HEIGHT_TTL
    ) {
      return this._pageHeight;
    }


    const page = this.shadowRoot?.querySelector(".page");

    if (!page) return 0;


    // A phone in portrait is left to stack up and scroll.
    if (window.innerWidth <= window.innerHeight) {
      this._pageHeightKey = key;
      this._pageHeightAt = now;
      this._pageHeight = 0;

      return 0;
    }


    // With nothing inside pushing, the host is exactly as tall as the
    // view is willing to make it.
    const previous = page.style.height;

    page.style.height = "0px";

    const given = this.getBoundingClientRect();

    page.style.height = previous;


    // What is visible below where the card starts. The view can hand
    // out a minimum taller than the screen, and a card laid out into
    // that still runs off the bottom.
    const visible =
      window.innerHeight - Math.max(0, given.top);

    let height =
      given.height >= MIN_PAGE_HEIGHT
        ? given.height
        : visible;

    if (visible >= MIN_PAGE_HEIGHT) {
      height = Math.min(height, visible);
    }

    height = Math.max(MIN_PAGE_HEIGHT, height);


    this._pageHeightKey = key;
    this._pageHeightAt = now;
    this._pageHeight = height;

    return height;
  }


  /* ==========================================================
     SPECIAL TIMES

     The times can be limited to the days they matter on - Shabbos,
     Yom Tov, erev - while the box itself stays as long as it still
     has indicators to show.
     ========================================================== */

  // A block with no conditions is always on. With conditions it shows
  // when ANY of them is on, so "Shabbos or Yom Tov or erev" is just
  // three entities rather than a rule to write.
  conditionsPass(conditions) {

    if (!conditions.length) return true;


    return conditions.some(entityId => {

      const raw =
        String(this.getEntity(entityId)?.state ?? "")
          .trim()
          .toLowerCase();


      return STATUS_ON_STATES.has(raw);
    });
  }


  visibleTopRightBlocks() {

    const blocks =
      this._config.top_right.filter(block =>
        this.conditionsPass(block.show_when)
      );


    // status_position: "special" is shorthand for a status block, so
    // the indicators can be put here without hand-writing one.
    const wantsStatus =
      this._config.status_position === "special" &&
      this._config.status.length > 0;

    const hasStatusBlock =
      blocks.some(block => block.type === "status");


    const withStatus =
      wantsStatus && !hasStatusBlock
        ? [...blocks, { type: "status", title: "", show_when: [], sensors: [] }]
        : blocks;


    // special_times and status each render a single shared element that
    // gets moved into place, so a second block of either type would
    // draw an empty heading with nothing under it. Only the first of
    // each survives; sensors blocks are independent and all render.
    const seen = new Set();

    return withStatus.filter(block => {
      if (block.type === "sensors") return true;
      if (seen.has(block.type)) return false;

      seen.add(block.type);
      return true;
    });
  }


  // A visible status block in the top-right wins over status_position:
  // asking for the indicators there is unambiguous, and it saves having
  // to keep two settings in step.
  effectiveStatusPosition() {

    const inTopRight =
      this.visibleTopRightBlocks()
        .some(block => block.type === "status");


    return inTopRight ? "special" : this._config.status_position;
  }


  visibleBottomBlocks() {
    return this._config.bottom.filter(block =>
      this.conditionsPass(block.show_when)
    );
  }


  // The image block currently drawing inside the card, if any. A
  // full-card image is not one of these: it hides the dashboard
  // outright, so the rows beneath it stop mattering.
  inlineImageBlock() {
    return this.visibleBottomBlocks().find(
      block =>
        block.type === "image" &&
        block.image &&
        block.fill !== "full" &&
        block.fill !== "side"
    );
  }


  scheduleBlock() {
    return this.visibleBottomBlocks().find(
      block => block.type === "schedule"
    );
  }


  // The days this week's sheet is publishing. A row past its remove-by
  // is already gone upstream, so there is nothing to filter here.
  scheduleDays(block) {
    const days = this.getEntity(block.entity)?.attributes?.days;

    return Array.isArray(days)
      ? days
          .filter(day => Array.isArray(day?.zmanim) && day.zmanim.length)
          .slice(0, MAX_SCHEDULE_DAYS)
      : [];
  }


  /* ==========================================================
     SHUL SCHEDULE

     Drawn from the sheet's own structure rather than a list of
     entities: the rows are rewritten every week, so anything
     naming them individually goes stale the moment the week
     turns over.
     ========================================================== */

  renderSchedule(block) {

    const host = this.shadowRoot?.getElementById("schedule");

    if (!host) return false;


    const days = this.scheduleDays(block);

    if (!days.length) {
      host.hidden = true;
      host.textContent = "";

      return false;
    }


    // Redraw only when something actually changed - this runs on every
    // state update and the sheet changes about once a week.
    const signature =
      JSON.stringify(
        days.map(day => [
          day.day_label,
          day.zmanim.map(z => [z.name, z.time, z.notes]),
        ])
      ) + `|${block.notes}`;

    host.hidden = false;

    if (host.dataset.signature === signature) {
      // Same sheet, but a box that changed size needs fitting again -
      // the window moved, not the data.
      const box = `${host.clientWidth}x${host.clientHeight}`;

      if (host.dataset.fitBox !== box) {
        host.dataset.fitBox = box;
        this.fitSchedule(host);
      }

      return true;
    }

    host.dataset.signature = signature;
    host.textContent = "";


    const hebrew = HEBREW_RE.test(signature);

    host.style.direction = hebrew ? "rtl" : "ltr";

    host.style.gridTemplateColumns =
      `repeat(${days.length}, minmax(0, 1fr))`;


    for (const day of days) {

      const column = document.createElement("div");
      column.className = "schedule-day";

      const label = document.createElement("div");
      label.className = "schedule-day-label";
      label.textContent = day.day_label || "";
      column.appendChild(label);


      for (const zman of day.zmanim) {

        const row = document.createElement("div");
        row.className = "schedule-row";

        const line = document.createElement("div");
        line.className = "schedule-line";

        const name = document.createElement("span");
        name.className = "schedule-name";
        name.textContent = zman.name || "";

        const dots = document.createElement("span");
        dots.className = "schedule-dots";

        const time = document.createElement("span");
        time.className = "schedule-time";
        // A sheet cell that never got a time reads as "0" once Google
        // has had its way with it. Blank is the honest rendering.
        time.textContent =
          zman.time && zman.time !== "0" ? zman.time : "";

        line.append(name, dots, time);
        row.appendChild(line);

        if (block.notes && zman.notes) {
          const note = document.createElement("div");
          note.className = "schedule-note";
          note.textContent = zman.notes;
          row.appendChild(note);
        }

        column.appendChild(row);
      }

      host.appendChild(column);
    }


    this.fitSchedule(host);

    host.dataset.fitBox = `${host.clientWidth}x${host.clientHeight}`;

    return true;
  }


  /* ==========================================================
     FITTING

     Notes wrap rather than being cut off, so a wordy sheet is
     taller than a terse one and nothing about the box changes to
     match. Shrink the whole block until it fits: a smaller sheet
     you can still read beats a full-size one with its last rows
     sliced off the bottom.
     ========================================================== */

  fitSchedule(host) {

    const overflows = () =>
      [...host.children].some(
        column => column.scrollHeight > column.clientHeight + 1
      );


    host.style.setProperty("--schedule-scale", "1");

    if (!overflows()) return;


    let scale = 1;

    while (scale > SCHEDULE_MIN_SCALE) {
      scale = Math.round((scale - SCHEDULE_SCALE_STEP) * 100) / 100;

      host.style.setProperty("--schedule-scale", String(scale));

      if (!overflows()) return;
    }
  }


  // A side sheet draws outside the Daily Information card entirely, so
  // it is found separately from the images that draw inside it.
  sideImageBlock() {
    return this.visibleBottomBlocks().find(
      block =>
        block.type === "image" && block.image && block.fill === "side"
    );
  }


  applyBottom() {

    const grid = this.shadowRoot?.getElementById("dailyGrid");
    const image = this.shadowRoot?.getElementById("bottomImage");
    const takeover = this.shadowRoot?.getElementById("takeover");
    const takeoverImg = this.shadowRoot?.getElementById("takeoverImage");
    const dashboard = this.shadowRoot?.querySelector(".dashboard");
    const middle = this.shadowRoot?.querySelector(".middle");
    const panel = this.shadowRoot?.getElementById("imagePanel");
    const dailyCard = this.shadowRoot?.querySelector(".daily-card");
    const sideCard = this.shadowRoot?.getElementById("sideCard");
    const sideImg = this.shadowRoot?.getElementById("sideImage");


    if (
      !grid || !image || !takeover || !takeoverImg ||
      !dashboard || !middle || !panel || !dailyCard ||
      !sideCard || !sideImg
    ) {
      return;
    }


    const blocks = this.visibleBottomBlocks();

    const fullImage = blocks.find(
      block => block.type === "image" && block.fill === "full" && block.image
    );


    // A full-card image replaces everything, so the rest of the
    // dashboard stops rendering rather than sitting behind it.
    if (fullImage) {
      if (takeoverImg.getAttribute("src") !== fullImage.image) {
        takeoverImg.setAttribute("src", fullImage.image);
      }

      takeover.hidden = false;
      dashboard.hidden = true;

      return;
    }

    takeover.hidden = true;
    dashboard.hidden = false;


    // fill: side - the sheet takes the whole lower half beside the
    // זמני היום strip, so the row that normally lives there goes.
    const sideImage = this.sideImageBlock();

    if (sideImage) {
      if (sideImg.getAttribute("src") !== sideImage.image) {
        sideImg.setAttribute("src", sideImage.image);
      }

      sideCard.hidden = false;
      middle.hidden = true;
      image.hidden = true;

      return;
    }

    sideCard.hidden = true;
    middle.hidden = false;


    const inlineImage = blocks.find(
      block =>
        block.type === "image" && block.image && block.fill !== "side"
    );

    const showSensors = blocks.some(block => block.type === "sensors");


    if (inlineImage) {
      if (image.getAttribute("src") !== inlineImage.image) {
        image.setAttribute("src", inlineImage.image);
      }
      image.hidden = false;
    } else {
      image.hidden = true;
    }

    // The schedule shares the row too, and is outranked by an image:
    // an uploaded sheet is a deliberate override for the day, so it
    // wins over the standing one.
    const scheduleBlock = this.scheduleBlock();

    const schedule =
      scheduleBlock && !inlineImage
        ? this.renderSchedule(scheduleBlock)
        : false;

    if (!schedule) {
      const host = this.shadowRoot?.getElementById("schedule");
      if (host) host.hidden = true;
    }


    // The image, the schedule and the sensor grid share a row, so only
    // one can be up. Otherwise a sensors block that is also passing
    // would draw straight through whatever took the row.
    grid.hidden = !showSensors || Boolean(inlineImage) || schedule;


    // The heading names the sensor list. Over a sheet or a schedule it
    // labels nothing - the day headings do that - and just costs height.
    const title = this.shadowRoot?.getElementById("dailyTitle");

    if (title) {
      // Keyed off whether the grid is actually drawing, not whether a
      // sensors block passed its conditions: a block can pass and still
      // be outranked, which is the usual case here.
      title.hidden = grid.hidden && (Boolean(inlineImage) || schedule);
    }


    // fill: row - the image spans the bottom row, so the panel beside
    // it stands down while the image is showing. Uses the panel's own
    // display/single-column mechanism rather than a second one, since
    // updateImagePanel() runs first and would undo anything else.
    const wantsRow = inlineImage && inlineImage.fill === "row";

    if (wantsRow) {
      panel.style.display = "none";
      middle.classList.add("single-column");
    }


    // Nothing to show in the card at all: drop it rather than leave a
    // titled blank.
    dailyCard.hidden = !showSensors && !inlineImage && !schedule;
  }


  applyTopRight() {

    const box = this.shadowRoot?.getElementById("specialTimes");
    const holder = this.shadowRoot?.getElementById("specialBlocks");
    const rows = this.shadowRoot?.getElementById("specialRows");
    const strip = this.shadowRoot?.getElementById("statusStripSpecial");
    const top = this.shadowRoot?.querySelector(".top");


    if (!box || !holder || !rows || !strip || !top) return;


    const blocks = this.visibleTopRightBlocks();

    const signature =
      blocks
        .map(
          block =>
            `${block.type}:${block.title}:` +
            block.sensors.map(entry => entry.entity).join(",")
        )
        .join("|");


    // An empty box is just a blank panel, so it goes entirely and the
    // clock and weather take the width back.
    box.hidden = blocks.length === 0;

    top.style.gridTemplateColumns = blocks.length
      ? ""
      : "minmax(0, 1fr) minmax(0, 1.4fr)";


    box.classList.toggle(
      "has-indicators",
      blocks.length > 1 &&
        blocks.some(block => block.type === "special_times")
    );


    if (signature === this._lastTopRightSignature) {
      // Contents still need refreshing even when the set of blocks
      // has not changed.
      this.renderTopRightSensors();
      return;
    }

    this._lastTopRightSignature = signature;


    // Park the reusable pieces on the box before rebuilding, so moving
    // them never destroys the elements the other renderers write into.
    // Parked means hidden: left visible they render on top of the
    // blocks that replaced them.
    if (rows.parentElement !== box) box.appendChild(rows);
    if (strip.parentElement !== box) box.appendChild(strip);

    rows.hidden = true;

    holder.innerHTML = "";


    for (const block of blocks) {

      const wrap = document.createElement("div");
      wrap.className = `special-block special-block-${block.type}`;


      if (block.title) {
        const title = document.createElement("div");
        title.className = "section-title special-block-title";
        title.textContent = block.title;
        wrap.appendChild(title);
      }


      if (block.type === "special_times") {
        if (!block.title) {
          const title = document.createElement("div");
          title.className = "section-title special-block-title";
          title.textContent = "Special Times";
          wrap.appendChild(title);
        }
        rows.hidden = false;
        wrap.appendChild(rows);
      } else if (block.type === "status") {
        wrap.appendChild(strip);
      } else {
        const list = document.createElement("div");
        list.className = "special-rows special-rows-auto";
        list.dataset.block = String(holder.children.length);
        wrap.appendChild(list);
      }


      holder.appendChild(wrap);
    }


    this.renderTopRightSensors();
  }


  // Sensor blocks reuse the Special Times row styling so a custom block
  // sits in the box without looking bolted on.
  renderTopRightSensors() {

    const holder = this.shadowRoot?.getElementById("specialBlocks");

    if (!holder) return;


    const blocks = this.visibleTopRightBlocks()
      .filter(block => block.type === "sensors");

    const lists = holder.querySelectorAll(".special-rows-auto");


    blocks.forEach((block, index) => {

      const list = lists[index];

      if (!list) return;


      const rows = this.buildConfiguredSensorRows(block.sensors);

      const markup =
        rows
          .map(
            row => `
                <div class="special-row">

                  <div class="special-label">
                    <span>${escapeHtml(row.name)}</span>
                  </div>

                  <div class="special-value">
                    ${escapeHtml(row.value)}
                  </div>

                </div>
              `
          )
          .join("");


      if (list.innerHTML !== markup) {
        list.innerHTML = markup;
      }
    });
  }


  renderStatus() {

    const containers = this.statusContainers();

    const position = this.effectiveStatusPosition();

    const container = containers[position];


    if (!container || !this._hass) return;


    // Only one slot is ever populated; the other two stay empty and
    // hidden so their grid rows and footer column collapse.
    for (const [key, other] of Object.entries(containers)) {
      if (key !== position && other) {
        other.hidden = true;
        other.innerHTML = "";
      }
    }


    const rows =
      this._config.status
        .map(entry => this.statusRowFor(entry))
        .filter(Boolean);


    const signature =
      [
        position,
        ...rows.map(
          row => `${row.key}:${row.name}:${row.value}:${row.level}`
        ),
      ].join("|");


    if (signature === this._lastStatusSignature) return;


    this._lastStatusSignature = signature;


    container.hidden = rows.length === 0;


    if (!rows.length) {
      container.innerHTML = "";
      return;
    }


    container.innerHTML =
      rows
        .map(
          row => `
              <div class="indicator indicator-${row.level}">

                <span class="indicator-dot"></span>

                <span class="indicator-name">
                  ${escapeHtml(row.name)}
                </span>

                <span class="indicator-value">
                  ${escapeHtml(row.value)}
                </span>

              </div>
            `
        )
        .join("");
  }


  renderSheetData() {

    const container =
      this.shadowRoot.getElementById(
        "dailyGrid"
      );


    if (
      !container ||
      !this._hass
    ) {
      return;
    }

    const configuredSensors = this._config.sensors;

    const rows = configuredSensors.length
      ? this.buildConfiguredSensorRows(configuredSensors)
      : this.buildAutoSensorRows();


    const signature =
      rows
        .map(
          row =>
            `${row.key}:${row.value}`
        )
        .join("|");


    if (
      signature ===
      this._lastSheetSignature
    ) {
      return;
    }


    this._lastSheetSignature =
      signature;


    if (!rows.length) {

      container.innerHTML = `
        <div class="daily-row">

          <div class="daily-left">
            ${configuredSensors.length ? "No sheet information found" : "No sensors configured"}
          </div>

        </div>
      `;

      return;
    }


    container.innerHTML =
      rows
        .map(
          row => `
              <div class="daily-row">

                <div class="daily-left">

                  ${
                    row.extra
                      ? `
                        <span class="daily-extra">
                          ${escapeHtml(row.extra)}
                        </span>
                      `
                      : ""
                  }

                  ${escapeHtml(row.name)}

                </div>

                <div class="daily-value">
                  ${escapeHtml(row.value)}
                </div>

              </div>
            `
        )
        .join("");
  }

  buildConfiguredSensorRows(configuredSensors) {
    return configuredSensors
      .filter(({ entity }) => entity)
      .map(({ entity, name, attribute }) => {
        const state = this.getEntity(entity);
        const value = attribute ? this.getAttr(entity, attribute) : this.getState(entity);
        const label = name || state?.attributes?.friendly_name || entity;

        return { key: `${entity}:${attribute || ""}`, name: label, value, extra: "" };
      });
  }

  buildAutoSensorRows() {
    const sensors =
      Object.values(
        this._hass.states
      )
      .filter(
        entity =>
          entity.entity_id
            .startsWith(
              "sensor."
            ) &&
          entity.attributes &&
          entity.attributes
            .sheet_name !== undefined
      )
      .sort(
        (a, b) =>
          Number(
            a.attributes
              .row_index ?? 999999
          ) -
          Number(
            b.attributes
              .row_index ?? 999999
          )
      );

    return sensors.map(entity => {
      const name = entity.attributes.sheet_name || "";
      const extra = entity.attributes.extra || "";
      const value =
        entity.state === "unknown" || entity.state === "unavailable"
          ? "--"
          : entity.state;

      return { key: entity.entity_id, name, value, extra };
    });
  }
}


class HomeDisplayCardEditor extends HTMLElement {
  setConfig(config) {
    const normalized = normalizeConfig(config);

    // Home Assistant's card-editor dialog expects every config-changed event
    // to carry the FULL card config, "type" included. We only manage
    // entities/sensors/image_panel ourselves, so anything else on the
    // incoming config (type, and any keys added by other features, like
    // card-mod or grid_options) is kept in _rawConfig and merged back in on
    // every update — dropping "type" here is what was sending Home
    // Assistant into YAML fallback mode on every edit.
    this._rawConfig = { type: "custom:home-display-card", ...(config || {}) };

    if (this._config && JSON.stringify(normalized) === JSON.stringify(this._config)) {
      this._config = normalized;
      return;
    }

    this._config = normalized;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._applyHass();
  }

  _updateConfig(mutator) {
    const next = {
      entities: { ...this._config.entities },
      sensors: this._config.sensors.map(sensor => ({ ...sensor })),
      status: this._config.status.map(entry => ({ ...entry })),
      status_position: this._config.status_position,
      bottom: this._config.bottom.map(block => ({
        ...block,
        show_when: [...block.show_when],
      })),
      top_right: this._config.top_right.map(block => ({
        ...block,
        show_when: [...block.show_when],
        sensors: block.sensors.map(entry => ({ ...entry })),
      })),
      layout: { ...this._config.layout },
      image_panel: { ...this._config.image_panel },
      forecast: { ...this._config.forecast },
    };

    mutator(next);

    this._config = next;

    const fullConfig = {
      ...this._rawConfig,
      entities: next.entities,
      sensors: next.sensors,
      status: next.status,
      status_position: next.status_position,
      top_right: next.top_right,
      bottom: next.bottom,
      layout: next.layout,
      image_panel: next.image_panel,
      forecast: next.forecast,
    };

    this._rawConfig = fullConfig;

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: fullConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  _render() {
    if (!this._root) {
      this._root = this.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = `
        .section {
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
        }

        h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 8px;
          color: var(--primary-text-color, #212121);
        }

        .hint {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin: 0 0 8px;
        }

        .field {
          margin-bottom: 8px;
        }

        .field label {
          display: block;
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 2px;
        }

        .field input,
        .field select {
          width: 100%;
          box-sizing: border-box;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--divider-color, #e0e0e0);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
        }

        .code-textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 160px;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--divider-color, #e0e0e0);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
          font-size: 12px;
          resize: vertical;
        }

        .sensor-row {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 8px;
          margin-bottom: 18px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }

        .sensor-row:last-child {
          border-bottom: none;
        }

        .sensor-row .field {
          flex: 1 1 160px;
          margin-bottom: 0;
        }

        .sensor-row .attribute-field {
          flex: 1 1 150px;
        }

        .sensor-row .name-override {
          flex: 1 1 160px;
          box-sizing: border-box;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--divider-color, #e0e0e0);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
        }

        .remove-button {
          flex: 0 0 auto;
          border: none;
          background: transparent;
          color: var(--error-color, #db4437);
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 8px;
        }

        .add-button {
          border: 1px dashed var(--divider-color, #e0e0e0);
          background: transparent;
          color: var(--primary-color, #03a9f4);
          border-radius: 4px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 13px;
        }

        .toggle-field {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--primary-text-color, #212121);
          margin-bottom: 10px;
          cursor: pointer;
        }

        .image-preview {
          display: block;
          max-width: 100%;
          max-height: 140px;
          border-radius: 6px;
          margin-bottom: 8px;
          object-fit: cover;
        }

        .file-input {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          color: var(--primary-text-color, #212121);
        }
      `;

      this._container = document.createElement("div");

      this._root.append(style, this._container);
    }

    this._pickers = [];
    this._container.innerHTML = "";

    // Sensors and the image panel are the most-used sections, so they're
    // built first (and appear first) even if an entity picker below them
    // fails to build for some reason.
    const sectionBuilders = [
      () => this._buildStatusSection(),
      () => this._buildTopRightSection(),
      () => this._buildBottomSection(),
      () => this._buildSensorSection(),
      () => this._buildForecastSection(),
      () => this._buildImagePanelSection(),
      // Layout is set once for a given screen, so it sits below the
      // sections that get edited regularly.
      () => this._buildLayoutSection(),
      ...ENTITY_SECTIONS.map((section) => () => this._buildEntitySection(section)),
    ];

    for (const build of sectionBuilders) {
      try {
        this._container.appendChild(build());
      } catch (err) {
        console.error("home-display-card-editor: failed to build a section", err);
      }
    }

    this._applyHass();
  }

  _buildEntityField({ label, value, includeDomains, onChange }) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";

    if (customElements.get("ha-entity-picker")) {
      const picker = document.createElement("ha-entity-picker");
      picker.hass = this._hass;
      picker.value = value || "";
      picker.label = label;
      picker.allowCustomEntity = true;
      if (includeDomains) picker.includeDomains = includeDomains;

      picker.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        onChange(ev.detail.value || "");
      });

      wrapper.appendChild(picker);
      this._pickers.push(picker);
    } else {
      const labelEl = document.createElement("label");
      labelEl.textContent = label;

      const input = document.createElement("input");
      input.type = "text";
      input.value = value || "";
      input.placeholder = "entity_id";

      input.addEventListener("change", () => onChange(input.value.trim()));

      wrapper.append(labelEl, input);
      this._pickers.push(input);
    }

    return wrapper;
  }

  _buildEntitySection(section) {
    const wrap = document.createElement("div");
    wrap.className = "section";

    const title = document.createElement("h3");
    title.textContent = section.title;
    wrap.appendChild(title);

    for (const field of section.fields) {
      const fieldWrap = this._buildEntityField({
        label: field.label,
        value: this._config.entities[field.key],
        includeDomains: field.filterDomain ? [field.filterDomain] : undefined,
        onChange: (value) => {
          this._updateConfig((cfg) => {
            cfg.entities[field.key] = value;
          });
        },
      });

      wrap.appendChild(fieldWrap);
    }

    return wrap;
  }

  _buildTopRightSection() {
    const section = document.createElement("div");
    section.className = "section";

    const title = document.createElement("h3");
    title.textContent = "Top Right Box";
    section.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Blocks shown in the top-right corner. Each one appears only when its own conditions pass, so the same corner can carry different things on different days. A block with no conditions is always shown. If no block qualifies, the box disappears and the clock and weather take the width back.";
    section.appendChild(hint);

    const list = document.createElement("div");
    list.className = "sensor-list";

    this._config.top_right.forEach((block, index) => {
      list.appendChild(this._buildTopRightBlock(block, index));
    });

    section.appendChild(list);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-button";
    addButton.textContent = "+ Add block";

    addButton.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.top_right.push({
          type: "special_times",
          title: "",
          show_when: [],
          sensors: [],
        });
      });
      this._render();
    });

    section.appendChild(addButton);

    return section;
  }

  _buildTopRightBlock(block, index) {
    const row = document.createElement("div");
    row.className = "sensor-row";

    const update = (patch) => {
      this._updateConfig((cfg) => {
        cfg.top_right[index] = { ...cfg.top_right[index], ...patch };
      });
    };

    const typeWrap = document.createElement("div");
    typeWrap.className = "field";

    const typeLabel = document.createElement("label");
    typeLabel.textContent = `Block ${index + 1}`;

    const typeSelect = document.createElement("select");
    typeSelect.innerHTML = `
      <option value="special_times">Special Times (erev / motzi / daf)</option>
      <option value="status">Status indicators</option>
      <option value="sensors">Custom sensors</option>
    `;
    typeSelect.value = block.type;

    typeSelect.addEventListener("change", () => {
      update({ type: typeSelect.value });
      this._render();
    });

    typeWrap.append(typeLabel, typeSelect);
    row.appendChild(typeWrap);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "name-override";
    titleInput.placeholder =
      block.type === "special_times"
        ? 'Heading (default "Special Times")'
        : "Heading (optional)";
    titleInput.value = block.title || "";
    titleInput.addEventListener("change", () =>
      update({ title: titleInput.value })
    );
    row.appendChild(titleInput);

    if (block.type === "sensors") {
      block.sensors.forEach((entry, sensorIndex) => {
        row.appendChild(
          this._buildEntityField({
            label: `Sensor ${sensorIndex + 1}`,
            value: entry.entity,
            onChange: (value) => {
              this._updateConfig((cfg) => {
                cfg.top_right[index].sensors[sensorIndex] = {
                  ...cfg.top_right[index].sensors[sensorIndex],
                  entity: value,
                };
              });
            },
          })
        );

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "name-override";
        nameInput.placeholder = "Display name (optional)";
        nameInput.value = entry.name || "";
        nameInput.addEventListener("change", () => {
          this._updateConfig((cfg) => {
            cfg.top_right[index].sensors[sensorIndex] = {
              ...cfg.top_right[index].sensors[sensorIndex],
              name: nameInput.value,
            };
          });
        });
        row.appendChild(nameInput);
      });

      const addSensor = document.createElement("button");
      addSensor.type = "button";
      addSensor.className = "add-button";
      addSensor.textContent = "+ Add sensor to this block";
      addSensor.addEventListener("click", () => {
        this._updateConfig((cfg) => {
          cfg.top_right[index].sensors.push({
            entity: "",
            name: "",
            attribute: "",
          });
        });
        this._render();
      });
      row.appendChild(addSensor);
    }

    const condHint = document.createElement("p");
    condHint.className = "hint";
    condHint.textContent =
      "Show this block when ANY of these is on. Leave empty to always show it.";
    row.appendChild(condHint);

    block.show_when.forEach((entityId, conditionIndex) => {
      const condRow = document.createElement("div");
      condRow.className = "field";

      condRow.appendChild(
        this._buildEntityField({
          label: `Show when ${conditionIndex + 1}`,
          value: entityId,
          includeDomains: ["binary_sensor", "input_boolean", "switch", "sensor"],
          onChange: (value) => {
            this._updateConfig((cfg) => {
              cfg.top_right[index].show_when[conditionIndex] = value;
            });
          },
        })
      );

      const removeCondition = document.createElement("button");
      removeCondition.type = "button";
      removeCondition.className = "remove-button";
      removeCondition.textContent = "✕";
      removeCondition.title = "Remove condition";
      removeCondition.addEventListener("click", () => {
        this._updateConfig((cfg) => {
          cfg.top_right[index].show_when.splice(conditionIndex, 1);
        });
        this._render();
      });

      condRow.appendChild(removeCondition);
      row.appendChild(condRow);
    });

    const addCondition = document.createElement("button");
    addCondition.type = "button";
    addCondition.className = "add-button";
    addCondition.textContent = "+ Add condition";
    addCondition.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.top_right[index].show_when.push("");
      });
      this._render();
    });
    row.appendChild(addCondition);

    const removeBlock = document.createElement("button");
    removeBlock.type = "button";
    removeBlock.className = "remove-button";
    removeBlock.textContent = "✕";
    removeBlock.title = "Remove block";
    removeBlock.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.top_right.splice(index, 1);
      });
      this._render();
    });
    row.appendChild(removeBlock);

    return row;
  }

  _buildBottomSection() {
    const section = document.createElement("div");
    section.className = "section";

    const title = document.createElement("h3");
    title.textContent = "Bottom Area";
    section.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "What fills the bottom of the card. Same idea as the top-right box: each block shows only when its conditions pass. Use an image block to put a printed sheet up instead of the sensor list.";
    section.appendChild(hint);

    const list = document.createElement("div");
    list.className = "sensor-list";

    this._config.bottom.forEach((block, index) => {
      list.appendChild(this._buildBottomBlock(block, index));
    });

    section.appendChild(list);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-button";
    addButton.textContent = "+ Add block";

    addButton.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.bottom.push({
          type: "sensors",
          show_when: [],
          image: "",
          fill: "daily",
        });
      });
      this._render();
    });

    section.appendChild(addButton);

    return section;
  }

  _buildBottomBlock(block, index) {
    const row = document.createElement("div");
    row.className = "sensor-row";

    const update = (patch) => {
      this._updateConfig((cfg) => {
        cfg.bottom[index] = { ...cfg.bottom[index], ...patch };
      });
    };

    const typeWrap = document.createElement("div");
    typeWrap.className = "field";

    const typeLabel = document.createElement("label");
    typeLabel.textContent = `Block ${index + 1}`;

    const typeSelect = document.createElement("select");
    typeSelect.innerHTML = `
      <option value="sensors">Daily Information sensors</option>
      <option value="schedule">Shul schedule (from the sheet)</option>
      <option value="image">Image (uploaded sheet)</option>
    `;
    typeSelect.value = block.type;

    typeSelect.addEventListener("change", () => {
      update({ type: typeSelect.value });
      this._render();
    });

    typeWrap.append(typeLabel, typeSelect);
    row.appendChild(typeWrap);

    if (block.type === "schedule") {
      row.appendChild(
        this._buildEntityField({
          label: "Schedule entity",
          value: block.entity,
          includeDomains: ["sensor"],
          onChange: value =>
            update({ entity: value || DEFAULT_SCHEDULE_ENTITY }),
        })
      );

      const notesWrap = document.createElement("label");
      notesWrap.className = "toggle-field";

      const notesBox = document.createElement("input");
      notesBox.type = "checkbox";
      notesBox.checked = block.notes;
      notesBox.addEventListener("change", () =>
        update({ notes: notesBox.checked })
      );

      const notesText = document.createElement("span");
      notesText.textContent = "Show the notes under each row";

      notesWrap.append(notesBox, notesText);
      row.appendChild(notesWrap);

      const scheduleHint = document.createElement("p");
      scheduleHint.className = "hint";
      scheduleHint.textContent =
        "Draws this week's sheet straight from the entity, a day to a " +
        "column — no list of rows to keep in step, because the sheet is " +
        "rewritten every week and anything naming its rows goes stale. " +
        "Rows appear, change and disappear as you edit the sheet.";
      row.appendChild(scheduleHint);
    }

    if (block.type === "image") {
      if (block.image) {
        const preview = document.createElement("img");
        preview.className = "image-preview";
        preview.src = block.image;
        row.appendChild(preview);
      }

      const fillWrap = document.createElement("div");
      fillWrap.className = "field";

      const fillLabel = document.createElement("label");
      fillLabel.textContent = "Size";

      const fillSelect = document.createElement("select");
      fillSelect.innerHTML = `
        <option value="full">Whole card (best for a dense sheet)</option>
        <option value="side">Beside זמני היום (keeps the dashboard)</option>
        <option value="row">Full bottom row</option>
        <option value="daily">Daily Information box only</option>
      `;
      fillSelect.value = block.fill;
      fillSelect.addEventListener("change", () =>
        update({ fill: fillSelect.value })
      );

      fillWrap.append(fillLabel, fillSelect);
      row.appendChild(fillWrap);

      const fillHint = document.createElement("p");
      fillHint.className = "hint";
      fillHint.textContent =
        "Height is what limits a printed sheet, and the bottom row is short. " +
        "'Beside זמני היום' folds that strip into two columns and gives the " +
        "image everything next to it — on a 951×499 screen a sheet goes from " +
        "345×243 to 470×331, with the clock, weather and zmanim all still up. " +
        "'Whole card' is bigger again (683×481) but hides the dashboard while " +
        "it shows.";
      row.appendChild(fillHint);

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.className = "file-input";

      const status = document.createElement("p");
      status.className = "hint";

      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        status.textContent = "Uploading…";

        try {
          const url = await this._uploadImage(file);
          update({ image: url });
          this._render();
        } catch (err) {
          status.textContent = `Upload failed: ${err.message}`;
        }
      });

      row.append(fileInput, status);
    }

    const condHint = document.createElement("p");
    condHint.className = "hint";
    condHint.textContent =
      "Show this block when ANY of these is on. Leave empty to always show it.";
    row.appendChild(condHint);

    block.show_when.forEach((entityId, conditionIndex) => {
      const condRow = document.createElement("div");
      condRow.className = "field";

      condRow.appendChild(
        this._buildEntityField({
          label: `Show when ${conditionIndex + 1}`,
          value: entityId,
          includeDomains: ["binary_sensor", "input_boolean", "switch", "sensor"],
          onChange: (value) => {
            this._updateConfig((cfg) => {
              cfg.bottom[index].show_when[conditionIndex] = value;
            });
          },
        })
      );

      const removeCondition = document.createElement("button");
      removeCondition.type = "button";
      removeCondition.className = "remove-button";
      removeCondition.textContent = "✕";
      removeCondition.title = "Remove condition";
      removeCondition.addEventListener("click", () => {
        this._updateConfig((cfg) => {
          cfg.bottom[index].show_when.splice(conditionIndex, 1);
        });
        this._render();
      });

      condRow.appendChild(removeCondition);
      row.appendChild(condRow);
    });

    const addCondition = document.createElement("button");
    addCondition.type = "button";
    addCondition.className = "add-button";
    addCondition.textContent = "+ Add condition";
    addCondition.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.bottom[index].show_when.push("");
      });
      this._render();
    });
    row.appendChild(addCondition);

    const removeBlock = document.createElement("button");
    removeBlock.type = "button";
    removeBlock.className = "remove-button";
    removeBlock.textContent = "✕";
    removeBlock.title = "Remove block";
    removeBlock.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.bottom.splice(index, 1);
      });
      this._render();
    });
    row.appendChild(removeBlock);

    return row;
  }

  _buildLayoutSection() {
    const section = document.createElement("div");
    section.className = "section";

    const title = document.createElement("h3");
    title.textContent = "Layout";
    section.appendChild(title);

    const numberField = ({ label, hint, value, min, max, placeholder, key }) => {
      const hintEl = document.createElement("p");
      hintEl.className = "hint";
      hintEl.textContent = hint;

      const wrap = document.createElement("div");
      wrap.className = "field";

      const labelEl = document.createElement("label");
      labelEl.textContent = label;

      const input = document.createElement("input");
      input.type = "number";
      input.min = String(min);
      input.max = String(max);
      input.placeholder = placeholder;
      input.value = String(value);

      input.addEventListener("change", () => {
        this._updateConfig((cfg) => {
          cfg.layout = { ...cfg.layout, [key]: input.value };
        });
      });

      wrap.append(labelEl, input);

      const holder = document.createElement("div");
      holder.append(hintEl, wrap);

      return holder;
    };

    section.appendChild(
      numberField({
        label: "Zmanim row height",
        hint: "How much of the card's height the זמני היום row takes, out of 100 (default 14). Whatever it gives up goes to Daily Information.",
        value: this._config.layout.zmanim,
        min: MIN_ZMANIM_FR,
        max: MAX_ZMANIM_FR,
        placeholder: "14",
        key: "zmanim",
      })
    );

    section.appendChild(
      numberField({
        label: "Bottom cut off by the display (%)",
        hint: "For screens that show less of the page than the browser renders — a DW Spectrum video-wall tile, for example — which cuts the footer off the bottom. Set the percentage being lost and the card lays itself out inside what is actually visible. 0 for a normal browser.",
        value: this._config.layout.bottom_crop,
        min: 0,
        max: MAX_BOTTOM_CROP,
        placeholder: "0",
        key: "bottom_crop",
      })
    );

    return section;
  }

  _buildStatusSection() {
    const section = document.createElement("div");
    section.className = "section";

    const title = document.createElement("h3");
    title.textContent = "Status Indicators";
    section.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "On/off indicators shown at the top of Daily Information: green for on, dim for off, red when something is wrong. Good for a fridge Shabbos mode switch or the mikvah.";
    section.appendChild(hint);

    const positionWrap = document.createElement("div");
    positionWrap.className = "field";

    const positionLabel = document.createElement("label");
    positionLabel.textContent = "Position";

    const positionSelect = document.createElement("select");
    positionSelect.innerHTML = `
      <option value="special">Special Times box (top right)</option>
      <option value="daily_bottom">Bottom of Daily Information</option>
      <option value="daily_top">Top of Daily Information</option>
      <option value="footer">Footer bar</option>
    `;
    positionSelect.value = this._config.status_position;

    positionSelect.addEventListener("change", () => {
      this._updateConfig((cfg) => {
        cfg.status_position = positionSelect.value;
      });
    });

    positionWrap.append(positionLabel, positionSelect);
    section.appendChild(positionWrap);

    const list = document.createElement("div");
    list.className = "sensor-list";

    this._config.status.forEach((entry, index) => {
      list.appendChild(this._buildStatusRow(entry, index));
    });

    section.appendChild(list);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-button";
    addButton.textContent = "+ Add Status";

    addButton.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.status.push({
          entity: "",
          name: "",
          on_label: "",
          off_label: "",
          expected: "",
        });
      });
      this._render();
    });

    section.appendChild(addButton);

    return section;
  }

  _buildStatusRow(entry, index) {
    const row = document.createElement("div");
    row.className = "sensor-row";

    const update = (patch) => {
      this._updateConfig((cfg) => {
        cfg.status[index] = { ...cfg.status[index], ...patch };
      });
    };

    const picker = this._buildEntityField({
      label: `Status ${index + 1}`,
      value: entry.entity,
      includeDomains: ["switch", "binary_sensor", "input_boolean", "light", "sensor"],
      onChange: (value) => update({ entity: value }),
    });

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "name-override";
    nameInput.placeholder = "Display name (optional)";
    nameInput.value = entry.name || "";
    nameInput.addEventListener("change", () =>
      update({ name: nameInput.value })
    );

    const onInput = document.createElement("input");
    onInput.type = "text";
    onInput.className = "name-override";
    onInput.placeholder = 'Label when on (default "On")';
    onInput.value = entry.on_label || "";
    onInput.addEventListener("change", () =>
      update({ on_label: onInput.value })
    );

    const offInput = document.createElement("input");
    offInput.type = "text";
    offInput.className = "name-override";
    offInput.placeholder = 'Label when off (default "Off")';
    offInput.value = entry.off_label || "";
    offInput.addEventListener("change", () =>
      update({ off_label: offInput.value })
    );

    const expectedHint = document.createElement("p");
    expectedHint.className = "hint";
    expectedHint.textContent =
      "Optional: an entity saying what this SHOULD be. If the two disagree, the row turns red — that's how a switch that never took gets caught.";

    const expectedPicker = this._buildEntityField({
      label: "Should match (optional)",
      value: entry.expected,
      includeDomains: ["binary_sensor", "input_boolean", "switch", "sensor"],
      onChange: (value) => update({ expected: value }),
    });

    const staleHint = document.createElement("p");
    staleHint.className = "hint";
    staleHint.textContent =
      "Optional: minutes of silence before this counts as offline. A device can stop reporting without going 'unavailable' — the old value just sits there looking fine. Leave blank to skip the check.";

    const staleWrap = document.createElement("div");
    staleWrap.className = "field";

    const staleLabel = document.createElement("label");
    staleLabel.textContent = "Offline after (minutes)";

    const staleInput = document.createElement("input");
    staleInput.type = "number";
    staleInput.min = "1";
    staleInput.placeholder = "e.g. 30";
    staleInput.value = entry.stale_after ? String(entry.stale_after) : "";

    staleInput.addEventListener("change", () =>
      update({ stale_after: staleInput.value })
    );

    staleWrap.append(staleLabel, staleInput);

    const heartbeatHint = document.createElement("p");
    heartbeatHint.className = "hint";
    heartbeatHint.textContent =
      "Optional: check that entity's freshness instead. Pick the busiest entity on the same device — a switch can sit unchanged for hours legitimately, so it makes a poor heartbeat.";

    const graceHint = document.createElement("p");
    graceHint.className = "hint";
    graceHint.textContent =
      "Seconds an 'unavailable' blip must last before it turns red (default 180). Cloud devices drop out for a few seconds many times an hour; alarming on each one just teaches you to ignore the colour. 0 alarms immediately.";

    const graceWrap = document.createElement("div");
    graceWrap.className = "field";

    const graceLabel = document.createElement("label");
    graceLabel.textContent = "Ignore blips shorter than (seconds)";

    const graceInput = document.createElement("input");
    graceInput.type = "number";
    graceInput.min = "0";
    graceInput.placeholder = "180";
    graceInput.value = String(entry.grace);

    graceInput.addEventListener("change", () =>
      update({ grace: graceInput.value })
    );

    graceWrap.append(graceLabel, graceInput);

    const heartbeatPicker = this._buildEntityField({
      label: "Heartbeat entity (optional)",
      value: entry.stale_entity,
      onChange: (value) => update({ stale_entity: value }),
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "✕";
    removeButton.title = "Remove status";

    removeButton.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.status.splice(index, 1);
      });
      this._render();
    });

    row.append(
      picker,
      nameInput,
      onInput,
      offInput,
      expectedHint,
      expectedPicker,
      staleHint,
      staleWrap,
      heartbeatHint,
      heartbeatPicker,
      graceHint,
      graceWrap,
      removeButton
    );

    return row;
  }

  _buildSensorSection() {
    const section = document.createElement("div");
    section.className = "section";

    const title = document.createElement("h3");
    title.textContent = "Daily Information Sensors";
    section.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Add sensors to show in the Daily Information grid. Leave empty to auto-detect Google Sheet sensors (entities with a sheet_name attribute).";
    section.appendChild(hint);

    const list = document.createElement("div");
    list.className = "sensor-list";

    this._config.sensors.forEach((sensorEntry, index) => {
      list.appendChild(this._buildSensorRow(sensorEntry, index));
    });

    section.appendChild(list);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-button";
    addButton.textContent = "+ Add Sensor";

    addButton.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.sensors.push({ entity: "", name: "", attribute: "" });
      });
      this._render();
    });

    section.appendChild(addButton);

    return section;
  }

  _buildSensorRow(sensorEntry, index) {
    const row = document.createElement("div");
    row.className = "sensor-row";

    const picker = this._buildEntityField({
      label: `Sensor ${index + 1}`,
      value: sensorEntry.entity,
      onChange: (value) => {
        this._updateConfig((cfg) => {
          // A new entity's attributes are different, so any previously
          // selected attribute name is no longer meaningful.
          cfg.sensors[index] = { ...cfg.sensors[index], entity: value, attribute: "" };
        });
        this._render();
      },
    });

    const attributeField = this._buildAttributeField(sensorEntry, index);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "name-override";
    nameInput.placeholder = "Display name (optional)";
    nameInput.value = sensorEntry.name || "";

    nameInput.addEventListener("change", () => {
      this._updateConfig((cfg) => {
        cfg.sensors[index] = { ...cfg.sensors[index], name: nameInput.value };
      });
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "✕";
    removeButton.title = "Remove sensor";

    removeButton.addEventListener("click", () => {
      this._updateConfig((cfg) => {
        cfg.sensors.splice(index, 1);
      });
      this._render();
    });

    row.append(picker, attributeField, nameInput, removeButton);

    return row;
  }

  _buildAttributeField(sensorEntry, index) {
    const wrap = document.createElement("div");
    wrap.className = "field attribute-field";

    const label = document.createElement("label");
    label.textContent = "Value";
    wrap.appendChild(label);

    const select = document.createElement("select");

    const stateOption = document.createElement("option");
    stateOption.value = "";
    stateOption.textContent = "State (default)";
    select.appendChild(stateOption);

    const entityState = sensorEntry.entity
      ? this._hass?.states?.[sensorEntry.entity]
      : undefined;
    const attributeKeys = entityState ? Object.keys(entityState.attributes || {}) : [];

    for (const key of attributeKeys) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = key;
      select.appendChild(option);
    }

    // Keep a previously-saved attribute selectable even if it isn't in the
    // live entity's attribute list right now (entity not loaded yet, etc.)
    // so switching modes never silently discards it.
    if (sensorEntry.attribute && !attributeKeys.includes(sensorEntry.attribute)) {
      const option = document.createElement("option");
      option.value = sensorEntry.attribute;
      option.textContent = `${sensorEntry.attribute} (not currently available)`;
      select.appendChild(option);
    }

    select.value = sensorEntry.attribute || "";
    select.disabled = !sensorEntry.entity;
    select.title = select.disabled ? "Pick a sensor first" : "";

    select.addEventListener("change", () => {
      this._updateConfig((cfg) => {
        cfg.sensors[index] = { ...cfg.sensors[index], attribute: select.value };
      });
    });

    wrap.appendChild(select);

    return wrap;
  }

  _applyHass() {
    if (!this._pickers) return;

    for (const picker of this._pickers) {
      if (picker && picker.tagName === "HA-ENTITY-PICKER") {
        picker.hass = this._hass;
      }
    }
  }

  _buildForecastSection() {
    const section = document.createElement("div");
    section.className = "section";

    const title = document.createElement("h3");
    title.textContent = "Weather Forecast";
    section.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "The daily strip sits below the current conditions; the hourly strip fills the space to their right. Each needs a weather entity that provides that kind of forecast, and hides itself if there is none.";
    section.appendChild(hint);

    section.appendChild(
      this._buildForecastToggle({
        label: " Show daily forecast",
        checked: this._config.forecast.enabled,
        onChange: (checked) => ({ enabled: checked }),
      })
    );

    if (this._config.forecast.enabled) {
      section.appendChild(
        this._buildForecastCount({
          label: "Days",
          value: this._config.forecast.days,
          min: MIN_FORECAST_DAYS,
          max: MAX_FORECAST_DAYS,
          unit: "day",
          onChange: (count) => ({ days: count }),
        })
      );
    }

    section.appendChild(
      this._buildForecastToggle({
        label: " Show hourly forecast",
        checked: this._config.forecast.hourly,
        onChange: (checked) => ({ hourly: checked }),
      })
    );

    if (this._config.forecast.hourly) {
      section.appendChild(
        this._buildForecastCount({
          label: "Hours",
          value: this._config.forecast.hours,
          min: MIN_FORECAST_HOURS,
          max: MAX_FORECAST_HOURS,
          unit: "hour",
          onChange: (count) => ({ hours: count }),
        })
      );
    }

    return section;
  }

  _buildForecastToggle({ label, checked, onChange }) {
    const wrap = document.createElement("label");
    wrap.className = "toggle-field";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = checked;

    toggle.addEventListener("change", () => {
      this._updateConfig((cfg) => {
        cfg.forecast = { ...cfg.forecast, ...onChange(toggle.checked) };
      });
      // The matching count dropdown appears or disappears with it.
      this._render();
    });

    wrap.append(toggle, document.createTextNode(label));

    return wrap;
  }

  _buildForecastCount({ label, value, min, max, unit, onChange }) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const labelEl = document.createElement("label");
    labelEl.textContent = label;

    const select = document.createElement("select");

    for (let count = min; count <= max; count += 1) {
      const option = document.createElement("option");
      option.value = String(count);
      option.textContent = `${count} ${unit}${count === 1 ? "" : "s"}`;
      select.appendChild(option);
    }

    select.value = String(value);

    select.addEventListener("change", () => {
      this._updateConfig((cfg) => {
        cfg.forecast = {
          ...cfg.forecast,
          ...onChange(Number.parseInt(select.value, 10)),
        };
      });
    });

    wrap.append(labelEl, select);

    return wrap;
  }

  _buildImagePanelSection() {
    const section = document.createElement("div");
    section.className = "section";

    const title = document.createElement("h3");
    title.textContent = "Bottom Right Panel";
    section.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Choose what shows in the bottom-right panel, or turn it off entirely.";
    section.appendChild(hint);

    const toggleWrap = document.createElement("label");
    toggleWrap.className = "toggle-field";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = this._config.image_panel.enabled;

    toggle.addEventListener("change", () => {
      this._updateConfig((cfg) => {
        cfg.image_panel = { ...cfg.image_panel, enabled: toggle.checked };
      });
    });

    toggleWrap.append(toggle, document.createTextNode(" Show bottom-right panel"));
    section.appendChild(toggleWrap);

    const modeWrap = document.createElement("div");
    modeWrap.className = "field";

    const modeLabel = document.createElement("label");
    modeLabel.textContent = "Content";

    const modeSelect = document.createElement("select");
    modeSelect.innerHTML = `
      <option value="default">Default (wedding countdown)</option>
      <option value="image">Uploaded image</option>
      <option value="custom">Custom code (HTML/JS)</option>
    `;
    modeSelect.value = this._config.image_panel.mode;

    modeSelect.addEventListener("change", () => {
      this._updateConfig((cfg) => {
        cfg.image_panel = { ...cfg.image_panel, mode: modeSelect.value };
      });
      this._render();
    });

    modeWrap.append(modeLabel, modeSelect);
    section.appendChild(modeWrap);

    if (this._config.image_panel.mode === "image") {
      section.appendChild(this._buildImageModeControls());
    } else if (this._config.image_panel.mode === "custom") {
      section.appendChild(this._buildCustomCodeControls());
    }

    return section;
  }

  _buildImageModeControls() {
    const wrap = document.createElement("div");

    if (this._config.image_panel.image) {
      const preview = document.createElement("img");
      preview.className = "image-preview";
      preview.src = this._config.image_panel.image;
      wrap.appendChild(preview);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "add-button";
      removeButton.textContent = "Remove uploaded image";

      removeButton.addEventListener("click", () => {
        this._updateConfig((cfg) => {
          cfg.image_panel = { ...cfg.image_panel, image: "" };
        });
        this._render();
      });

      wrap.appendChild(removeButton);
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.className = "file-input";

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file || !this._hass) return;

      this._setUploadStatus("Uploading...");

      try {
        const url = await this._uploadImage(file);
        this._updateConfig((cfg) => {
          cfg.image_panel = { ...cfg.image_panel, image: url };
        });
        this._render();
      } catch (err) {
        this._setUploadStatus(`Upload failed: ${err.message || err}`);
      }
    });

    wrap.appendChild(fileInput);

    this._uploadStatusEl = document.createElement("p");
    this._uploadStatusEl.className = "hint";
    wrap.appendChild(this._uploadStatusEl);

    return wrap;
  }

  _buildCustomCodeControls() {
    const wrap = document.createElement("div");

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Paste JavaScript to run in the panel. It executes inside a sandboxed, origin-isolated iframe — it cannot access Home Assistant, your login, or the rest of the dashboard.";
    wrap.appendChild(hint);

    const textarea = document.createElement("textarea");
    textarea.className = "code-textarea";
    textarea.placeholder = "document.body.innerHTML = '<h1>Hello</h1>';";
    textarea.value = this._config.image_panel.custom_code || "";
    textarea.spellcheck = false;

    textarea.addEventListener("change", () => {
      this._updateConfig((cfg) => {
        cfg.image_panel = { ...cfg.image_panel, custom_code: textarea.value };
      });
    });

    wrap.appendChild(textarea);

    return wrap;
  }

  async _uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await this._hass.fetchWithAuth("/api/image/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return `/api/image/serve/${data.id}/original`;
  }

  _setUploadStatus(text) {
    if (this._uploadStatusEl) {
      this._uploadStatusEl.textContent = text;
    }
  }
}


if (!customElements.get("home-display-card")) {
  customElements.define("home-display-card", HomeDisplayCard);
}

if (!customElements.get("home-display-card-editor")) {
  customElements.define("home-display-card-editor", HomeDisplayCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "home-display-card",
  name: "Home Display Card",
  description:
    "Full dashboard card with clock, weather, zmanim, special times, and a configurable Daily Information sensor list.",
});
