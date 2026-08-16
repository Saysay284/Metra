import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;

// 1. HTTP Security Headers
app.use(helmet());

// 2. Body Parser Guard (Limit payload size to prevent DoS)
app.use(express.json({ limit: '10kb' }));

// 3. Strict CORS Origin Configuration
const allowedOrigins = [
  'http://localhost:3000',
  process.env.ALLOWED_ORIGIN, // e.g., https://your-metra-app.vercel.app
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy restriction'));
      }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);

// 4. Global Rate Limiter (Prevents server-wide abuse)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// 5. Strict Rate Limiter for Gemini AI Endpoint
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per IP
  message: { error: 'AI briefing limit exceeded. Try again in a minute.' },
});

// Initialize GoogleGenAI client
const ai = new GoogleGenAI();

// ── AI Briefing ──────────────────────────────────────────────────────────────
app.post('/api/ai-briefing', aiLimiter, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY missing from environment.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const { city, tempC, tempF, condition, humidity, language, timezone } = req.body || {};

    // Input Sanitization
    const cleanCity = typeof city === 'string' ? city.trim().slice(0, 100) : 'Unknown Location';
    const cleanCondition = typeof condition === 'string' ? condition.trim().slice(0, 50) : 'Clear';
    const cleanLanguage = typeof language === 'string' ? language.trim().slice(0, 30) : 'English';
    const cleanTimezone = typeof timezone === 'string' ? timezone.trim() : 'UTC';

    let localHour = 12;
    try {
      localHour = parseInt(
        new Date().toLocaleString('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: cleanTimezone,
        }),
        10
      );
    } catch {
      localHour = new Date().getUTCHours();
    }

    const timeOfDay =
      localHour >= 5 && localHour < 12
        ? 'morning'
        : localHour >= 12 && localHour < 17
        ? 'afternoon'
        : localHour >= 17 && localHour < 21
        ? 'evening'
        : 'night';

    const prompt = `
      Context: The user is looking at a weather app called Metra.
      Current Weather Data:
      - Location: ${cleanCity}
      - Time of day: ${timeOfDay}
      - Temperature: ${tempC ?? '--'}°C / ${tempF ?? '--'}°F
      - Condition: ${cleanCondition}
      - Humidity: ${humidity ?? '--'}%

      Task: Provide a highly engaging, friendly 2-sentence weather summary 
      that is appropriate for the current time of day (${timeOfDay}).
      Include a smart commuting or clothing tip based on this data.
      Do NOT say "good morning/afternoon" — just be natural and time-aware.
      Language Requirement: Respond completely in this language: ${cleanLanguage}.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    console.log(' Briefing generated successfully');
    res.json({ summary: response.text });
  } catch (error) {
    console.error('❌ Error generating AI briefing:', error);
    res.status(500).json({ error: 'Failed to generate weather briefing.' });
  }
});

// ── Geocoding Proxy ──────────────────────────────────────────────────────────
app.get('/api/geocode', async (req, res) => {
  const { name, count } = req.query;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid location name parameter.' });
  }

  const maxCount = Math.min(10, Math.max(1, parseInt(count, 10) || 5));
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=${maxCount}&language=en&format=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Geocode Proxy Error:', err);
    res.status(500).json({ error: 'Geocoding request failed.' });
  }
});

app.get('/api/reverse-geocode', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat or lon parameters.' });

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}`;
    const timeZoneUrl = `https://timeapi.io/api/Time/current/coordinate?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lon)}`;

    const [locationResponse, timeResponse] = await Promise.all([
      fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'MetraWeatherApp/1.0 (student-project)',
          'Accept-Language': 'en',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(timeZoneUrl, { signal: AbortSignal.timeout(5000) }),
    ]);

    if (!locationResponse.ok || !timeResponse.ok) {
      throw new Error('Upstream location/timezone service failed');
    }

    const locationData = await locationResponse.json();
    const timeData = await timeResponse.json();

    const address = locationData.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.county ||
      address.state ||
      locationData.display_name ||
      'Your Location';
    const timezone = timeData.timeZone || timeData.timezone || 'UTC';

    res.json({ city, timezone });
  } catch (err) {
    console.error('Reverse Geocode Error:', err);
    res.status(500).json({ error: 'Reverse geocoding request failed.' });
  }
});

// ── Weather Proxy ────────────────────────────────────────────────────────────
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing latitude or longitude parameters.' });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure` +
      `&hourly=temperature_2m,relative_humidity_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,relative_humidity_2m_max,uv_index_max,sunrise,sunset` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=3&timezone=auto`;

    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }
    const data = await response.json();

    const normalized = {
      current: {
        temperature_2m: Math.round(data.current.temperature_2m),
        relative_humidity_2m: Math.round(data.current.relative_humidity_2m),
        weather_code: data.current.weather_code,
        wind_speed_10m: Math.round(data.current.wind_speed_10m),
        surface_pressure: Math.round(data.current.surface_pressure),
        visibility: 16090,
      },
      timezone: data.timezone,
      hourly: {
        temperature_2m: data.hourly.temperature_2m.slice(0, 24).map(Math.round),
        relative_humidity_2m: data.hourly.relative_humidity_2m.slice(0, 24).map(Math.round),
        weather_code: data.hourly.weather_code.slice(0, 24),
      },
      daily: {
        weather_code: data.daily.weather_code,
        temperature_2m_max: data.daily.temperature_2m_max.map(Math.round),
        relative_humidity_2m_max: data.daily.relative_humidity_2m_max.map((h) => Math.round(h || 0)),
        uv_index_max: data.daily.uv_index_max.map((uv) => Math.round(uv || 0)),
        sunrise: data.daily.sunrise.map((s) => s.split('T')[1].substring(0, 5)),
        sunset: data.daily.sunset.map((s) => s.split('T')[1].substring(0, 5)),
      },
    };

    return res.json(normalized);
  } catch (err) {
    console.error('Open-Meteo Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve weather data.' });
  }
});

app.listen(port, () => {
  console.log(`Server running securely on http://localhost:${port}`);
});