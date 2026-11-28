// utils/geocoding.js — Shared delivery location geocoding & verification
import {
  buildAreaRegex,
  getActiveDeliveryAreaNames,
  formatServiceableAreaMessage,
  DEFAULT_SERVICE_AREAS,
} from "./serviceAreas.js";

export function parseCoordinate(val) {
  if (val === null || val === undefined || typeof val === "boolean") return null;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || isNaN(trimmed)) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * Normalizes input location from client (handling both camelCase and snake_case)
 */
export function normalizeDeliveryLocation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const lat = input.latitude ?? input.lat ?? null;
  const lng = input.longitude ?? input.lng ?? null;
  const latitude = parseCoordinate(lat);
  const longitude = parseCoordinate(lng);

  const formattedAddress = typeof input.formattedAddress === "string"
    ? input.formattedAddress.trim()
    : typeof input.formatted_address === "string"
    ? input.formatted_address.trim()
    : typeof input.address === "string"
    ? input.address.trim()
    : "";
  const deliveryArea = typeof input.deliveryArea === "string"
    ? input.deliveryArea.trim()
    : typeof input.delivery_area === "string"
    ? input.delivery_area.trim()
    : "";
  const placeId = typeof input.placeId === "string"
    ? input.placeId.trim()
    : typeof input.place_id === "string"
    ? input.place_id.trim()
    : "";
  const verified = Boolean(input.verified);

  if (latitude === null && longitude === null && !formattedAddress) {
    return null;
  }

  return {
    latitude,
    longitude,
    formattedAddress,
    deliveryArea: deliveryArea || null,
    placeId: placeId || null,
    verified,
  };
}

/**
 * Checks if coordinates fall within valid geographic boundaries [-90..90, -180..180]
 */
export function areCoordinatesValid(latitude, longitude) {
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) return false;
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/**
 * Checks if coordinates fall roughly within India geographic boundaries [6..38 N, 68..98 E].
 * Used to immediately reject international spoofing without consuming paid Google Geocoding requests.
 */
export function isCoordinateInIndia(latitude, longitude) {
  if (!areCoordinatesValid(latitude, longitude)) return false;
  return latitude >= 6.0 && latitude <= 38.0 && longitude >= 68.0 && longitude <= 98.0;
}

/**
 * Authoritative reverse geocoding via Google Maps Geocoding API (server-side only)
 */
// In-memory cache for reverse-geocoded coordinates (TTL 1 hour, max 300 entries)
// Clamped to 4 decimal places (~11 meters) to reduce Google API cost exposure
const GEOCODE_CACHE = new Map();
const GEOCODE_CACHE_MAX = 300;
const GEOCODE_CACHE_TTL_MS = 60 * 60 * 1000;

function getGeocodeCacheKey(lat, lng) {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
}

