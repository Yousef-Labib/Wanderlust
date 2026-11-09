import { ROUTES, TITLES } from "./config.js";
import { ApiService } from "./api.js";
import { Renderer, esc, pretty } from "./views.js";

const PLANS_KEY = "wanderlust_plans";
const SELECTION_KEY = "wanderlust_selection";

const IDS = {
  sidebar: "sidebar",
  overlay: "sidebar-overlay",
  menu: "mobile-menu-btn",
  title: "page-title",
  subtitle: "page-subtitle",
  datetime: "current-datetime",
  country: "global-country",
  city: "global-city",
  year: "global-year",
  search: "global-search-btn",
  clear: "clear-selection-btn",
  dest: "selected-destination",
  flag: "selected-country-flag",
  countryName: "selected-country-name",
  cityName: "selected-city-name",
  info: "dashboard-country-info",
  holidays: "holidays-content",
  events: "events-content",
  weather: "weather-content",
  lw: "lw-content",
  sun: "sun-times-content",
  plans: "plans-content",
  badge: "plans-count",
  clearAll: "clear-all-plans-btn",
  amount: "currency-amount",
  from: "currency-from",
  to: "currency-to",
  convert: "convert-btn",
  swap: "swap-currencies-btn",
  result: "currency-result",
  popular: "popular-currencies",
  loader: "loading-overlay",
  toasts: "toast-container",
};

