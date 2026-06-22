import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini client
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── AI Briefing ──────────────────────────────────────────────────────────────
app.post('/api/ai-briefing', async (req, res) => {
    try {
        const { city, tempC, tempF, condition, humidity, language, timezone } = req.body;
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Get current hour to give Gemini time-of-day context
        //const hour = new Date().getHours();
        const localHour = parseInt(new Date().toLocaleString('en-US', {
            hour: 'numeric', hour12: false, timeZone: timezone || 'UTC'
        }));

        const timeOfDay = localHour >= 5 && localHour < 12 ? 'morning'
            : localHour >= 12 && localHour < 17 ? 'afternoon'
                : localHour >= 17 && localHour < 21 ? 'evening'
                    : 'night';

        let result;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                result = await model.generateContent(`
                    Context: The user is looking at a weather app called Metra.
                    Current Weather Data:
                    - Location: ${city}
                    - Time of day: ${timeOfDay}
                    - Temperature: ${tempC}°C / ${tempF}°F
                    - Condition: ${condition}
                    - Humidity: ${humidity}%

                    Task: Provide a highly engaging, friendly 2-sentence weather summary 
                    that is appropriate for the current time of day (${timeOfDay}).
                    Include a smart commuting or clothing tip based on this data.
                    Do NOT say "good morning/afternoon" — just be natural and time-aware.
                    Language Requirement: Respond completely in this language: ${language}.
                `);
                break;
            } catch (err) {
                if (attempt === 3 || err.status !== 503) throw err;
                console.log(`Gemini attempt ${attempt} failed (503), retrying...`);
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }

        const summary = result.response.text();
        res.json({ summary });

    } catch (error) {
        console.error('Error generating AI briefing:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// ── Geocoding Proxy (this one still works fine) ──────────────────────────────
app.get('/api/geocode', async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Missing name' });

    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Weather via wttr.in (primary) + met.no (fallback) ───────────────────────
app.get('/api/weather', async (req, res) => {
    const { lat, lon, city } = req.query;
    if (!city && (!lat || !lon)) return res.status(400).json({ error: 'Missing params' });

    // ── Try wttr.in first ────────────────────────────────────────────────────
    try {
        const wttrTarget = city || `${lat},${lon}`;
        const url = `https://wttr.in/${encodeURIComponent(wttrTarget)}?format=j1`;
        console.log('Trying wttr.in:', url);

        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error(`wttr.in HTTP ${response.status}`);
        const data = await response.json();

        const current = data.current_condition[0];

        // Map wttr.in weather code to Open-Meteo-style code your frontend uses
        const wttrCode = parseInt(current.weatherCode);
        const weatherCode = mapWttrCode(wttrCode);

        // Build daily arrays from wttr.in's 3-day weather array
        const daily = data.weather; // array of 3 days

        const normalized = {
            current: {
                temperature_2m: parseFloat(current.temp_F),
                relative_humidity_2m: parseInt(current.humidity),
                weather_code: weatherCode,
                wind_speed_10m: parseFloat(current.windspeedMiles),
                surface_pressure: parseFloat(current.pressure),
                visibility: parseFloat(current.visibility) * 1609
            },
            timezone: data.nearest_area?.[0]?.country?.[0]?.value || 'UTC',
            hourly: buildHourly(daily),
            daily: {
                weather_code: daily.map(d => mapWttrCode(parseInt(d.hourly[4]?.weatherCode || 0))),
                temperature_2m_max: daily.map(d => parseFloat(d.maxtempF)),
                relative_humidity_2m_max: daily.map(d =>
                    Math.max(...d.hourly.map(h => parseInt(h.humidity)))
                ),
                uv_index_max: daily.map(d => parseFloat(d.uvIndex)),
                sunrise: daily.map(d => d.astronomy[0].sunrise),
                sunset: daily.map(d => d.astronomy[0].sunset)
            }
        };

        return res.json(normalized);

    } catch (err) {
        console.warn('wttr.in failed:', err.message);
    }

    // ── Fallback: met.no ─────────────────────────────────────────────────────
    try {
        if (!lat || !lon) return res.status(500).json({ error: 'wttr.in failed and no lat/lon for fallback' });

        const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
        console.log('Trying met.no:', url);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': 'MetraWeatherApp/1.0 student-project' } // met.no requires this
        });
        if (!response.ok) throw new Error(`met.no HTTP ${response.status}`);
        const data = await response.json();

        const timeseries = data.properties.timeseries;
        const current = timeseries[0].data.instant.details;
        const tempC = current.air_temperature;
        const tempF = (tempC * 9 / 5) + 32;

        // Build minimal normalized shape from met.no
        const normalized = {
            current: {
                temperature_2m: Math.round(tempF),
                relative_humidity_2m: Math.round(current.relative_humidity),
                weather_code: 0,
                wind_speed_10m: Math.round(current.wind_speed * 0.621),
                surface_pressure: Math.round(current.air_pressure_at_sea_level),
                visibility: 16090
            },
            hourly: {
                temperature_2m: timeseries.slice(0, 24).map(t => {
                    const c = t.data.instant.details.air_temperature;
                    return Math.round((c * 9 / 5) + 32);
                }),
                relative_humidity_2m: timeseries.slice(0, 24).map(t =>
                    Math.round(t.data.instant.details.relative_humidity)
                ),
                weather_code: new Array(24).fill(0)
            },
            daily: {
                weather_code: [0, 0, 0],
                temperature_2m_max: [Math.round(tempF), Math.round(tempF), Math.round(tempF)],
                relative_humidity_2m_max: [Math.round(current.relative_humidity)],
                uv_index_max: [0],
                sunrise: ['06:00', '06:00', '06:00'],
                sunset: ['18:00', '18:00', '18:00']
            }
        };

        return res.json(normalized);

    } catch (err) {
        console.error('met.no failed:', err.message);
        return res.status(500).json({ error: 'All weather sources failed.' });
    }
});

// ── wttr.in weather code → your interpretWeatherCode ranges ─────────────────
function mapWttrCode(code) {
    if (code === 113) return 0;                          // Sunny → Clear Sky
    if ([116, 119, 122].includes(code)) return 2;       // Cloudy → Partly Cloudy
    if ([143, 248, 260].includes(code)) return 45;      // Fog
    if ([263, 266, 281, 284, 293, 296].includes(code)) return 51; // Drizzle
    if ([299, 302, 305, 308, 353, 356].includes(code)) return 61; // Rain
    if ([179, 182, 185, 227, 230, 323, 326, 329, 332, 335, 338, 350, 371, 374, 377].includes(code)) return 71; // Snow
    if ([389, 392, 395].includes(code)) return 95;      // Thunderstorm
    return 2;
}

// ── Build hourly arrays from wttr.in's 3-day × 8-slot structure ─────────────
function buildHourly(daily) {
    const temps = [], humidity = [], codes = [];
    for (const day of daily) {
        for (const hour of day.hourly) {
            temps.push(parseFloat(hour.tempF));
            humidity.push(parseInt(hour.humidity));
            codes.push(mapWttrCode(parseInt(hour.weatherCode)));
        }
    }
    return { temperature_2m: temps, relative_humidity_2m: humidity, weather_code: codes };
}
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});