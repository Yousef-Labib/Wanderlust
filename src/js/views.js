export const esc = (text) => {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
};

export const num = (n) => Number(n).toLocaleString("en-US");
const parse = (date) => new Date(date + "T00:00:00");
const fmt = (date, options) => parse(date).toLocaleDateString("en-US", options);
export const pretty = (date) => fmt(date, { month: "short", day: "numeric", year: "numeric" });
const money = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hm = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
const hour = (t) => `${+t.slice(11, 13) % 12 || 12} ${+t.slice(11, 13) < 12 ? "AM" : "PM"}`;

const WEATHER = [
  [0, "fa-sun", "Clear sky", "sunny"],
  [2, "fa-cloud-sun", "Partly cloudy", "cloudy"],
  [3, "fa-cloud", "Overcast", "cloudy"],
  [48, "fa-smog", "Foggy", "foggy"],
  [57, "fa-cloud-rain", "Drizzle", "rainy"],
  [67, "fa-cloud-showers-heavy", "Rain", "rainy"],
  [77, "fa-snowflake", "Snow", "snowy"],
  [82, "fa-cloud-showers-heavy", "Rain showers", "rainy"],
  [86, "fa-snowflake", "Snow showers", "snowy"],
  [99, "fa-bolt", "Thunderstorm", "stormy"],
];

const wx = (code) => {
  const [, icon, text, theme] = WEATHER.find((w) => code <= w[0]);
  return { icon, text, theme: "weather-" + theme };
};

const POPULAR = [
  ["USD", "us", "US Dollar"],
  ["EUR", "eu", "Euro"],
  ["GBP", "gb", "British Pound"],
  ["EGP", "eg", "Egyptian Pound"],
  ["AED", "ae", "UAE Dirham"],
  ["SAR", "sa", "Saudi Riyal"],
  ["JPY", "jp", "Japanese Yen"],
  ["CAD", "ca", "Canadian Dollar"],
  ["INR", "in", "Indian Rupee"],
];

const heart = (type, id, saved, cls = "holiday-action-btn") =>
  `<button class="${cls} ${saved ? "saved" : ""}" data-save="${type}" data-id="${id}"><i class="${saved ? "fa-solid" : "fa-regular"} fa-heart"></i></button>`;

export class Renderer {
  static message(text) {
    return `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-circle-info"></i></div><p>${esc(text)}</p></div>`;
  }

  static country(c) {
    const tags = (list, cls = "") =>
      (list.length ? list : ["N/A"]).map((t) => `<span class="extra-tag ${cls}">${esc(t)}</span>`).join("");
    const item = (icon, label, value) =>
      `<div class="dashboard-country-detail"><i class="fa-solid ${icon}"></i><span class="label">${label}</span><span class="value">${esc(value)}</span></div>`;
    const extra = (icon, title, list, cls) =>
      `<div class="dashboard-country-extra"><h4><i class="fa-solid ${icon}"></i> ${title}</h4><div class="extra-tags">${tags(list, cls)}</div></div>`;
    const calling = c.idd?.root ? c.idd.root + (c.idd.suffixes?.length === 1 ? c.idd.suffixes[0] : "") : "N/A";
    const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "N/A");
    const currencies = Object.entries(c.currencies || {}).map(([code, v]) => `${v.name} (${code} ${v.symbol || ""})`);

