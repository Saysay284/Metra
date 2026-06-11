const language = document.getElementById("languageSelect");
const theme = document.getElementById("themeToggle");
const search = document.getElementById("searchBar");
const currentLoc = document.getElementById("currentLocStats");
const currentWeatherIcon = document.getElementById("weatherIcon");

// Hourly arrays (Matches your 7 HTML slots)
const hrlyWeatherIcon = document.getElementsByClassName("hourlyWeatherIcon");
const hrlyTemp = document.getElementsByClassName("hourlyTempF");
const hrlyHumidity = document.getElementsByClassName("hourlyHumidity");

// Weekly arrays (Matches your 8 HTML slots safely now)
const wklyWeatherIcon = document.getElementsByClassName("weeklyWeatherIcon");
const wklyTemp = document.getElementsByClassName("weeklyTempF");
const wklyHumidity = document.getElementsByClassName("weeklyHumidity");
const wklyWeatherCondition = document.getElementsByClassName("weeklyCondition");

const map = document.getElementById("map");
const radar = document.getElementById("radar");
const sunrise = document.getElementById("sunrise");
const sunset = document.getElementById("sunset");
const uvIndex = document.getElementById("uvIndex");
const airQuality = document.getElementById("airQuality");
const visibility = document.getElementById("visibility");
const pressure = document.getElementById("pressure");

const savedLocationsList = document.getElementById("savedLocationsList");
const savedLocation = document.getElementById("savedLocation");
const saved_TempF = document.getElementById("savedTempF");
const saved_TempC = document.getElementById("savedTempC");
const saved_Condition = document.getElementById("savedCondition");
const saved_Humidity = document.getElementById("savedHumidity");
const saved_WindSpeed = document.getElementById("savedWindSpeed");

const locationInput = document.getElementById("locationInput");

// ─── Theme Toggle ────────────────────────────────────────────────────────────
theme.addEventListener("click", () => {
    document.documentElement.dataset.theme =
        document.documentElement.dataset.theme === "light" ? "dark" : "light";
});

// ─── Weather Code → Emoji Icon ───────────────────────────────────────────────
function weatherIcon(code, localHour = new Date().getHours()) {
    const isNight = localHour < 6 || localHour >= 19;
    if (code === 0) return isNight ? "🌙" : "☀️";
    if (code >= 1 && code <= 3) return isNight ? "☁️" : "⛅";
    if (code >= 45 && code <= 48) return "🌫️";
    if (code >= 51 && code <= 55) return "🌦️";
    if (code >= 61 && code <= 65) return "🌧️";
    if (code >= 71 && code <= 77) return "❄️";
    if (code >= 80 && code <= 82) return "🌨️";
    if (code >= 95 && code <= 99) return "⛈️";
    return "🌡️";
}

// ─── Weather Code → Text ─────────────────────────────────────────────────────
function interpretWeatherCode(code) {
    if (code === 0) return "Clear Sky";
    if (code >= 1 && code <= 3) return "Partly Cloudy";
    if (code >= 45 && code <= 48) return "Foggy";
    if (code >= 51 && code <= 55) return "Drizzle";
    if (code >= 61 && code <= 65) return "Rainy";
    if (code >= 71 && code <= 77) return "Snowy";
    if (code >= 80 && code <= 82) return "Rain Showers";
    if (code >= 95 && code <= 99) return "Thunderstorm";
    return "Variable Conditions";
}

// ─── AI Briefing ─────────────────────────────────────────────────────────────
async function fetchMetraAIBriefing() {
    const aiSummaryElement = document.getElementById('aiSummary');
    if (!aiSummaryElement) return;

    const city = document.getElementById('location').innerText;
    const tempC = document.getElementById('TempC').innerText;
    const condition = document.getElementById('condition').innerText;
    const humidity = document.getElementById('humidity').innerText;
    const selectedLanguage = language.value;

    if (!city || city === "") return;
    aiSummaryElement.innerText = "Consulting Metra AI Buddy... (this may take a moment)";

    try {
        const response = await fetch('http://localhost:3000/api/ai-briefing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, tempC, tempF: document.getElementById('TempF').innerText, condition, humidity, language: selectedLanguage, timezone: window.currentTimezone || 'UTC' })
        });
        const data = await response.json();
        aiSummaryElement.innerText = data.summary ?? data.error ?? "Unable to load briefing.";
    } catch (error) {
        console.error("AI Error:", error);
        aiSummaryElement.innerText = "AI assistant is temporarily unavailable.";
    }
}