const flag = (code, width = 40) => `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
const slug = (...parts) => parts.join("-").replace(/[^a-zA-Z0-9]+/g, "-");

class PlansStorage {
  constructor(key) {
    this.key = key;
  }

  all() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || [];
    } catch {
      return [];
    }
  }

  save(list) {
    localStorage.setItem(this.key, JSON.stringify(list));
  }

  has(id) {
    return this.all().some((p) => p.id === id);
  }

  add(plan) {
    if (!this.has(plan.id)) this.save([...this.all(), plan]);
  }

  remove(id) {
    this.save(this.all().filter((p) => p.id !== id));
  }

  clear() {
    this.save([]);
  }
}

class Router {
  constructor(routes, onChange) {
    this.routes = routes;
    this.onChange = onChange;
    this.redirect = sessionStorage.getItem("redirect");
    this.base = this.baseOf(this.redirect || location.pathname);
    addEventListener("popstate", () => onChange(this.current()));
  }

  clean(path) {
    return path.replace(/index\.html$/, "").replace(/\/$/, "");
  }

  match(path) {
    return Object.entries(this.routes).find(([, p]) => p && path.endsWith("/" + p));
  }

  baseOf(path) {
    path = this.clean(path);
    const found = this.match(path);
    return found ? path.slice(0, -(found[1].length + 1)) : path;
  }

  current() {
    const found = this.match(this.clean(location.pathname));
    return found ? found[0] : "dashboard";
  }

  start() {
    if (this.redirect) {
      history.replaceState(null, "", this.redirect);
      sessionStorage.removeItem("redirect");
    }
    this.onChange(this.current());
  }

  go(view) {
    history.pushState(null, "", this.base + "/" + this.routes[view]);
    this.onChange(view);
  }
}

class App {
  constructor() {
    this.api = new ApiService();
    this.plans = new PlansStorage(PLANS_KEY);
    this.router = new Router(ROUTES, (view) => this.show(view));
    this.el = Object.fromEntries(Object.entries(IDS).map(([key, id]) => [key, document.getElementById(id)]));
    this.sel = null;
    this.country = null;
    this.tz = null;
    this.offset = 0;
    this.rates = null;
    this.updated = null;
    this.filter = "all";
    this.data = { holiday: [], event: [], longweekend: [] };
    this.bind();
    this.init();
  }

  bind() {
    const on = (el, event, fn) => el.addEventListener(event, fn);
    const all = (selector) => document.querySelectorAll(selector);

    all(".nav-item").forEach((a) =>
      on(a, "click", (e) => {
        e.preventDefault();
        this.router.go(a.dataset.view);
      })
    );
    on(this.el.menu, "click", () => this.sidebar(true));
    on(this.el.overlay, "click", () => this.sidebar(false));
    on(this.el.country, "change", () => this.el.country.value && this.loadCountry(this.el.country.value));
    on(this.el.search, "click", () => this.explore());
    on(this.el.clear, "click", () => this.clear());
    on(this.el.convert, "click", () => this.convert());
    on(this.el.swap, "click", () => this.swap());
    on(this.el.from, "change", () => this.popular());
    on(this.el.amount, "keydown", (e) => e.key === "Enter" && this.convert());
    on(this.el.clearAll, "click", () => this.clearAll());

    all(".plan-filter").forEach((btn) =>
      on(btn, "click", () => {
        this.filter = btn.dataset.filter;
        all(".plan-filter").forEach((b) => b.classList.toggle("active", b === btn));
        this.renderPlans();
      })
    );

    on(document.getElementById("main-content"), "click", (e) => {
      const save = e.target.closest("[data-save]");
      const del = e.target.closest("[data-delete]");
      if (save) this.toggle(save.dataset.save, save.dataset.id);
      if (del) this.remove(del.dataset.delete);
      if (e.target.closest("#start-exploring-btn")) this.router.go("dashboard");
    });
  }

  async init() {
    this.tick();
    setInterval(() => this.tick(), 1000);
    const year = new Date().getFullYear();
    this.el.year.innerHTML = [year - 1, year, year + 1, year + 2]
      .map((y) => `<option value="${y}" ${y === year ? "selected" : ""}>${y}</option>`)
      .join("");
    this.updatePlans();
    this.router.start();
    await this.loadCountries();
    await this.restore();
    await this.explore();
    this.loadCurrency();
  }

  show(view) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === view + "-view"));
    document.querySelectorAll(".nav-item").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
    const [title, subtitle] = TITLES[view] || TITLES.dashboard;
    this.el.title.textContent = title;
    this.el.subtitle.textContent = subtitle;
    document.title = title + " | Wanderlust";
    this.sidebar(false);
    scrollTo(0, 0);
  }

  sidebar(open) {
    this.el.sidebar.classList.toggle("open", open);
    this.el.overlay.classList.remove("hidden");
    this.el.overlay.classList.toggle("active", open);
  }

  loading(on, text = "Loading...") {
    document.getElementById("loading-text").textContent = text;
    this.el.loader.classList.toggle("hidden", !on);
  }

  toast(message, type = "success") {
    const icon = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info" }[type];
    const toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${esc(message)}</span>`;
    this.el.toasts.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  stat(name, value) {
    document.getElementById("stat-" + name).textContent = value;
  }

  tick() {
    this.el.datetime.textContent = new Date().toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const clock = document.getElementById("country-local-time");
    if (!clock || !this.tz) return;
    clock.textContent = new Date().toLocaleTimeString("en-US", { timeZone: this.tz });
    const minutes = Math.abs(this.offset) / 60;
    const pad = (n) => String(n).padStart(2, "0");
    document.getElementById("country-tz-label").textContent =
      `UTC${this.offset < 0 ? "-" : "+"}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }

  async loadCountries() {
    try {
      const list = (await this.api.getCountries()).sort((a, b) => a.name.localeCompare(b.name));
      this.el.country.innerHTML =
        '<option value="">Select Country</option>' +
        list.map((c) => `<option value="${c.countryCode}">${c.name}</option>`).join("");
      this.stat("countries", list.length);
    } catch {
      this.toast("Couldn't load countries list", "error");
    }
  }

  async restore() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(SELECTION_KEY));
    } catch {}
    const codes = [...this.el.country.options].map((o) => o.value);
    const code = [saved?.code, "EG", "US"].find((c) => c && codes.includes(c));
    if (!code) return;
    this.el.country.value = code;
    await this.loadCountry(code);
    if (saved?.code === code) {
      this.el.city.value = saved.city;
      this.el.year.value = saved.year;
    }
  }

  async loadCountry(code) {
    try {
      this.country = await this.api.getCountry(code);
      const cities = this.country.capital?.length ? this.country.capital : [this.country.name.common];
      this.el.city.innerHTML = cities.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    } catch {
      this.country = null;
      this.toast("Couldn't load country information", "error");
    }
  }

  fill(box, result, what, render) {
    box.innerHTML = result.status === "fulfilled" ? render(result.value) : Renderer.message(`Couldn't load ${what}.`);
  }

  async explore() {
    const code = this.el.country.value;
    if (!code) return this.toast("Please select a country first", "info");

    this.loading(true, "Exploring your destination...");
    if (this.country?.cca2 !== code) await this.loadCountry(code);
    if (!this.country) return this.loading(false);

    const c = this.country;
    const [lat, lng] = c.capitalInfo?.latlng?.length ? c.capitalInfo.latlng : c.latlng;
    const s = (this.sel = { code, name: c.name.common, city: this.el.city.value, year: this.el.year.value, lat, lng });
    localStorage.setItem(SELECTION_KEY, JSON.stringify({ code, city: s.city, year: s.year }));
    this.badges();
    this.el.info.innerHTML = Renderer.country(c);

    this.data = { holiday: [], event: [], longweekend: [] };
    this.stat("holidays", 0);
    this.stat("events", 0);
    this.tz = null;

    const [hol, lw, weather, events, sun] = await Promise.allSettled([
      this.api.getHolidays(s.year, code),
      this.api.getLongWeekends(s.year, code),
      this.api.getWeather(lat, lng),
      this.api.getEvents(s.city, code, s.year),
      this.api.getSun(lat, lng),
    ]);
    const saved = (id) => this.plans.has(id);

    this.fill(this.el.holidays, hol, "holidays", (list) => {
      this.data.holiday = list.map((h) => ({ ...h, id: slug("holiday", code, h.date, h.name) }));
      this.stat("holidays", list.length);
      return Renderer.holidays(this.data.holiday, saved);
    });
    this.fill(this.el.lw, lw, "long weekends", (list) => {
      this.data.longweekend = list.map((l) => ({ ...l, id: slug("lw", code, l.startDate) }));
      return Renderer.longWeekends(this.data.longweekend, saved);
    });
    this.fill(this.el.weather, weather, "the weather forecast", (w) => {
      this.tz = w.timezone;
      this.offset = w.utc_offset_seconds;
      return Renderer.weather(w, s.city);
    });
    this.fill(this.el.events, events, "events", (e) => {
      this.data.event = e.events;
      this.stat("events", e.total);
      return (e.sample ? Renderer.sampleNotice : "") + Renderer.events(e.events, saved);
    });
    this.fill(this.el.sun, sun, "sunrise and sunset times", (r) => Renderer.sun(r, s.city, this.tz || "UTC"));

    this.loading(false);
  }

  badges() {
    const s = this.sel;
    this.el.dest.classList.remove("hidden");
    this.el.flag.src = flag(s.code, 80);
    this.el.flag.alt = s.name;
    this.el.countryName.textContent = s.name;
    this.el.cityName.textContent = "• " + s.city;
    document.querySelectorAll(".current-selection-badge").forEach((badge) => {
      const withYear = badge.querySelector(".selection-year");
      badge.innerHTML =
        `<img src="${flag(s.code)}" alt="${esc(s.name)}" class="selection-flag"><span>${esc(s.name)}</span>` +
        (withYear ? `<span class="selection-year">${s.year}</span>` : `<span class="selection-city">• ${esc(s.city)}</span>`);
    });
  }

  clear() {
    this.sel = this.country = this.tz = null;
    this.el.country.value = "";
    this.el.city.innerHTML = '<option value="">Select City</option>';
    this.el.dest.classList.add("hidden");
    localStorage.removeItem(SELECTION_KEY);
    const message = Renderer.message("Select a destination from the Dashboard first.");
    ["info", "holidays", "events", "weather", "lw", "sun"].forEach((key) => (this.el[key].innerHTML = message));
    this.stat("holidays", 0);
    this.stat("events", 0);
  }

  toggle(type, id) {
    if (this.plans.has(id)) {
      this.plans.remove(id);
      this.toast("Removed from My Plans", "info");
    } else {
      const item = this.data[type].find((x) => x.id === id);
      if (!item) return;
      const details = {
        holiday: { title: item.localName, subtitle: item.name, date: item.date },
        longweekend: {
          title: `Long Weekend (${item.dayCount} days)`,
          subtitle: `${pretty(item.startDate)} - ${pretty(item.endDate)}`,
          date: item.startDate,
        },
        event: { title: item.name, subtitle: `${item.venue}, ${item.city}`, date: item.date },
      }[type];
      this.plans.add({ id, type, country: this.sel.name, city: this.sel.city, ...details });
      this.toast("Saved to My Plans!");
    }
    this.hearts(id);
    this.updatePlans();
  }

  remove(id) {
    this.plans.remove(id);
    this.toast("Plan deleted", "info");
    this.hearts(id);
    this.updatePlans();
  }

  async clearAll() {
    if (!this.plans.all().length) return this.toast("You have no saved plans", "info");
    const { isConfirmed } = await Swal.fire({
      title: "Clear all plans?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, clear all",
    });
    if (!isConfirmed) return;
    const ids = this.plans.all().map((p) => p.id);
    this.plans.clear();
    ids.forEach((id) => this.hearts(id));
    this.updatePlans();
  }

  hearts(id) {
    const saved = this.plans.has(id);
    document.querySelectorAll(`[data-save][data-id="${id}"]`).forEach((btn) => {
      btn.classList.toggle("saved", saved);
      btn.querySelector("i").className = `${saved ? "fa-solid" : "fa-regular"} fa-heart`;
      if (btn.classList.contains("btn-event")) btn.lastChild.textContent = saved ? " Saved" : " Save";
    });
  }

  updatePlans() {
    const all = this.plans.all();
    const count = (type) => all.filter((p) => p.type === type).length;
    this.stat("saved", all.length);
    this.el.badge.textContent = all.length;
    this.el.badge.classList.toggle("hidden", !all.length);
    Object.entries({
      "filter-all-count": all.length,
      "filter-holiday-count": count("holiday"),
      "filter-event-count": count("event"),
      "filter-lw-count": count("longweekend"),
    }).forEach(([id, value]) => (document.getElementById(id).textContent = value));
    this.renderPlans();
  }

  renderPlans() {
    const list = this.plans
      .all()
      .filter((p) => this.filter === "all" || p.type === this.filter)
      .sort((a, b) => a.date.localeCompare(b.date));
    this.el.plans.innerHTML = Renderer.plans(list);
  }

  async loadCurrency() {
    try {
      const { rates, updated } = await this.api.getRates();
      this.rates = rates;
      this.updated = updated;
      const codes = Object.keys(rates).sort();
      this.el.from.innerHTML = Renderer.currencyOptions(codes, "USD");
      this.el.to.innerHTML = Renderer.currencyOptions(codes, codes.includes("EGP") ? "EGP" : "EUR");
      this.popular();
      this.convert();
    } catch {
      this.toast("Couldn't load exchange rates", "error");
    }
  }

  popular() {
    if (this.rates) this.el.popular.innerHTML = Renderer.popular(this.rates, this.el.from.value);
  }

  convert() {
    const amount = +this.el.amount.value;
    const from = this.el.from.value;
    const to = this.el.to.value;
    if (!(amount > 0)) return this.toast("Please enter a valid amount", "info");
    if (!this.rates?.[from] || !this.rates?.[to]) return;
    const rate = this.rates[to] / this.rates[from];
    const date = this.updated
      ? new Date(this.updated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "today";
    this.el.result.innerHTML = Renderer.conversion(amount, amount * rate, rate, from, to, date);
  }

  swap() {
    [this.el.from.value, this.el.to.value] = [this.el.to.value, this.el.from.value];
    this.popular();
    this.convert();
  }
}

new App();