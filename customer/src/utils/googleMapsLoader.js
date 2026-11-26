// utils/googleMapsLoader.js — Dynamic loader for Google Maps JavaScript API
let mapsPromise = null;

export function loadGoogleMapsScript(customApiKey) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is not available"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (mapsPromise) {
    return mapsPromise;
  }

  const apiKey = customApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in customer/.env.")
    );
  }

  mapsPromise = new Promise((resolve, reject) => {
    // Check if script already appended in DOM
    const existing = document.querySelector('script[data-gmaps-loader="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps));
      existing.addEventListener("error", () => {
        mapsPromise = null;
        reject(new Error("Failed to load Google Maps script."));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-gmaps-loader", "true");

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        mapsPromise = null;
        reject(new Error("Google Maps loaded but google.maps is not available"));
      }
    };

    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Maps script failed to load. Check your internet connection or API key restriction."));
    };

    document.head.appendChild(script);
  });

  return mapsPromise;
}
