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
// ── Weather via Open-Meteo (primary) ───────────────────────────────────────
app.get('/api/weather', async (req, res) => {
    const { lat, lon } = req.query; // 'city' is no longer needed for direct weather lookup

    if (!lat || !lon) {
        return res.status(400).json({ error: 'Missing latitude or longitude for weather data.' });
    }

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure` +
            `&hourly=temperature_2m,relative_humidity_2m,weather_code` +
            `&daily=weather_code,temperature_2m_max,relative_humidity_2m_max,uv_index_max,sunrise,sunset` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=3&timezone=auto`;

        console.log('Fetching weather from Open-Meteo:', url);

        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) {
            throw new Error(`Open-Meteo HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        // Normalize Open-Meteo response to match the expected frontend structure
        const normalized = {
            current: {
                temperature_2m: Math.round(data.current.temperature_2m),
                relative_humidity_2m: Math.round(data.current.relative_humidity_2m),
                weather_code: data.current.weather_code, // WMO code
                wind_speed_10m: Math.round(data.current.wind_speed_10m),
                surface_pressure: Math.round(data.current.surface_pressure),
                visibility: 16090 // Open-Meteo doesn't provide visibility easily, default to a common value
            },
            timezone: data.timezone,
            hourly: {
                temperature_2m: data.hourly.temperature_2m.slice(0, 24).map(Math.round),
                relative_humidity_2m: data.hourly.relative_humidity_2m.slice(0, 24).map(Math.round),
                weather_code: data.hourly.weather_code.slice(0, 24) // WMO codes
            },
            daily: {
                weather_code: data.daily.weather_code, // WMO codes for 3 days
                temperature_2m_max: data.daily.temperature_2m_max.map(Math.round),
                relative_humidity_2m_max: data.daily.relative_humidity_2m_max.map(h => Math.round(h || 0)),
                uv_index_max: data.daily.uv_index_max.map(uv => Math.round(uv || 0)),
                sunrise: data.daily.sunrise.map(s => s.split('T')[1].substring(0, 5)), // Extract HH:MM
                sunset: data.daily.sunset.map(s => s.split('T')[1].substring(0, 5))   // Extract HH:MM
            }
        };

        return res.json(normalized);

    } catch (err) {
        console.error('Open-Meteo weather API failed:', err.message);
        return res.status(500).json({ error: `Failed to retrieve weather data: ${err.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
