// DOM Elements
const language = document.getElementById("languageSelect");
const theme = document.getElementById("themeToggle");
const currentWeatherIcon = document.getElementById("weatherIcon");

// Landing Page
const landingPage = document.getElementById("landingPage");
const mainApp = document.getElementById("mainApp");
const useMyLocationBtn = document.getElementById("useMyLocation");
const searchManuallyBtn = document.getElementById("searchManually");
const useLocationBtn = document.getElementById("useLocationBtn");

// Weather Elements
const hrlyWeatherIcon = document.getElementsByClassName("hourlyWeatherIcon");
const hrlyTemp = document.getElementsByClassName("hourlyTempF");
const hrlyHumidity = document.getElementsByClassName("hourlyHumidity");

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

// === SHOW/HIDE APP ===
function showMainApp() {
    landingPage.classList.add("hidden");
    setTimeout(() => {
        landingPage.style.display = "none";
        mainApp.style.display = "block";
        mainApp.classList.add("visible");
    }, 600);
}

// === GEOLOCATION - NEW FEATURE ===
function getDeviceLocation() {
    if (!navigator.geolocation) {
        console.error("Geolocation not supported");
        showMainApp();
        return;
    }

    // Update input only if it exists
    if (locationInput) {
        locationInput.value = "Detecting location...";
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            console.log("Location detected:", latitude, longitude);
            await fetchWeatherByCoordinates(latitude, longitude);
            showMainApp();
        },
        (error) => {
            console.error("Geolocation error:", error);
            if (error.code === error.PERMISSION_DENIED) {
                console.warn("Location permission denied by user");
            }
            if (locationInput) {
                locationInput.value = "";
            }
            showMainApp();
        },
        { timeout: 10000, enableHighAccuracy: false }
    );
}
async function fetchWeatherByCoordinates(latitude, longitude) {
    try {
        // Reverse geocode to get city name
        const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        const cityName = geoData.address?.city || geoData.address?.town || "Your Location";

        // Fetch weather
        const weatherUrl = `http://localhost:3000/api/weather?lat=${latitude}&lon=${longitude}&city=${encodeURIComponent(cityName)}`;
        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) throw new Error("Weather API failed");

        const weatherData = await weatherResponse.json();
        updateWeatherDisplay(weatherData, cityName, "UTC");
        fetchMetraAIBriefing();

    } catch (error) {
        console.error("Error:", error);
    }
}

// === UPDATE WEATHER DISPLAY ===
function updateWeatherDisplay(weatherData, cityName, timezone) {
    document.getElementById('location').innerText = cityName;

    const conditionText = interpretWeatherCode(weatherData.current.weather_code);
    document.getElementById('condition').innerText = conditionText;

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
        timeZone: timezone
    });

    document.getElementById('uvIndex').innerText = weatherData.daily.uv_index_max[0];
    document.getElementById('pressure').innerText = Math.round(weatherData.current.surface_pressure);
    document.getElementById('visibility').innerText = (weatherData.current.visibility / 1609).toFixed(1);

    const formatTime = (isoArray) => {
        if (!isoArray || !isoArray[0]) return "N/A";
        if (isoArray[0].includes("T")) {
            const timePart = isoArray[0].split("T")[1];
            return timePart ? timePart.substring(0, 5) : "N/A";
        }
        return isoArray[0];
    };

    document.getElementById('sunrise').innerText = formatTime(weatherData.daily.sunrise);
    document.getElementById('sunset').innerText = formatTime(weatherData.daily.sunset);
    document.getElementById('airQuality').innerText = "Good";

    // Hourly
    const hourCount = Math.min(hrlyTemp.length, weatherData.hourly.temperature_2m.length);
    for (let i = 0; i < hourCount; i++) {
        hrlyTemp[i].innerText = Math.round(weatherData.hourly.temperature_2m[i]);
        hrlyHumidity[i].innerText = `${weatherData.hourly.relative_humidity_2m[i]}%`;
        if (hrlyWeatherIcon[i]) {
            hrlyWeatherIcon[i].innerText = weatherIcon(weatherData.hourly.weather_code[i], (localHour + i) % 24);
        }
    }

    // Weekly
    const dayCount = Math.min(wklyTemp.length, weatherData.daily.temperature_2m_max.length);
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

    window.currentTimezone = timezone;
    fetchMetraAIBriefing();
}

