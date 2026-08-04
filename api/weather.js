export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { lat, lon, city } = req.query;
    if (!city && (!lat || !lon)) {
        return res.status(400).json({ error: 'Missing params' });
    }

    try {
        const wttrTarget = city || `${lat},${lon}`;
        const url = `https://wttr.in/${encodeURIComponent(wttrTarget)}?format=j1`;
        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error(`wttr.in HTTP ${response.status}`);
        const data = await response.json();

        const current = data.current_condition?.[0];
        if (!current) throw new Error('Invalid wttr.in response');

        const wttrCode = parseInt(current.weatherCode, 10);
        const weatherCode = mapWttrCode(wttrCode);
        const daily = data.weather || [];

        const normalized = {
            current: {
                temperature_2m: parseFloat(current.temp_F),
                relative_humidity_2m: parseInt(current.humidity, 10),
                weather_code: weatherCode,
                wind_speed_10m: parseFloat(current.windspeedMiles),
                surface_pressure: parseFloat(current.pressure),
                visibility: parseFloat(current.visibility) * 1609
            },
            timezone: data.nearest_area?.[0]?.country?.[0]?.value || 'UTC',
            hourly: buildHourly(daily),
            daily: {
                weather_code: daily.map(d => mapWttrCode(parseInt(d.hourly?.[4]?.weatherCode || 0, 10))),
                temperature_2m_max: daily.map(d => parseFloat(d.maxtempF)),
                relative_humidity_2m_max: daily.map(d => Math.max(...(d.hourly || []).map(h => parseInt(h.humidity, 10)) ?? [0])),
                uv_index_max: daily.map(d => parseFloat(d.uvIndex)),
                sunrise: daily.map(d => d.astronomy?.[0]?.sunrise || 'N/A'),
                sunset: daily.map(d => d.astronomy?.[0]?.sunset || 'N/A')
            }
        };

        return res.status(200).json(normalized);
    } catch (err) {
        console.warn('wttr.in failed:', err.message);
    }

    // Fallback to met.no when wttr.in does not work
    try {
        if (!lat || !lon) {
            return res.status(500).json({ error: 'wttr.in failed and no lat/lon for fallback' });
        }

        const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
        const response = await fetch(url, {
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': 'MetraWeatherApp/1.0 (student-project)' }
        });
        if (!response.ok) throw new Error(`met.no HTTP ${response.status}`);
        const data = await response.json();

        const timeseries = data.properties?.timeseries || [];
        const current = timeseries?.[0]?.data?.instant?.details;
        if (!current) throw new Error('Invalid met.no response');

        const tempC = current.air_temperature;
        const tempF = (tempC * 9 / 5) + 32;

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
                temperature_2m: timeseries.slice(0, 24).map(t => Math.round((t.data.instant.details.air_temperature * 9 / 5) + 32)),
                relative_humidity_2m: timeseries.slice(0, 24).map(t => Math.round(t.data.instant.details.relative_humidity)),
                weather_code: new Array(24).fill(0)
            },
            daily: {
                weather_code: [0, 0, 0],
                temperature_2m_max: [Math.round(tempF), Math.round(tempF), Math.round(tempF)],
                relative_humidity_2m_max: [Math.round(current.relative_humidity), Math.round(current.relative_humidity), Math.round(current.relative_humidity)],
                uv_index_max: [0, 0, 0],
                sunrise: ['06:00', '06:00', '06:00'],
                sunset: ['18:00', '18:00', '18:00']
            }
        };

        return res.status(200).json(normalized);
    } catch (err) {
        return res.status(500).json({ error: 'All weather sources failed.' });
    }
}

function mapWttrCode(code) {
    if (code === 113) return 0;
    if ([116, 119, 122].includes(code)) return 2;
    if ([143, 248, 260].includes(code)) return 45;
    if ([263, 266, 281, 284, 293, 296].includes(code)) return 51;
    if ([299, 302, 305, 308, 353, 356].includes(code)) return 61;
    if ([179, 182, 185, 227, 230, 323, 326, 329, 332, 335, 338, 350, 371, 374, 377].includes(code)) return 71;
    if ([389, 392, 395].includes(code)) return 95;
    return 2;
}

function buildHourly(daily) {
    const temps = [];
    const humidity = [];
    const codes = [];
    for (const day of daily) {
        for (const hour of day.hourly || []) {
            temps.push(parseFloat(hour.tempF || 0));
            humidity.push(parseInt(hour.humidity || '0', 10));
            codes.push(mapWttrCode(parseInt(hour.weatherCode || '0', 10)));
        }
    }
    return {
        temperature_2m: temps,
        relative_humidity_2m: humidity,
        weather_code: codes
    };
}
