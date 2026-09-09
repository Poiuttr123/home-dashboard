/**
 * Home Display Card
 * A full dashboard-style Lovelace card: clock, weather with a multi-day
 * forecast, zmanim, special times, a configurable "Daily Information" sensor
 * list, and a toggleable bottom-right panel (wedding countdown iframe by
 * default, or an uploaded image).
 */

const CARD_VERSION = "1.4.0";

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

const STATUS_POSITIONS = ["daily_top", "daily_bottom", "footer"];

const DEFAULT_STATUS_POSITION = "daily_bottom";

// What counts as "on" for a switch, binary_sensor or input_boolean.
const STATUS_ON_STATES = new Set([
  "on", "true", "yes", "open", "home", "active", "enabled",
]);

// States that mean the card cannot trust the value at all.
const STATUS_ERROR_STATES = new Set([
  "unavailable", "unknown", "none", "error", "fault",
]);

function normalizeStatusEntry(entry) {
  if (typeof entry === "string") {
    return entry
      ? { entity: entry, name: "", on_label: "", off_label: "", expected: "" }
      : null;
  }
  if (entry && typeof entry === "object" && entry.entity) {
    return {
      entity: entry.entity,
      name: entry.name || "",
      on_label: entry.on_label || "",
      off_label: entry.off_label || "",
      expected: entry.expected || "",
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

  return { entities, sensors, status, status_position, image_panel, forecast };
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

    if (this._hass) {
      this.syncForecastSubscriptions();
    }
  }

  disconnectedCallback() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
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

          grid-template-rows:
            auto
            repeat(3, 1fr);

          min-height: 0;
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
            1fr
            auto;

          gap: 6px;

          min-height: 0;
        }

        .indicator-strip {
          display: flex;
          flex-wrap: wrap;

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

        .indicator-error .indicator-dot {
          background: #ff5f56;
          box-shadow: 0 0 7px rgba(255, 95, 86, .75);
        }
        .indicator-error .indicator-value { color: #ff6b62; }
        .indicator-error .indicator-name { color: #ffb3ae; }

        .daily-grid {
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


            <section class="card special-times">

              <div class="section-title">
                Special Times
              </div>


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

              <div class="section-title">
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


        </main>

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

    this.renderStatus();

    this.renderSheetData();


    /* ==========================================================
       IMAGE PANEL
       ========================================================== */

    this.updateImagePanel();
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
      return {
        key: entry.entity,
        name,
        value: raw === "unavailable" ? "Unavailable" : "Error",
        level: "error",
      };
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


    return {
      key: entry.entity,
      name,
      value: label,
      level: isOn ? "on" : "off",
    };
  }


  statusContainers() {
    return {
      daily_top: this.shadowRoot?.getElementById("statusStripTop"),
      daily_bottom: this.shadowRoot?.getElementById("statusStripBottom"),
      footer: this.shadowRoot?.getElementById("statusStripFooter"),
    };
  }


  renderStatus() {

    const containers = this.statusContainers();

    const position = this._config.status_position;

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
      () => this._buildSensorSection(),
      () => this._buildForecastSection(),
      () => this._buildImagePanelSection(),
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