// === THEME TOGGLE ===
theme.addEventListener("click", () => {
    document.documentElement.dataset.theme =
        document.documentElement.dataset.theme === "light" ? "dark" : "light";
});

// === WEATHER CODE TO EMOJI ===
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

// === WEATHER CODE TO TEXT ===
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

// === AI BRIEFING ===
async function fetchMetraAIBriefing() {
    const aiSummaryElement = document.getElementById('aiSummary');
    if (!aiSummaryElement) return;

    const city = document.getElementById('location').innerText;
    const tempC = document.getElementById('TempC').innerText;
    const condition = document.getElementById('condition').innerText;
    const humidity = document.getElementById('humidity').innerText;
    const selectedLanguage = language.value;

    if (!city || city === "-") return;

    aiSummaryElement.innerText = "🤖 Consulting AI...";

    try {
        const response = await fetch('http://localhost:3000/api/ai-briefing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                city, tempC,
                tempF: document.getElementById('TempF').innerText,
                condition, humidity,
                language: selectedLanguage,
                timezone: window.currentTimezone || 'UTC'
            })
        });
        const data = await response.json();
        aiSummaryElement.innerText = data.summary || "Unable to load briefing.";
    } catch (error) {
        console.error("AI Error:", error);
        aiSummaryElement.innerText = "AI assistant unavailable.";
    }
}

language.addEventListener("change", fetchMetraAIBriefing);

// === FETCH WEATHER BY CITY ===
async function fetchWeatherByCity(citySearched) {
    if (!citySearched) return;

    try {
        const geoResponse = await fetch(`http://localhost:3000/api/geocode?name=${encodeURIComponent(citySearched)}`);
        if (!geoResponse.ok) throw new Error("Geocode failed");
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            alert("Location not found.");
            return;
        }

        const { latitude, longitude, name, country, timezone } = geoData.results[0];
        window.currentTimezone = timezone;

        const weatherResponse = await fetch(`http://localhost:3000/api/weather?lat=${latitude}&lon=${longitude}&city=${encodeURIComponent(name)}`);
        if (!weatherResponse.ok) throw new Error("Weather failed");
        const weatherData = await weatherResponse.json();

        updateWeatherDisplay(weatherData, `${name}, ${country}`, timezone);
        fetchMetraAIBriefing();

    } catch (error) {
        console.error("Error:", error);
    }
}

// === SEARCH ===
locationInput.addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
        const citySearched = locationInput.value.trim();
        await fetchWeatherByCity(citySearched);
    }
});

// === SAVE LOCATION ===
const saveLocButton = document.getElementById("saveLoc");

saveLocButton.addEventListener("click", () => {
    const currentLocationName = document.getElementById('location').innerText;
    if (!currentLocationName || currentLocationName === "-") return;

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

// === DISPLAY SAVED ===
function displaySavedLocations() {
    if (!savedLocationsList) return;
    savedLocationsList.innerHTML = "";
    const savedCities = JSON.parse(localStorage.getItem("metraSavedCities")) || [];

    savedCities.forEach(cityObj => {
        const li = document.createElement("li");
        li.innerText = cityObj.name;
        li.addEventListener("click", () => {
            if (savedLocation) savedLocation.innerText = cityObj.name;
            if (saved_TempF) saved_TempF.innerText = cityObj.tempF;
            if (saved_TempC) saved_TempC.innerText = cityObj.tempC;
            if (saved_Condition) saved_Condition.innerText = cityObj.condition;
            if (saved_Humidity) saved_Humidity.innerText = cityObj.humidity;
            if (saved_WindSpeed) saved_WindSpeed.innerText = cityObj.windSpeed;

            locationInput.value = cityObj.name;
            fetchWeatherByCity(cityObj.name);
        });
        savedLocationsList.appendChild(li);
    });
}

document.addEventListener("DOMContentLoaded", displaySavedLocations);

// === LANDING PAGE BUTTONS ===
useMyLocationBtn.addEventListener("click", getDeviceLocation);
searchManuallyBtn.addEventListener("click", () => {
    showMainApp();
    setTimeout(() => {
        locationInput.focus();
    }, 100);
});

useLocationBtn.addEventListener("click", getDeviceLocation);