language.addEventListener("change", fetchMetraAIBriefing);

// ─── Core: Fetch Weather by City Name ────────────────────────────────────────
// FIX: Extracted into a standalone async function so saved locations
//      can call it directly instead of faking a keyboard event.
async function fetchWeatherByCity(citySearched) {
    if (!citySearched) return;

    try {
        // Step 1: Geocode
        const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(citySearched)}&count=1&language=en&format=json`;
        const geoResponse = await fetch(`http://localhost:3000/api/geocode?name=${encodeURIComponent(citySearched)}`);
        if (!geoResponse.ok) throw new Error(`Geocode HTTP ${geoResponse.status}`);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            alert("Location not found.");
            return;
        }

        const { latitude, longitude, name, country, timezone } = geoData.results[0];

        // Store timezone globally after geocoding so AI can access it
        window.currentTimezone = timezone;

        // Step 2: Fetch weather
        // FIX: Added &forecast_days=7 — Open-Meteo requires this for a reliable daily array
        const weatherUrl = `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${latitude}&longitude=${longitude}` +
            `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,visibility` +
            `&hourly=temperature_2m,relative_humidity_2m,weather_code` +
            `&daily=weather_code,temperature_2m_max,relative_humidity_2m_max,uv_index_max,sunrise,sunset` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`;

        // Weather call — add &city= parameter:
        const weatherResponse = await fetch(`http://localhost:3000/api/weather?lat=${latitude}&lon=${longitude}&city=${encodeURIComponent(name)}`);
        if (!weatherResponse.ok) throw new Error(`Weather HTTP ${weatherResponse.status}`);
        const weatherData = await weatherResponse.json();


        // ── Current Conditions ──
        document.getElementById('location').innerText = `${name}, ${country}`;
        const conditionText = interpretWeatherCode(weatherData.current.weather_code);
        document.getElementById('condition').innerText = conditionText;

        // Calculate localHour FIRST before using it
        const localHour = parseInt(new Date().toLocaleString('en-US', {
            hour: 'numeric', hour12: false, timeZone: timezone
        }));

        if (currentWeatherIcon) {
            currentWeatherIcon.innerText = weatherIcon(weatherData.current.weather_code, localHour);
        }

        const tempF = Math.round(weatherData.current.temperature_2m);
        const tempC = Math.round((tempF - 32) * 5 / 9);
        document.getElementById('TempF').innerText = tempF;
        document.getElementById('TempC').innerText = tempC;
        document.getElementById('humidity').innerText = weatherData.current.relative_humidity_2m;
        document.getElementById('windSpeed').innerText = weatherData.current.wind_speed_10m;
        document.getElementById('time').innerText = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone  // e.g. "America/New_York"
        });

        // ── Advanced Modules ──
        document.getElementById('uvIndex').innerText = weatherData.daily.uv_index_max[0];
        document.getElementById('pressure').innerText = Math.round(weatherData.current.surface_pressure);
        document.getElementById('visibility').innerText =
            (weatherData.current.visibility / 1609).toFixed(1);

        const formatTime = (isoArray) => {
            if (!isoArray || !isoArray[0]) return "N/A";
            // Handle both "06:00 AM" (wttr.in) and "2024-01-01T06:00" (open-meteo)
            if (isoArray[0].includes("T")) {
                const timePart = isoArray[0].split("T")[1];
                return timePart ? timePart.substring(0, 5) : "N/A";
            }
            return isoArray[0]; // already formatted
        };

        document.getElementById('sunrise').innerText = formatTime(weatherData.daily.sunrise);
        document.getElementById('sunset').innerText = formatTime(weatherData.daily.sunset);
        document.getElementById('airQuality').innerText = "Good";

        map.innerHTML = `<iframe
    width="100%" height="100%" frameborder="0" scrolling="no"
    style="border-radius:16px; min-height:220px;"
    src="https://www.openstreetmap.org/export/embed.html?bbox=${(longitude - 0.1).toFixed(4)},${(latitude - 0.1).toFixed(4)},${(longitude + 0.1).toFixed(4)},${(latitude + 0.1).toFixed(4)}&layer=mapnik&marker=${latitude.toFixed(4)},${longitude.toFixed(4)}">
    </iframe>`;

        radar.innerHTML = `<iframe
        width="100%" height="100%" frameborder="0"
        style="border-radius:16px; min-height:220px;"
        src="https://embed.windy.com/embed2.html?lat=${latitude.toFixed(2)}&lon=${longitude.toFixed(2)}&zoom=7&level=surface&overlay=rain&metricWind=mph&metricTemp=%C2%B0F">
    </iframe>`;

        // ── Hourly Forecast ──
        // FIX: Now also populates hrlyWeatherIcon slots
        const hourCount = Math.min(
            hrlyTemp.length,
            weatherData.hourly.temperature_2m.length
        );
        for (let i = 0; i < hourCount; i++) {
            hrlyTemp[i].innerText = Math.round(weatherData.hourly.temperature_2m[i]);
            hrlyHumidity[i].innerText = `${weatherData.hourly.relative_humidity_2m[i]}%`;
            if (hrlyWeatherIcon[i]) {
                hrlyWeatherIcon[i].innerText = weatherIcon(weatherData.hourly.weather_code[i], (localHour + i) % 24);
            }
        }

        // ── Weekly Forecast ──
        // FIX: Now also populates wklyWeatherIcon slots
        const dayCount = Math.min(
            wklyTemp.length,
            weatherData.daily.temperature_2m_max.length
        );
        // ── Dynamic Day Labels ──
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayIndex = new Date().getDay();
        const allWeeklyCards = document.querySelectorAll('.weeklyData');

        allWeeklyCards.forEach((card, i) => {
            const dayLabel = card.querySelector('p:first-child');
            if (i === 0) {
                dayLabel.innerText = 'Today';
            } else {
                dayLabel.innerText = dayNames[(todayIndex + i) % 7];
            }
        });
        for (let i = 0; i < dayCount; i++) {
            wklyTemp[i].innerText = Math.round(weatherData.daily.temperature_2m_max[i]);
            wklyHumidity[i].innerText = `${weatherData.daily.relative_humidity_2m_max[i]}%`;
            wklyWeatherCondition[i].innerText = interpretWeatherCode(weatherData.daily.weather_code[i]);
            if (wklyWeatherIcon[i]) {
                wklyWeatherIcon[i].innerText = weatherIcon(weatherData.daily.weather_code[i], 12);
            }
        }

        fetchMetraAIBriefing();

    } catch (error) {
        console.error("Error capturing conditions:", error);
    }
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
locationInput.addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
        const citySearched = locationInput.value.trim();
        await fetchWeatherByCity(citySearched);
    }
});

