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
const locationSuggestions = document.getElementById("locationSuggestions");

// Debounce utility function
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// === SHOW/HIDE APP ===
function showMainApp() {
    landingPage.classList.add("hidden");
    setTimeout(() => {
        landingPage.style.display = "none";
        mainApp.style.display = "block";
        mainApp.classList.add("visible");
    }, 600);
}

// === GEOLOCATION ===
function getDeviceLocation() {
    if (!navigator.geolocation) {
        console.error("Geolocation not supported by this browser");
        alert("Your browser doesn't support location detection. Please search manually.");
        showMainApp();
        return;
    }

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
            console.error("Geolocation error:", error.code, error.message);

            let reason = "Unable to detect your location.";
            if (error.code === error.PERMISSION_DENIED) {
                reason = "Location permission was denied. Enable location access for this site in your browser settings, or search manually.";
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                reason = "Location information is unavailable right now.";
            } else if (error.code === error.TIMEOUT) {
                reason = "Location request timed out. Try again or search manually.";
            }
            alert(reason);

            if (locationInput) locationInput.value = "";
            showMainApp();
        },
        {
            timeout: 10000,
            enableHighAccuracy: true,
            maximumAge: 0,
        }
    );
}

async function fetchWeatherByCoordinates(latitude, longitude) {
    try {
        const geoResponse = await fetch(
            `http://localhost:3000/api/reverse-geocode?lat=${latitude}&lon=${longitude}`
        );
        if (!geoResponse.ok) throw new Error("Reverse geocode failed");
        const geoData = await geoResponse.json();

        const cityName = geoData.city || "Your Location";
        const timezone = geoData.timezone || "UTC";
        window.currentTimezone = timezone;
        window.currentCoords = { latitude, longitude };

        const weatherResponse = await fetch(
            `http://localhost:3000/api/weather?lat=${latitude}&lon=${longitude}&city=${encodeURIComponent(
                cityName
            )}`
        );
        if (!weatherResponse.ok) throw new Error("Weather API failed");

        const weatherData = await weatherResponse.json();
        updateWeatherDisplay(weatherData, cityName, timezone);
        renderMapAndRadar(latitude, longitude);
        fetchMetraAIBriefing();
    } catch (error) {
        console.error("Error fetching weather by coordinates:", error);
        alert("Couldn't load weather for your location. Please try searching manually.");
    }
}