function getFromGeocodeCache(lat, lng) {
  const key = getGeocodeCacheKey(lat, lng);
  const entry = GEOCODE_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > GEOCODE_CACHE_TTL_MS) {
    GEOCODE_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setInGeocodeCache(lat, lng, data) {
  if (GEOCODE_CACHE.size >= GEOCODE_CACHE_MAX) {
    const oldestKey = GEOCODE_CACHE.keys().next().value;
    GEOCODE_CACHE.delete(oldestKey);
  }
  GEOCODE_CACHE.set(getGeocodeCacheKey(lat, lng), {
    data,
    timestamp: Date.now(),
  });
}

export function clearGeocodeCache() {
  GEOCODE_CACHE.clear();
}

export async function reverseGeocodeWithGoogle(latitude, longitude, customApiKey = null) {
  const apiKey =
    customApiKey ||
    process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.GOOGLE_MAPS_BACKEND_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return null;
  }

  const cached = getFromGeocodeCache(latitude, longitude);
  if (cached) {
    return cached;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn(`[geocoding] Google Geocoding API returned HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data.status === "OK" && Array.isArray(data.results) && data.results.length > 0) {
      const firstResult = data.results[0];
      const parsed = {
        formattedAddress: firstResult.formatted_address || "",
        placeId: firstResult.place_id || "",
        addressComponents: firstResult.address_components || [],
      };
      setInGeocodeCache(latitude, longitude, parsed);
      return parsed;
    }

    if (data.status === "ZERO_RESULTS") {
      console.info(`[geocoding] Google Geocoding returned ZERO_RESULTS for ${latitude},${longitude}`);
      const emptyResult = { formattedAddress: "", placeId: "", addressComponents: [] };
      setInGeocodeCache(latitude, longitude, emptyResult);
      return emptyResult;
    }

    if (data.status === "OVER_QUERY_LIMIT") {
      console.error("[geocoding] Google Geocoding API quota exceeded (OVER_QUERY_LIMIT)");
    } else if (data.status === "REQUEST_DENIED") {
      console.error(`[geocoding] Google Geocoding API request denied: ${data.error_message || "Invalid or restricted key"}`);
    } else {
      console.warn(`[geocoding] Google Geocoding API status: ${data.status}`);
    }
    return null;
  } catch (err) {
    console.error("[geocoding] Reverse geocode network error:", err.message);
    return null;
  }
}

/**
 * Matches Google address components or formatted text against active NvFresh delivery areas
 */
export function matchAddressComponentsToArea(addressComponents = [], formattedAddress = "", activeAreaNames = DEFAULT_SERVICE_AREAS) {
  const names = (Array.isArray(activeAreaNames) ? activeAreaNames : [])
    .map((a) => (typeof a === "string" ? a.trim() : a?.name?.trim()))
    .filter(Boolean);

  if (names.length === 0) return null;

  // 1. Inspect structured address components from Google
  for (const component of addressComponents) {
    const longName = component.long_name || "";
    const shortName = component.short_name || "";

    for (const areaName of names) {
      const regex = buildAreaRegex(areaName);
      if (regex.test(longName) || regex.test(shortName)) {
        return areaName;
      }
    }
  }

  // 2. Fall back to inspecting the formatted address string
  if (formattedAddress && typeof formattedAddress === "string") {
    for (const areaName of names) {
      const regex = buildAreaRegex(areaName);
      if (regex.test(formattedAddress)) {
        return areaName;
      }
    }
  }

  return null;
}

/**
 * Known coordinate bounding box estimates for offline / mock testing when no Google key is set.
 * In production with a live Google Geocoding API key, reverseGeocodeWithGoogle provides the authoritative locality.
 */
const KNOWN_TEST_AREAS = [
  { name: "Tadepalli", minLat: 16.46, maxLat: 16.51, minLng: 80.59, maxLng: 80.64 },
  { name: "Undavalli", minLat: 16.48, maxLat: 16.52, minLng: 80.56, maxLng: 80.60 },
  { name: "Kunchanapalli", minLat: 16.44, maxLat: 16.48, minLng: 80.60, maxLng: 80.64 },
  { name: "Nulakapeta", minLat: 16.46, maxLat: 16.49, minLng: 80.61, maxLng: 80.65 },
];

/**
 * Validates and independently verifies delivery coordinates against active delivery areas
 */
export async function validateAndVerifyLocation(inputLocation, options = {}) {
  const norm = normalizeDeliveryLocation(inputLocation);
  if (!norm) {
    return {
      valid: false,
      serviceable: false,
      error: "Location information is missing or empty",
      deliveryLocation: null,
    };
  }

  const { latitude, longitude, formattedAddress, placeId } = norm;
  if (!areCoordinatesValid(latitude, longitude)) {
    return {
      valid: false,
      serviceable: false,
      error: "Valid latitude and longitude coordinates are required",
      deliveryLocation: null,
    };
  }

  // 1. Regional pre-check: If coordinates are outside India, reject immediately
  // without calling Google Geocoding API to prevent cost exploitation
  if (!isCoordinateInIndia(latitude, longitude)) {
    const activeAreas = await getActiveDeliveryAreaNames();
    const errorMessage = formatServiceableAreaMessage(activeAreas);
    return {
      valid: true,
      serviceable: false,
      error: errorMessage,
      deliveryLocation: {
        latitude,
        longitude,
        formattedAddress,
        deliveryArea: null,
        placeId: placeId || null,
        verified: false,
      },
    };
  }

  const activeAreas = await getActiveDeliveryAreaNames();

  // 1. Authoritative verification via Google Geocoding API if key configured
  let matchedArea = null;
  let resolvedAddress = formattedAddress;
  let resolvedPlaceId = placeId;

  const googleResult = await reverseGeocodeWithGoogle(latitude, longitude, options.googleApiKey);
  if (googleResult) {
    resolvedAddress = googleResult.formattedAddress || resolvedAddress;
    resolvedPlaceId = googleResult.placeId || resolvedPlaceId;
    matchedArea = matchAddressComponentsToArea(googleResult.addressComponents, resolvedAddress, activeAreas);
  } else if (process.env.NODE_ENV === "test") {
    // 2. STRICTLY restricted to NODE_ENV === "test" when running offline automated test suites without live Google API keys
    for (const testArea of KNOWN_TEST_AREAS) {
      if (
        latitude >= testArea.minLat &&
        latitude <= testArea.maxLat &&
        longitude >= testArea.minLng &&
        longitude <= testArea.maxLng
      ) {
        if (activeAreas.some((a) => a.toLowerCase() === testArea.name.toLowerCase())) {
          matchedArea = testArea.name;
          break;
        }
      }
    }
  } else {
    // 3. In production, if Google Geocoding API is unavailable or unconfigured, fail safely
    return {
      valid: true,
      serviceable: false,
      error: "Location verification service is currently unavailable. Please verify API configuration.",
      deliveryLocation: {
        latitude,
        longitude,
        formattedAddress,
        deliveryArea: null,
        placeId: placeId || null,
        verified: false,
      },
    };
  }

  if (matchedArea) {
    return {
      valid: true,
      serviceable: true,
      error: null,
      deliveryLocation: {
        latitude,
        longitude,
        formattedAddress: resolvedAddress || `Near ${matchedArea}`,
        formatted_address: resolvedAddress || `Near ${matchedArea}`,
        deliveryArea: matchedArea,
        delivery_area: matchedArea,
        placeId: resolvedPlaceId || null,
        place_id: resolvedPlaceId || null,
        verified: true,
      },
    };
  }

  const errorMessage = formatServiceableAreaMessage(activeAreas);
  return {
    valid: true,
    serviceable: false,
    error: errorMessage,
    deliveryLocation: {
      latitude,
      longitude,
      formattedAddress: resolvedAddress,
      deliveryArea: null,
      placeId: resolvedPlaceId || null,
      verified: false,
    },
  };
}
