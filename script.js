/*
 * WeatherNow – script.js
 * Real-time weather app using OpenWeatherMap API
 *
 *     ADD YOUR API KEY BELOW:
 *     1. Go to https://openweathermap.org/api
 *     2. Sign up / Log in → My API Keys → Copy your key
 *     3. Replace the empty string below with your key
 */

const API_KEY = "13bc126d259b117f9a1e396d4f6d763f"; //  Replace with your OpenWeatherMap API key
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

// ── DOM References ──────────────────────────────────────────────────────
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const loadingSpinner = document.getElementById("loadingSpinner");
const errorCard = document.getElementById("errorCard");
const errorMessage = document.getElementById("errorMessage");
const weatherCard = document.getElementById("weatherCard");
const welcomeState = document.getElementById("welcomeState");

// Weather display elements
const cityName = document.getElementById("cityName");
const countryText = document.getElementById("countryText");
const dateTime = document.getElementById("dateTime");
const weatherIcon = document.getElementById("weatherIcon");
const temperature = document.getElementById("temperature");
const feelsLike = document.getElementById("feelsLike");
const conditionBadge = document.getElementById("conditionBadge");
const weatherCondition = document.getElementById("weatherCondition");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");
const visibility = document.getElementById("visibility");
const pressure = document.getElementById("pressure");
const sunrise = document.getElementById("sunrise");
const sunset = document.getElementById("sunset");
const lastUpdated = document.getElementById("lastUpdated");

// ── Utility: Format Unix Timestamp to Time String ───────────────────────
/**
 * Converts a Unix timestamp + timezone offset into a human-readable time.
 * @param {number} unixTime  - UTC epoch seconds from API
 * @param {number} tzOffset  - Timezone offset in seconds from API
 * @returns {string} Formatted time string, e.g. "06:34 AM"
 */
function formatTime(unixTime, tzOffset) {
  const localMs = (unixTime + tzOffset) * 1000;
  const date = new Date(localMs);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = date.getUTCHours() >= 12 ? "PM" : "AM";
  const h12 = date.getUTCHours() % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}

// ── Utility: Get Local Date-Time String for a City ──────────────────────
/**
 * Returns a friendly date+time string in the city's local timezone.
 * @param {number} tzOffset - Timezone offset in seconds from API
 * @returns {string} e.g. "Thursday, 1 May 2026 – 06:34 AM"
 */
function getCityDateTime(tzOffset) {
  const localMs = Date.now() + tzOffset * 1000;
  const d = new Date(localMs);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const dayName = days[d.getUTCDay()];
  const date = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();

  // Time
  const hh = d.getUTCHours() % 12 || 12;
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ampm = d.getUTCHours() >= 12 ? "PM" : "AM";

  return `${dayName}, ${date} ${month} ${year} – ${hh}:${mm} ${ampm}`;
}

// ── Map Weather Condition to Background Theme ────────────────────────────
/**
 * Returns the appropriate CSS body class based on OpenWeatherMap condition ID.
 * @param {number} conditionId - Weather condition ID from API
 * @returns {string} CSS class name
 */
function getWeatherTheme(conditionId) {
  if (conditionId >= 200 && conditionId < 300) return "bg-stormy";  // Thunderstorm
  if (conditionId >= 300 && conditionId < 600) return "bg-rainy";   // Drizzle / Rain
  if (conditionId >= 600 && conditionId < 700) return "bg-snowy";   // Snow
  if (conditionId >= 700 && conditionId < 800) return "bg-misty";   // Mist, Fog, Haze
  if (conditionId === 800) return "bg-sunny";   // Clear sky
  return "bg-cloudy";                                                 // Clouds
}

// ── Create Floating Particles ────────────────────────────────────────────
/**
 * Generates animated floating particles in the background.
 * Clears existing ones first.
 */
