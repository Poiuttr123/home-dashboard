/**
 * Home Display Card
 * A full dashboard-style Lovelace card: clock, weather, zmanim, special times,
 * a configurable "Daily Information" sensor list, and a toggleable bottom-right
 * panel (wedding countdown iframe by default, or an uploaded image).
 */

const CARD_VERSION = "1.0.5";

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

  const providedPanel = source.image_panel || {};
  const image_panel = { ...DEFAULT_IMAGE_PANEL, ...providedPanel };

  if (!providedPanel.mode) {
    // Back-compat: configs saved before "mode" existed only had `image`.
    image_panel.mode = providedPanel.image ? "image" : "default";
  }
  if (!IMAGE_PANEL_MODES.includes(image_panel.mode)) {
    image_panel.mode = "default";
  }

  return { entities, sensors, image_panel };
}

class HomeDisplayCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = normalizeConfig({});
    this._clockTimer = null;
    this._lastSheetSignature = "";
    this._lastCustomCode = null;
  }

  static getConfigElement() {
    return document.createElement("home-display-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:home-display-card",
      entities: { ...DEFAULT_ENTITIES },
      sensors: [],
      image_panel: { ...DEFAULT_IMAGE_PANEL },
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = normalizeConfig(config);
    if (this._hass) {
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

    this.updateData();
  }

  connectedCallback() {
    if (!this._clockTimer) {
      this.startClock();
    }
  }

  disconnectedCallback() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
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
            1fr
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

          grid-template-columns:
            auto
            minmax(0,1fr);

          gap: clamp(10px, 1.5vw, 22px);

          align-items: center;
          align-content: center;

          min-height: 0;
        }

        .weather-icon {
          font-size:
            clamp(34px, min(4.6vw, 7.2vh), 65px);

          line-height: 1;
        }

        .weather-temp {
          font-size:
            clamp(36px, min(5vw, 7.5vh), 68px);

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

          grid-template-rows:
            auto
            1fr;

          gap: 6px;

          min-height: 0;
        }

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

              </div>

              <div class="weather-details">

                <span id="weatherHighLow"></span>

                <span id="humidity"></span>

                <span id="wind"></span>

              </div>

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
                class="daily-grid"
                id="dailyGrid">
              </div>

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


      let forecastText = "";


      if (
        Array.isArray(
          attrs.forecast
        ) &&
        attrs.forecast.length
      ) {

        const today =
          attrs.forecast[0];


        forecastText =
          `High ${today.temperature ?? "--"}°` +
          ` / Low ${today.templow ?? "--"}°`;
      }


      this.setText(
        "weatherHighLow",
        forecastText
      );
    }


    /* ==========================================================
       SHEET DATA
       ========================================================== */

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
      image_panel: { ...this._config.image_panel },
    };

    mutator(next);

    this._config = next;

    const fullConfig = {
      ...this._rawConfig,
      entities: next.entities,
      sensors: next.sensors,
      image_panel: next.image_panel,
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
      () => this._buildSensorSection(),
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