    return `
      <div class="dashboard-country-header">
        <img src="${c.flags.png}" alt="${esc(c.name.common)}" class="dashboard-country-flag">
        <div class="dashboard-country-title">
          <h3>${esc(c.name.common)}</h3>
          <p class="official-name">${esc(c.name.official)}</p>
          <span class="region"><i class="fa-solid fa-location-dot"></i> ${esc(c.region)}${c.subregion ? " • " + esc(c.subregion) : ""}</span>
        </div>
      </div>
      <div class="dashboard-local-time"><div class="local-time-display">
        <i class="fa-solid fa-clock"></i><span class="local-time-value" id="country-local-time">--:--:--</span><span class="local-time-zone" id="country-tz-label"></span>
      </div></div>
      <div class="dashboard-country-grid">
        ${item("fa-building-columns", "Capital", c.capital?.[0] || "N/A")}
        ${item("fa-users", "Population", c.population ? num(c.population) : "N/A")}
        ${item("fa-ruler-combined", "Area", c.area ? num(c.area) + " km²" : "N/A")}
        ${item("fa-globe", "Continent", c.continents?.[0] || c.region)}
        ${item("fa-phone", "Calling Code", calling)}
        ${item("fa-car", "Driving Side", cap(c.car?.side))}
        ${item("fa-calendar-week", "Week Starts", cap(c.startOfWeek))}
      </div>
      <div class="dashboard-country-extras">
        ${extra("fa-coins", "Currency", currencies)}
        ${extra("fa-language", "Languages", Object.values(c.languages || {}))}
        ${extra("fa-map-location-dot", "Neighbors", c.borders || [], "border-tag")}
      </div>
      <div class="dashboard-country-actions">
        <a href="${c.maps?.googleMaps || "#"}" target="_blank" class="btn-map-link"><i class="fa-solid fa-map"></i> View on Google Maps</a>
      </div>`;
  }

  static holidays(list, isSaved) {
    if (!list.length) return Renderer.message("No holidays found for this selection.");
    return list
      .map(
        (h) => `
      <div class="holiday-card">
        <div class="holiday-card-header">
          <div class="holiday-date-box"><span class="day">${+h.date.slice(8)}</span><span class="month">${fmt(h.date, { month: "short" })}</span></div>
          ${heart("holiday", h.id, isSaved(h.id))}
        </div>
        <h3>${esc(h.localName)}</h3>
        <p class="holiday-name">${esc(h.name)}</p>
        <div class="holiday-card-footer">
          <span class="holiday-day-badge"><i class="fa-regular fa-calendar"></i> ${fmt(h.date, { weekday: "long" })}</span>
          <span class="holiday-type-badge">${esc(h.types?.[0] || "Public")}</span>
        </div>
      </div>`
      )
      .join("");
  }

  static longWeekends(list, isSaved) {
    if (!list.length) return Renderer.message("No long weekends found for this selection.");
    return list
      .map((lw, i) => {
        const days = Array.from({ length: lw.dayCount }, (_, d) => {
          const day = parse(lw.startDate);
          day.setDate(day.getDate() + d);
          return `<div class="lw-day ${day.getDay() % 6 === 0 ? "weekend" : ""}"><span class="name">${day.toLocaleDateString("en-US", { weekday: "short" })}</span><span class="num">${day.getDate()}</span></div>`;
        }).join("");
        const info = lw.needBridgeDay
          ? '<div class="lw-info-box warning"><i class="fa-solid fa-info-circle"></i> Requires taking a bridge day off</div>'
          : '<div class="lw-info-box success"><i class="fa-solid fa-check-circle"></i> No extra days off needed!</div>';
        return `
      <div class="lw-card">
        <div class="lw-card-header">
          <span class="lw-badge"><i class="fa-solid fa-calendar-days"></i> ${lw.dayCount} Days</span>
          ${heart("longweekend", lw.id, isSaved(lw.id))}
        </div>
        <h3>Long Weekend #${i + 1}</h3>
        <div class="lw-dates"><i class="fa-regular fa-calendar"></i> ${pretty(lw.startDate)} - ${pretty(lw.endDate)}</div>
        ${info}
        <div class="lw-days-visual">${days}</div>
      </div>`;
      })
      .join("");
  }

  static sampleNotice =
    '<div style="grid-column: 1 / -1; padding: 12px 16px; background: #fffbeb; color: #b45309; border-radius: 12px; font-size: 13px;"><i class="fa-solid fa-circle-info"></i> Showing sample events. Add a Ticketmaster API key in config.js to see real events.</div>';

  static events(list, isSaved) {
    return list
      .map((e) => {
        const saved = isSaved(e.id);
        return `
      <div class="event-card">
        <div class="event-card-image">
          ${e.image ? `<img src="${e.image}" alt="${esc(e.name)}">` : ""}
          <span class="event-card-category">${esc(e.category)}</span>
          ${heart("event", e.id, saved, "event-card-save")}
        </div>
        <div class="event-card-body">
          <h3>${esc(e.name)}</h3>
          <div class="event-card-info">
            <div><i class="fa-regular fa-calendar"></i>${pretty(e.date)}${e.time ? " at " + e.time : ""}</div>
            <div><i class="fa-solid fa-location-dot"></i>${esc(e.venue)}, ${esc(e.city)}</div>
          </div>
          <div class="event-card-footer">
            <button class="btn-event ${saved ? "saved" : ""}" data-save="event" data-id="${e.id}"><i class="${saved ? "fa-solid" : "fa-regular"} fa-heart"></i> ${saved ? "Saved" : "Save"}</button>
            <a href="${e.url}" target="_blank" class="btn-buy-ticket"><i class="fa-solid fa-ticket"></i> Buy Tickets</a>
          </div>
        </div>
      </div>`;
      })
      .join("");
  }

  static weather(w, city) {
    const { current: cur, daily: d, hourly: h } = w;
    const info = wx(cur.weather_code);
    const detail = (cls, icon, label, value) =>
      `<div class="weather-detail-card"><div class="detail-icon ${cls}"><i class="fa-solid ${icon}"></i></div><div class="detail-info"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div></div>`;
    const start = Math.max(0, h.time.findIndex((t) => t >= cur.time.slice(0, 13) + ":00"));
    const hourly = h.time
      .slice(start, start + 8)
      .map(
        (t, i) => `<div class="hourly-item ${i ? "" : "now"}"><span class="hourly-time">${i ? hour(t) : "Now"}</span><div class="hourly-icon"><i class="fa-solid ${wx(h.weather_code[start + i]).icon}"></i></div><span class="hourly-temp">${Math.round(h.temperature_2m[start + i])}°</span></div>`
      )
      .join("");
    const forecast = d.time
      .map((t, i) => {
        const rain = d.precipitation_probability_max[i];
        return `<div class="forecast-day ${i ? "" : "today"}">
        <div class="forecast-day-name"><span class="day-label">${i ? fmt(t, { weekday: "short" }) : "Today"}</span><span class="day-date">${+t.slice(8)} ${fmt(t, { month: "short" })}</span></div>
        <div class="forecast-icon"><i class="fa-solid ${wx(d.weather_code[i]).icon}"></i></div>
        <div class="forecast-temps"><span class="temp-max">${Math.round(d.temperature_2m_max[i])}°</span><span class="temp-min">${Math.round(d.temperature_2m_min[i])}°</span></div>
        <div class="forecast-precip">${rain > 0 ? `<i class="fa-solid fa-droplet"></i><span>${rain}%</span>` : ""}</div></div>`;
      })
      .join("");

    return `
      <div class="weather-hero-card ${info.theme}">
        <div class="weather-location"><i class="fa-solid fa-location-dot"></i><span>${esc(city)}</span><span class="weather-time">${fmt(cur.time.slice(0, 10), { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span></div>
        <div class="weather-hero-main">
          <div class="weather-hero-left">
            <div class="weather-hero-icon"><i class="fa-solid ${info.icon}"></i></div>
            <div class="weather-hero-temp"><span class="temp-value">${Math.round(cur.temperature_2m)}</span><span class="temp-unit">°C</span></div>
          </div>
          <div class="weather-hero-right">
            <div class="weather-condition">${info.text}</div>
            <div class="weather-feels">Feels like ${Math.round(cur.apparent_temperature)}°C</div>
            <div class="weather-high-low">
              <span class="high"><i class="fa-solid fa-arrow-up"></i> ${Math.round(d.temperature_2m_max[0])}°</span>
              <span class="low"><i class="fa-solid fa-arrow-down"></i> ${Math.round(d.temperature_2m_min[0])}°</span>
            </div>
          </div>
        </div>
      </div>
      <div class="weather-details-grid">
        ${detail("humidity", "fa-droplet", "Humidity", cur.relative_humidity_2m + "%")}
        ${detail("wind", "fa-wind", "Wind", cur.wind_speed_10m + " km/h")}
        ${detail("uv", "fa-sun", "UV Index", Math.round(d.uv_index_max[0]))}
        ${detail("precip", "fa-cloud-rain", "Precipitation", d.precipitation_probability_max[0] + "%")}
      </div>
      <div class="weather-section"><h3 class="weather-section-title"><i class="fa-solid fa-clock"></i> Hourly Forecast</h3><div class="hourly-scroll">${hourly}</div></div>
      <div class="weather-section"><h3 class="weather-section-title"><i class="fa-solid fa-calendar-week"></i> 7-Day Forecast</h3><div class="forecast-list">${forecast}</div></div>`;
  }

  static sun(s, city, tz) {
    const time = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: tz });
    const now = new Date();
    const card = (cls, icon, label, value, sub) =>
      `<div class="sun-time-card ${cls}"><div class="icon"><i class="fa-solid ${icon}"></i></div><div class="label">${label}</div><div class="time">${value}</div><div class="sub-label">${sub}</div></div>`;
    const percent = ((s.day_length / 86400) * 100).toFixed(1);

    return `
      <div class="sun-main-card">
        <div class="sun-main-header">
          <div class="sun-location"><h2><i class="fa-solid fa-location-dot"></i> ${esc(city)}</h2><p>Sun times for your selected location</p></div>
          <div class="sun-date-display"><div class="date">${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: tz })}</div><div class="day">${now.toLocaleDateString("en-US", { weekday: "long", timeZone: tz })}</div></div>
        </div>
        <div class="sun-times-grid">
          ${card("dawn", "fa-moon", "Dawn", time(s.civil_twilight_begin), "Civil Twilight")}
          ${card("sunrise", "fa-sun", "Sunrise", time(s.sunrise), "Golden Hour Start")}
          ${card("noon", "fa-sun", "Solar Noon", time(s.solar_noon), "Sun at Highest")}
          ${card("sunset", "fa-sun", "Sunset", time(s.sunset), "Golden Hour End")}
          ${card("dusk", "fa-moon", "Dusk", time(s.civil_twilight_end), "Civil Twilight")}
          ${card("daylight", "fa-hourglass-half", "Day Length", hm(s.day_length), "Total Daylight")}
        </div>
      </div>
      <div class="day-length-card">
        <h3><i class="fa-solid fa-chart-pie"></i> Daylight Distribution</h3>
        <div class="day-progress"><div class="day-progress-bar"><div class="day-progress-fill" style="width: ${percent}%"></div></div></div>
        <div class="day-length-stats">
          <div class="day-stat"><div class="value">${hm(s.day_length)}</div><div class="label">Daylight</div></div>
          <div class="day-stat"><div class="value">${percent}%</div><div class="label">of 24 Hours</div></div>
          <div class="day-stat"><div class="value">${hm(86400 - s.day_length)}</div><div class="label">Darkness</div></div>
        </div>
      </div>`;
  }

  static currencyOptions(codes, selected) {
    const names = new Intl.DisplayNames(["en"], { type: "currency" });
    return codes
      .map((c) => `<option value="${c}" ${c === selected ? "selected" : ""}>${c} - ${names.of(c)}</option>`)
      .join("");
  }

  static conversion(amount, result, rate, from, to, updated) {
    return `
      <div class="conversion-display">
        <div class="conversion-from"><span class="amount">${money(amount)}</span><span class="currency-code">${from}</span></div>
        <div class="conversion-equals"><i class="fa-solid fa-equals"></i></div>
        <div class="conversion-to"><span class="amount">${money(result)}</span><span class="currency-code">${to}</span></div>
      </div>
      <div class="exchange-rate-info"><p>1 ${from} = ${rate.toFixed(4)} ${to}</p><small>Last updated: ${updated}</small></div>`;
  }

  static popular(rates, from) {
    return POPULAR.filter(([code]) => code !== from && rates[code])
      .map(
        ([code, flag, name]) => `<div class="popular-currency-card">
        <img src="https://flagcdn.com/w40/${flag}.png" alt="${code}" class="flag">
        <div class="info"><div class="code">${code}</div><div class="name">${name}</div></div>
        <div class="rate">${(rates[code] / rates[from]).toFixed(4)}</div></div>`
      )
      .join("");
  }

  static plans(list) {
    if (!list.length) {
      return `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-heart-crack"></i></div><h3>No Saved Plans Yet</h3><p>Start exploring and save holidays, events, or long weekends you like!</p><button class="btn-primary" id="start-exploring-btn"><i class="fa-solid fa-compass"></i> Start Exploring</button></div>`;
    }
    const labels = { holiday: "Holiday", event: "Event", longweekend: "Long Weekend" };
    return list
      .map(
        (p) => `
      <div class="plan-card">
        <span class="plan-card-type ${p.type}">${labels[p.type]}</span>
        <div class="plan-card-content">
          <h4>${esc(p.title)}</h4>
          <div class="plan-card-details">
            <div><i class="fa-regular fa-calendar"></i> ${pretty(p.date)}</div>
            <div><i class="fa-solid fa-circle-info"></i> ${esc(p.subtitle)}</div>
            <div><i class="fa-solid fa-location-dot"></i> ${esc(p.country)}${p.type === "event" ? " • " + esc(p.city) : ""}</div>
          </div>
          <div class="plan-card-actions"><button class="btn-plan-remove" data-delete="${p.id}"><i class="fa-solid fa-trash"></i> Remove</button></div>
        </div>
      </div>`
      )
      .join("");
  }
}