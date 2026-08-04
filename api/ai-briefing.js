import { GoogleGenerativeAI } from '@google/generative-ai';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { city, tempC, tempF, condition, humidity, language, timezone } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      // Fail soft: frontend can still show weather even without the AI blurb.
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
    }

    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
    res.status(200).json({ summary });
  } catch (error) {
    console.error('Error generating AI briefing:', error.message);
    res.status(500).json({ error: error.message });
  }
}