// === LOCATION SUGGESTIONS ===
async function fetchLocationSuggestions(query) {
    if (query.length < 3) { // Only fetch for queries with 3 or more characters
        locationSuggestions.innerHTML = '';
        locationSuggestions.classList.remove('active');
        return;
    }
    try {
        const response = await fetch(`/api/geocode?name=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Geocode suggestions failed');
        const data = await response.json();
        displayLocationSuggestions(data.results || []);
    } catch (error) {
        console.error('Error fetching location suggestions:', error);
        locationSuggestions.innerHTML = '';
        locationSuggestions.classList.remove('active');
    }
}

function displayLocationSuggestions(suggestions) {
    locationSuggestions.innerHTML = ''; // Clear previous suggestions
    if (suggestions.length === 0) {
        locationSuggestions.classList.remove('active');
        return;
    }

    const fragment = document.createDocumentFragment();
    suggestions.forEach(place => {
        const li = document.createElement('li');
        li.classList.add('suggestion-item');
        // Display full address if available, otherwise name and country
        const displayName = place.address && place.address.city && place.address.country ? 
                            `${place.address.city}, ${place.address.country}` :
                            `${place.name}, ${place.country}`;
        li.innerText = displayName;
        li.dataset.latitude = place.latitude;
        li.dataset.longitude = place.longitude;
        li.dataset.cityName = place.name; // Keep original city name for weather API call
        li.dataset.countryName = place.country;
        li.dataset.timezone = place.timezone;

        li.addEventListener('click', () => {
            locationInput.value = displayName; // Populate input with selected suggestion
            fetchWeatherByCoordinates(place.latitude, place.longitude, place.name, place.country, place.timezone);
            locationSuggestions.innerHTML = ''; // Clear suggestions
            locationSuggestions.classList.remove('active');
        });
        fragment.appendChild(li);
    });
    locationSuggestions.appendChild(fragment);
    locationSuggestions.classList.add('active'); // Show suggestions container
}

// === MAP & RADAR ===
function renderMapAndRadar(latitude, longitude) {
    if (map) {
        map.innerHTML = `<iframe
        loading="lazy"
        src="https://www.openstreetmap.org/export/embed.html?bbox=${(longitude - 0.15).toFixed(
            4
        )},${(latitude - 0.15).toFixed(4)},${(longitude + 0.15).toFixed(4)},${(
            latitude + 0.15
        ).toFixed(4)}&layer=mapnik&marker=${latitude.toFixed(4)},${longitude.toFixed(4)}"
        style="border:0; width: 100%; height: 100%;"
      ></iframe>`;
    }
    if (radar) {
        radar.innerHTML = `<iframe
        loading="lazy"
        src="https://embed.windy.com/embed2.html?lat=${latitude.toFixed(
            2
        )}&lon=${longitude.toFixed(
            2
        )}&zoom=7&level=surface&overlay=radar&metricWind=mph&metricTemp=%C2%B0F"
        style="border:0; width: 100%; height: 100%;"
      ></iframe>`;
    }
}

// === UPDATE WEATHER DISPLAY ===
function updateWeatherDisplay(weatherData, cityName, timezone) {
    document.getElementById("location").innerText = cityName;

    const conditionText = interpretWeatherCode(weatherData.current.weather_code);
    document.getElementById("condition").innerText = conditionText;

    const localHour = parseInt(
        new Date().toLocaleString("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: timezone,
        })
    );

    if (currentWeatherIcon) {
        currentWeatherIcon.innerHTML = weatherIcon(weatherData.current.weather_code, localHour);
    }

    const tempF = Math.round(weatherData.current.temperature_2m);
    const tempC = Math.round(((tempF - 32) * 5) / 9);
    document.getElementById("TempF").innerText = tempF;
    document.getElementById("TempC").innerText = tempC;
    document.getElementById("humidity").innerText = weatherData.current.relative_humidity_2m;
    document.getElementById("windSpeed").innerText = weatherData.current.wind_speed_10m;
    document.getElementById("time").innerText = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
    });

    document.getElementById("uvIndex").innerText = weatherData.daily.uv_index_max[0];
    document.getElementById("pressure").innerText = Math.round(
        weatherData.current.surface_pressure
    );
    document.getElementById("visibility").innerText = (
        weatherData.current.visibility / 1609
    ).toFixed(1);

    const formatTime = (isoArray) => {
        if (!isoArray || !isoArray[0]) return "N/A";
        if (isoArray[0].includes("T")) {
            const timePart = isoArray[0].split("T")[1];
            return timePart ? timePart.substring(0, 5) : "N/A";
        }
        return isoArray[0];
    };

    document.getElementById("sunrise").innerText = formatTime(weatherData.daily.sunrise);
    document.getElementById("sunset").innerText = formatTime(weatherData.daily.sunset);
    document.getElementById("airQuality").innerText = "Good";

    // Hourly
    const hourCount = Math.min(hrlyTemp.length, weatherData.hourly.temperature_2m.length);
    for (let i = 0; i < hourCount; i++) {
        hrlyTemp[i].innerText = Math.round(weatherData.hourly.temperature_2m[i]);
        hrlyHumidity[i].innerText = `${weatherData.hourly.relative_humidity_2m[i]}%`;
        if (hrlyWeatherIcon[i]) {
            hrlyWeatherIcon[i].innerHTML = weatherIcon(
                weatherData.hourly.weather_code[i],
                (localHour + i) % 24
            );
        }
    }

    // Weekly
    const dayCount = Math.min(wklyTemp.length, weatherData.daily.temperature_2m_max.length);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayIndex = new Date().getDay();
    const allWeeklyCards = document.querySelectorAll(".weeklyData");

    allWeeklyCards.forEach((card, i) => {
        const dayLabel = card.querySelector("p:first-child");
        if (i === 0) {
            dayLabel.innerText = "Today";
        } else {
            dayLabel.innerText = dayNames[(todayIndex + i) % 7];
        }
    });

    for (let i = 0; i < dayCount; i++) {
        wklyTemp[i].innerText = Math.round(weatherData.daily.temperature_2m_max[i]);
        wklyHumidity[i].innerText = `${weatherData.daily.relative_humidity_2m_max[i]}%`;
        wklyWeatherCondition[i].innerText = interpretWeatherCode(
            weatherData.daily.weather_code[i]
        );
        if (wklyWeatherIcon[i]) {
            wklyWeatherIcon[i].innerHTML = weatherIcon(weatherData.daily.weather_code[i], 12);
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

// === WEATHER CODE TO ICON (SVG, not emoji) ===
const weatherIconPaths = {
    sunny: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    clearNight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    cloudy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h.79a4.5 4.5 0 1 1 0 9z"/></svg>`,
    partlyCloudyNight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3a6 6 0 0 0 0 12 6 6 0 0 1-7.5 5.8A7 7 0 1 0 13 3z"/><path d="M17.5 19H10"/></svg>`,
    fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 17H7a4 4 0 1 1 0-8h.5a5 5 0 0 1 9.6 1.5"/><line x1="3" y1="20" x2="21" y2="20"/><line x1="3" y1="17" x2="9" y2="17"/><line x1="13" y1="17" x2="21" y2="17"/></svg>`,
    drizzle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 14.5A4.5 4.5 0 0 0 15.5 6a5.5 5.5 0 0 0-10.6 1.5A4 4 0 0 0 6 15.5"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="19" x2="12" y2="21"/><line x1="16" y1="19" x2="16" y2="21"/></svg>`,
    rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13.5A4.5 4.5 0 0 0 15.5 5a5.5 5.5 0 0 0-10.6 1.5A4 4 0 0 0 6 14.5"/><line x1="8" y1="17" x2="7" y2="22"/><line x1="13" y1="17" x2="12" y2="22"/><line x1="18" y1="17" x2="17" y2="22"/></svg>`,
    snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/></svg>`,
    storm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>`,
    thermo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/></svg>`,
};

function weatherIcon(code, localHour = new Date().getHours()) {
    const isNight = localHour < 6 || localHour >= 19;

    if (code === 0) return isNight ? weatherIconPaths.clearNight : weatherIconPaths.sunny;
    if (code >= 1 && code <= 3) return isNight ? weatherIconPaths.partlyCloudyNight : weatherIconPaths.cloudy;
    if (code >= 45 && code <= 48) return weatherIconPaths.fog;
    if (code >= 51 && code <= 55) return weatherIconPaths.drizzle;
    if (code >= 61 && code <= 65) return weatherIconPaths.rain;
    if (code >= 71 && code <= 77) return weatherIconPaths.snow;
    if (code >= 80 && code <= 82) return weatherIconPaths.rain;
    if (code >= 95 && code <= 99) return weatherIconPaths.storm;
    return weatherIconPaths.thermo;
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
    const aiSummaryElement = document.getElementById("aiSummary");
    if (!aiSummaryElement) return;

    const city = document.getElementById("location").innerText;
    const tempC = document.getElementById("TempC").innerText;
    const condition = document.getElementById("condition").innerText;
    const humidity = document.getElementById("humidity").innerText;
    const selectedLanguage = language.value;

    if (!city || city === "-") return;

    aiSummaryElement.innerText = "🤖 Consulting AI...";

    try {
        const response = await fetch("http://localhost:3000/api/ai-briefing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                city,
                tempC,
                tempF: document.getElementById("TempF").innerText,
                condition,
                humidity,
                language: selectedLanguage,
                timezone: window.currentTimezone || "UTC",
            }),
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
// === FETCH WEATHER BY CITY NAME (FOR ENTER KEY/SAVED LOCATIONS) ===
async function fetchWeatherByCityName(citySearched) {
    if (!citySearched) return;

    try {
        const geoResponse = await fetch(
            `/api/geocode?name=${encodeURIComponent(citySearched)}`
        );
        if (!geoResponse.ok) throw new Error("Geocode failed");
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            alert("Location not found.");
            locationSuggestions.innerHTML = ''; // Clear suggestions
            locationSuggestions.classList.remove('active');
            return;
        }

        const { latitude, longitude, name, country, timezone } = geoData.results[0];
        // Use the more direct fetchWeatherByCoordinates once we have lat/lon/name/country/timezone
        await fetchWeatherByCoordinates(latitude, longitude, name, country, timezone);
        
        locationSuggestions.innerHTML = ''; // Clear suggestions
        locationSuggestions.classList.remove('active');

    } catch (error) {
        console.error("Error fetching weather by city name:", error);
        alert("Couldn't load weather for your search. Please try again.");
        locationSuggestions.innerHTML = '';
        locationSuggestions.classList.remove('active');
    }
}

// === SEARCH ===
const debouncedFetchSuggestions = debounce(fetchLocationSuggestions, 300);

locationInput.addEventListener("input", (event) => {
    const query = event.target.value.trim();
    if (query.length > 0) {
        debouncedFetchSuggestions(query);
    } else {
        locationSuggestions.innerHTML = '';
        locationSuggestions.classList.remove('active');
    }
});

locationInput.addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
        const citySearched = locationInput.value.trim();
        if (!citySearched) return;

        document.getElementById("condition").innerText = "Loading...";
        document.getElementById("TempF").innerText = "-";
        document.getElementById("TempC").innerText = "-";

        await fetchWeatherByCityName(citySearched); // Use the new function
    }
});

// Clear suggestions when clicking outside the search bar or suggestion list
document.addEventListener('click', (event) => {
    if (!locationInput.contains(event.target) && !locationSuggestions.contains(event.target)) {
        locationSuggestions.innerHTML = '';
        locationSuggestions.classList.remove('active');
    }
});

// === SAVE LOCATION ===
const saveLocButton = document.getElementById("saveLoc");

saveLocButton.addEventListener("click", () => {
    const currentLocationName = document.getElementById("location").innerText;
    if (!currentLocationName || currentLocationName === "-") return;

    let savedCities = JSON.parse(localStorage.getItem("metraSavedCities")) || [];
    if (savedCities.some((c) => c.name === currentLocationName)) return;

    const snapshot = {
        name: currentLocationName,
        tempF: document.getElementById("TempF").innerText,
        tempC: document.getElementById("TempC").innerText,
        condition: document.getElementById("condition").innerText,
        humidity: document.getElementById("humidity").innerText,
        windSpeed: document.getElementById("windSpeed").innerText,
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

    savedCities.forEach((cityObj) => {
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
            fetchWeatherByCityName(cityObj.name); // Use the new function
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
