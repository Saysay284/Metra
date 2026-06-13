# Metra
Weather Forecast Web Application

# Metra Weather App

> **Your intelligent weather buddy.** Real-time forecasts, AI-powered briefings, and live maps — all in one clean, responsive dashboard.

---

## Overview

Metra is a full-stack weather web application built with vanilla JavaScript on the frontend and Node.js + Express on the backend. It fetches live weather data for any city in the world and presents it through a polished, dark/light-themed interface — complete with an AI assistant that gives you a personalized weather briefing in your language of choice.

---

## Features

### 🔍 City Search
Search any city worldwide and instantly load its current weather conditions. The app geocodes the city name, retrieves live data, and populates the entire dashboard automatically.

### 🤖 Metra AI Buddy
Powered by Google Gemini, the AI Buddy generates a friendly, time-aware 2-sentence weather summary with commuting and clothing tips tailored to the current conditions. The briefing automatically updates when you change the language or search a new city.

### 🌐 Multilingual Support
The AI Buddy responds in the language selected from the dropdown — including English, Spanish, French, German, Chinese, Japanese, Russian, Arabic, Hindi, Portuguese, Italian, and Korean.

### 🌡️ Current Conditions
- Temperature in both **°C and °F**
- Weather condition with time-aware emoji icons (🌙 at night, ☀️ during the day)
- Humidity (%)
- Wind speed (mph)
- Atmospheric pressure (mb)
- Visibility (miles)

### ⏱️ Hourly Forecast
A 24-hour rolling hourly forecast showing temperature, humidity, and weather icons for each time slot.

### 📅  3-Day Weather Forecast
A day-by-day forecast showing max temperature, humidity percentage, weather condition, and icons. Day labels are dynamically generated based on the actual current date — no hardcoded day names.

### 🗺️ Live Map & Radar
- **Map** — an embedded OpenStreetMap view centered on the searched city with a location pin.
- **Radar** — a live Windy.com rain radar embed showing precipitation patterns around the city.

### 🌅 Weather Details Panel
- Sunrise and sunset times (local to the searched city)
- UV Index
- Air quality indicator
- Atmospheric pressure
- Visibility distance

### 🕐 Location-Accurate Time
The current time displayed reflects the **local time of the searched city**, not the user's machine time — so searching New York from the Philippines shows New York's actual time.

### 📌 Saved Locations
Save any searched city to a persistent list. Clicking a saved city instantly reloads its weather data. Saved locations are stored in `localStorage` and persist across sessions.

### 🌓 Dark / Light Theme Toggle
Switch between a deep navy dark theme and a clean light theme at any time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express |
| AI | Google Gemini API (`@google/generative-ai`) |
| Weather Data | wttr.in (primary), met.no (fallback) |
| Geocoding | Open-Meteo Geocoding API |
| Map | OpenStreetMap (embed) |
| Radar | Windy.com (embed) |

---

## Getting Started

### Prerequisites
- Node.js v18 or higher
- A Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/metra-weather-app.git
cd metra-weather-app

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

### Running the App

```bash
# Start the backend server
node server.js
```

Then open `index.html` in your browser via a local server (e.g. VS Code Live Server on port 5500).

The backend runs on `http://localhost:3000` and proxies all weather and AI requests.

---

## Screenshots
<img width="1281" height="489" alt="Screenshot 2026-06-13 171118" src="https://github.com/user-attachments/assets/c64c6e79-3a15-4e5c-bc17-aa8c26642adc" />
<img width="1278" height="481" alt="Screenshot 2026-06-13 171104" src="https://github.com/user-attachments/assets/5ddaf65a-cb49-4fcc-8c7a-689d71f3eb5f" />
<img width="1230" height="480" alt="Screenshot 2026-06-13 171048" src="https://github.com/user-attachments/assets/21fd7ae7-245d-4a97-830f-bea5d7a083b0" />
<img width="1268" height="485" alt="Screenshot 2026-06-13 171027" src="https://github.com/user-attachments/assets/6a194cb2-efd3-473d-b140-fe0b6bfa061b" />


---

## License

This project is open source and available under the [MIT License](LICENSE).
