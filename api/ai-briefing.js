import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on Vercel.' });
    }

    const { city, tempC, tempF, condition, humidity, language, timezone } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });

    const localHour = parseInt(
      new Date().toLocaleString('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone || 'UTC',
      }),
      10
    );

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
      - Location: ${city || 'Unknown Location'}
      - Time of day: ${timeOfDay}
      - Temperature: ${tempC ?? '--'}°C / ${tempF ?? '--'}°F
      - Condition: ${condition || 'Clear'}
      - Humidity: ${humidity ?? '--'}%

      Task: Provide a highly engaging, friendly 2-sentence weather summary 
      that is appropriate for the current time of day (${timeOfDay}).
      Include a smart commuting or clothing tip based on this data.
      Do NOT say "good morning/afternoon" — just be natural and time-aware.
      Language Requirement: Respond completely in this language: ${language || 'English'}.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return res.status(200).json({ summary: response.text });
  } catch (error) {
    console.error('❌ Vercel Function Execution Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}