const language = document.getElementById("languageSelect");
const theme = document.getElementById("themeToggle");
const search = document.getElementById("searchBar");
const currentLoc = document.getElementById("currentLocStats");
const currentWeatherIcon = document.getElementById("weatherIcon");
//hourly weather forecast
const hrlyWeatherIcon = document.getElementsByClassName("hourlyWeatherIcon");
const hrlyTemp = document.getElementsByClassName("hourlyTempF");
const hrlyHumidity = document.getElementsByClassName("hourlyHumidity");
//weekly weather forecast
const wklyWeatherIcon = document.getElementsByClassName("weeklyWeatherIcon");
const wklyTemp = document.getElementsByClassName("weeklyTempF");
const wklyHumidity = document.getElementsByClassName("weeklyHumidity");
const wklyWeatherCondition = document.getElementsByClassName("weeklyCondition");
//map and radar
const map = document.getElementById("map");
const radar = document.getElementById("radar");
const sunrise = document.getElementById("sunrise");
const sunset = document.getElementById("sunset");
const uvIndex = document.getElementById("uvIndex");
const airQuality = document.getElementById("airQuality");
const visibility = document.getElementById("visibility");
const pressure = document.getElementById("pressure");
//saved locations
const savedLocationsList = document.getElementById("savedLocationsList");
const savedLocation = document.getElementById("savedLocation");
const saved_TempF = document.getElementById("savedTempF");
const saved_TempC = document.getElementById("savedTempC");
const saved_Condition = document.getElementById("savedCondition");
const saved_Humidity = document.getElementById("savedHumidity");
const saved_WindSpeed = document.getElementById("savedWindSpeed");

//Theme toggle
theme.addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "light"
        ? "dark" : "light";
})