// ─── Save Location ────────────────────────────────────────────────────────────
const saveLocButton = document.getElementById("saveLoc");

saveLocButton.addEventListener("click", () => {
    const currentLocationName = document.getElementById('location').innerText;
    if (!currentLocationName) return;

    let savedCities = JSON.parse(localStorage.getItem("metraSavedCities")) || [];
    if (savedCities.some(c => c.name === currentLocationName)) return;

    const snapshot = {
        name: currentLocationName,
        tempF: document.getElementById('TempF').innerText,
        tempC: document.getElementById('TempC').innerText,
        condition: document.getElementById('condition').innerText,
        humidity: document.getElementById('humidity').innerText,
        windSpeed: document.getElementById('windSpeed').innerText
    };

    savedCities.push(snapshot);
    localStorage.setItem("metraSavedCities", JSON.stringify(savedCities));
    displaySavedLocations();
});

// ─── Display Saved Locations ──────────────────────────────────────────────────
function displaySavedLocations() {
    if (!savedLocationsList) return;
    savedLocationsList.innerHTML = "";
    const savedCities = JSON.parse(localStorage.getItem("metraSavedCities")) || [];

    savedCities.forEach(cityObj => {
        const li = document.createElement("li");
        li.style.cursor = "pointer";
        li.innerText = cityObj.name;

        li.addEventListener("click", () => {
            // Show the cached snapshot immediately
            if (savedLocation) savedLocation.innerText = cityObj.name;
            if (saved_TempF) saved_TempF.innerText = cityObj.tempF;
            if (saved_TempC) saved_TempC.innerText = cityObj.tempC;
            if (saved_Condition) saved_Condition.innerText = cityObj.condition;
            if (saved_Humidity) saved_Humidity.innerText = cityObj.humidity;
            if (saved_WindSpeed) saved_WindSpeed.innerText = cityObj.windSpeed;

            // FIX: Call fetchWeatherByCity directly instead of faking a keypress event
            // Faking keypress events does NOT reliably trigger async addEventListener handlers
            locationInput.value = cityObj.name;
            fetchWeatherByCity(cityObj.name);
        });

        savedLocationsList.appendChild(li);
    });
}

document.addEventListener("DOMContentLoaded", displaySavedLocations);