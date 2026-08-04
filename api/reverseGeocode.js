export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat or lon' });

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const timeZoneUrl = `https://timeapi.io/api/Time/current/coordinate?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;

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

    if (!locationResponse.ok) throw new Error('Reverse geocode failed');
    if (!timeResponse.ok) throw new Error('Timezone lookup failed');

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

    res.status(200).json({ city, timezone });
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    res.status(500).json({ error: err.message });
  }
}