function createParticles() {
  const container = document.getElementById("particles");
  container.innerHTML = "";

  const count = 20;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";

    // Random size between 4px and 18px
    const size = Math.random() * 14 + 4;
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 12 + 8}s;
      animation-delay: ${Math.random() * 8}s;
      opacity: ${Math.random() * 0.4 + 0.05};
    `;
    container.appendChild(p);
  }
}

// ── Apply Theme to Body ──────────────────────────────────────────────────
/**
 * Removes all existing background classes and applies the new one.
 * @param {string} theme - CSS class to add (e.g. "bg-rainy")
 */
function applyTheme(theme) {
  const themes = ["bg-sunny", "bg-cloudy", "bg-rainy", "bg-snowy", "bg-stormy", "bg-misty"];
  document.body.classList.remove(...themes);
  document.body.classList.add(theme);
}

// ── UI State Managers ────────────────────────────────────────────────────
/** Show the loading spinner, hide everything else */
function showLoading() {
  welcomeState.hidden = true;
  weatherCard.hidden = true;
  errorCard.hidden = true;
  loadingSpinner.hidden = false;
}

/** Show the weather card */
function showWeatherCard() {
  loadingSpinner.hidden = true;
  errorCard.hidden = true;
  welcomeState.hidden = true;
  weatherCard.hidden = false;
}

/** Show the error card with a specific message */
function showError(msg) {
  loadingSpinner.hidden = true;
  weatherCard.hidden = true;
  welcomeState.hidden = true;
  errorCard.hidden = false;
  errorMessage.textContent = msg;
}

// ── Fetch Weather Data ───────────────────────────────────────────────────
/**
 * Fetches weather data from OpenWeatherMap API for a given city.
 * Uses async/await and handles errors gracefully.
 * @param {string} city - City name entered by user
 */
async function fetchWeather(city) {
  // Validate empty input
  if (!city.trim()) {
    showError("Please enter a city name to search.");
    return;
  }

  showLoading();

  try {
    // Build API URL (metric units = Celsius)
    const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;

    const response = await fetch(url);

    // Handle HTTP-level errors
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid API key. Please check your OpenWeatherMap key.");
      } else if (response.status === 404) {
        throw new Error(`City "${city}" not found. Check the spelling and try again.`);
      } else {
        throw new Error(`Something went wrong (Error ${response.status}). Please try again.`);
      }
    }

    const data = await response.json();

    // Render and save to localStorage
    renderWeather(data);
    saveLastCity(city.trim());

  } catch (error) {
    // Handle network errors (offline, etc.)
    if (error.name === "TypeError") {
      showError("Network error. Please check your internet connection.");
    } else {
      showError(error.message);
    }
  }
}

// ── Render Weather Data to DOM ───────────────────────────────────────────
/**
 * Takes the API response object and updates all DOM elements.
 * @param {Object} data - OpenWeatherMap API response object
 */
function renderWeather(data) {
  const {
    name,
    sys,
    main,
    weather,
    wind,
    visibility: vis,
    timezone,
    dt,
  } = data;

  const condition = weather[0];
  const theme = getWeatherTheme(condition.id);

  // Apply background theme
  applyTheme(theme);
  createParticles();

  // ── Location & Time ──
  cityName.textContent = name;
  countryText.textContent = sys.country;
  dateTime.textContent = getCityDateTime(timezone);

  // ── Weather Icon (from OpenWeatherMap CDN) ──
  const iconCode = condition.icon;
  weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  weatherIcon.alt = condition.description;

  // ── Temperature ──
  temperature.textContent = Math.round(main.temp);
  feelsLike.textContent = `${Math.round(main.feels_like)}°C`;

  // ── Condition Badge ──
  weatherCondition.textContent = capitalise(condition.description);

  // ── Stats ──
  humidity.textContent = `${main.humidity}%`;
  windSpeed.textContent = `${(wind.speed * 3.6).toFixed(1)} km/h`; // m/s → km/h
  visibility.textContent = vis ? `${(vis / 1000).toFixed(1)} km` : "N/A";
  pressure.textContent = `${main.pressure} hPa`;

  // ── Sunrise / Sunset ──
  sunrise.textContent = formatTime(sys.sunrise, timezone);
  sunset.textContent = formatTime(sys.sunset, timezone);

  // ── Last Updated ──
  lastUpdated.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  showWeatherCard();
}

// ── Helpers ──────────────────────────────────────────────────────────────
/** Capitalise every word of a string */
function capitalise(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Save last searched city to localStorage */
function saveLastCity(city) {
  localStorage.setItem("weatherNow_lastCity", city);
}

/** Load last searched city from localStorage */
function loadLastCity() {
  return localStorage.getItem("weatherNow_lastCity") || null;
}

// ── Event Listeners ──────────────────────────────────────────────────────

// Search button click
searchBtn.addEventListener("click", () => {
  fetchWeather(cityInput.value);
});

// Enter key press in input
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    fetchWeather(cityInput.value);
  }
});

// ── Init: Auto-load last searched city ───────────────────────────────────
/**
 * On page load, check localStorage for a previously searched city.
 * If found, pre-fill the input and auto-fetch.
 */
function init() {
  createParticles();

  const lastCity = loadLastCity();
  if (lastCity) {
    cityInput.value = lastCity;
    fetchWeather(lastCity);
  }
}

// Run on DOM ready
document.addEventListener("DOMContentLoaded", init);
