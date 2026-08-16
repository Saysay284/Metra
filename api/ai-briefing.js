import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // 1. CORS Setup - Restrict origin in production
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'; // Set ALLOWED_ORIGIN in Vercel env (e.g., https://your-app.vercel.app)
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ Missing GEMINI_API_KEY environment variable');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // 2. Validate & Sanitize Incoming Payload
    const { city, tempC, tempF, condition, humidity, language, timezone } = req.body || {};

    const cleanCity = typeof city === 'string' ? city.trim().slice(0, 100) : 'Unknown Location';
    const cleanCondition = typeof condition === 'string' ? condition.trim().slice(0, 50) : 'Clear';
    const cleanLanguage = typeof language === 'string' ? language.trim().slice(0, 30) : 'English';
    const cleanTimezone = typeof timezone === 'string' ? timezone.trim() : 'UTC';

    const ai = new GoogleGenAI({ apiKey });

    // 3. Timezone Fallback Guard
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

    return res.status(200).json({ summary: response.text });
  } catch (error) {
    console.error(' Vercel Function Execution Error:', error);
    // Generic error message to prevent leaking stack traces
    return res.status(500).json({ error: 'Failed to generate weather briefing.' });
  }
}