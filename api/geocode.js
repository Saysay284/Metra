export default async function handler(req, res) {
  const { name, count } = req.query;

  if (!name) {
    return res.status(400).json({ error: "Missing 'name' query parameter" });
  }

  const maxResults = Math.min(Math.max(parseInt(count, 10) || 1, 1), 10);

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=${maxResults}&language=en&format=json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Upstream error: ${response.status}`);
    }

    const data = await response.json();

    clearTimeout(timeoutId);

    res.status(200).json(data);
  } catch (err) {
    console.error("Geocoding error:", err);
    res.status(500).json({ error: err.message });
  }
}
