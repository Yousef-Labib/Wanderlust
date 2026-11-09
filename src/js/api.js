import { CONFIG as C } from "./config.js";

export class ApiService {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return res.json();
  }

  getCountries() {
    return this.get(`${C.NAGER}/AvailableCountries`);
  }

  getHolidays(year, code) {
    return this.get(`${C.NAGER}/PublicHolidays/${year}/${code}`);
  }

  getLongWeekends(year, code) {
    return this.get(`${C.NAGER}/LongWeekend/${year}/${code}`);
  }

  async getCountry(code) {
    try {
      const data = await this.get(`${C.COUNTRIES}/alpha/${code}`);
      return Array.isArray(data) ? data[0] : data;
    } catch {
      return this.getCountryFallback(code);
    }
  }

  async getCountryFallback(code) {
    const bank = `${C.BANK}/${code}`;
    const value = (res) => res?.[1]?.[0]?.value || 0;
    const [info, b, pop, area] = await Promise.all([
      this.get(`${C.NAGER}/CountryInfo/${code}`),
      this.get(`${bank}?format=json`),
      this.get(`${bank}/indicator/SP.POP.TOTL?format=json&mrnev=1`).catch(() => null),
      this.get(`${bank}/indicator/AG.SRF.K2?format=json&mrnev=1`).catch(() => null),
    ]);
    const capital = b?.[1]?.[0] || {};
    const latlng = [+capital.latitude, +capital.longitude];
    return {
      cca2: code,
      name: { common: info.commonName, official: info.officialName },
      capital: capital.capitalCity ? [capital.capitalCity] : [],
      capitalInfo: { latlng },
      latlng,
      region: info.region,
      subregion: "",
      continents: [info.region],
      population: value(pop),
      area: value(area),
      borders: (info.borders || []).map((x) => x.countryCode),
      languages: {},
      currencies: {},
      flags: { png: `https://flagcdn.com/w320/${code.toLowerCase()}.png` },
      maps: { googleMaps: "https://www.google.com/maps/search/" + encodeURIComponent(info.commonName) },
    };
  }

  getWeather(lat, lng) {
    return this.get(
      `${C.METEO}?latitude=${lat}&longitude=${lng}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `&hourly=temperature_2m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max` +
        `&forecast_days=7&timezone=auto`
    );
  }

  async getSun(lat, lng) {
    const date = new Date().toISOString().slice(0, 10);
    const data = await this.get(`${C.SUN}?lat=${lat}&lng=${lng}&date=${date}&formatted=0`);
    return data.results;
  }

  async getEvents(city, code, year) {
    try {
      if (C.TICKETMASTER_KEY.startsWith("YOUR_")) throw new Error("no key");
      const now = new Date();
      const start = (+year === now.getFullYear() ? now : new Date(`${year}-01-01T00:00:00Z`)).toISOString().split(".")[0] + "Z";
      const data = await this.get(
        `${C.TICKETMASTER}?apikey=${C.TICKETMASTER_KEY}&city=${encodeURIComponent(city)}&countryCode=${code}` +
          `&startDateTime=${start}&endDateTime=${year}-12-31T23:59:59Z&sort=date,asc&size=20`
      );
      const list = data._embedded?.events || [];
      if (list.length) {
        const events = list.map((e) => {
          const venue = e._embedded?.venues?.[0];
          const img = e.images?.find((i) => i.width >= 400) || e.images?.[0];
          return {
            id: "event-" + e.id,
            name: e.name,
            category: e.classifications?.[0]?.segment?.name || "Event",
            image: img?.url || "",
            date: e.dates.start.localDate,
            time: (e.dates.start.localTime || "").slice(0, 5),
            venue: venue?.name || "Venue TBA",
            city: venue?.city?.name || city,
            url: e.url,
          };
        });
        return { events, total: data.page?.totalElements ?? events.length, sample: false };
      }
    } catch {}
    const events = this.sampleEvents(city, year);
    return { events, total: events.length, sample: true };
  }

  sampleEvents(city, year) {
    const items = [
      ["Live Music Night", "Music", "Grand Concert Hall"],
      ["City Football Derby", "Sports", "National Stadium"],
      ["Classical Orchestra Evening", "Arts & Theatre", "Opera House"],
      ["Street Food Festival", "Miscellaneous", "Central Park"],
      ["Stand-up Comedy Show", "Arts & Theatre", "Downtown Comedy Club"],
      ["Family Fun Day", "Family", "Exhibition Center"],
      ["Jazz Under the Stars", "Music", "Open Air Theatre"],
      ["Marathon & Fun Run", "Sports", "Waterfront"],
    ];
    const now = new Date();
    const first = +year === now.getFullYear() ? now.getTime() + 7 * 864e5 : new Date(`${year}-01-15T12:00:00`).getTime();
    return items.map(([name, category, venue], i) => ({
      id: `event-sample-${city}-${year}-${i}`.replace(/[^a-zA-Z0-9-]+/g, "-"),
      name: `${city} ${name}`,
      category,
      image: "",
      date: new Date(first + i * 12 * 864e5).toISOString().slice(0, 10),
      time: "20:00",
      venue,
      city,
      url: "#",
    }));
  }

  async getRates() {
    if (!C.EXCHANGE_KEY.startsWith("YOUR_")) {
      try {
        const data = await this.get(`${C.EXCHANGE}/${C.EXCHANGE_KEY}/latest/USD`);
        return { rates: data.conversion_rates, updated: data.time_last_update_utc };
      } catch {}
    }
    const data = await this.get(`${C.OPEN_RATES}/USD`);
    return { rates: data.rates, updated: data.time_last_update_utc };
  }
}