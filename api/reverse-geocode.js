export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Missing latitude or longitude' });

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'MetraWeatherApp/1.0 (student-project)' }
        });

        if (!response.ok) {
            throw new Error(`Reverse geocode HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data || !data.address) {
            return res.status(404).json({ error: 'Location not found' });
        }

        return res.status(200).json({
            name: data.name || data.display_name || 'Current location',
            country: data.address.country || '',
            timezone: 'UTC'
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
