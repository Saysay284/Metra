export default async function handler(req, res) {
  // CORS (harmless even on same-origin; needed if frontend is ever hosted separately)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing latitude or longitude for weather data.' });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure` +
      `&hourly=temperature_2m,relative_humidity_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,relative_humidity_2m_max,uv_index_max,sunrise,sunset` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=3&timezone=auto`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const normalized = {
      current: {
        temperature_2m: Math.round(data.current.temperature_2m),
        relative_humidity_2m: Math.round(data.current.relative_humidity_2m),
        weather_code: data.current.weather_code,
        wind_speed_10m: Math.round(data.current.wind_speed_10m),
        surface_pressure: Math.round(data.current.surface_pressure),
        visibility: 16090
      },
      timezone: data.timezone,
      hourly: {
        temperature_2m: data.hourly.temperature_2m.slice(0, 24).map(Math.round),
        relative_humidity_2m: data.hourly.relative_humidity_2m.slice(0, 24).map(Math.round),
        weather_code: data.hourly.weather_code.slice(0, 24)
      },
      daily: {
        weather_code: data.daily.weather_code,
        temperature_2m_max: data.daily.temperature_2m_max.map(Math.round),
        relative_humidity_2m_max: data.daily.relative_humidity_2m_max.map(h => Math.round(h || 0)),
        uv_index_max: data.daily.uv_index_max.map(uv => Math.round(uv || 0)),
        sunrise: data.daily.sunrise.map(s => s.split('T')[1].substring(0, 5)),
        sunset: data.daily.sunset.map(s => s.split('T')[1].substring(0, 5))
      }
    };

    return res.status(200).json(normalized);
  } catch (err) {
    console.error('Open-Meteo weather API failed:', err.message);
    return res.status(500).json({ error: `Failed to retrieve weather data: ${err.message}` });
  }
}