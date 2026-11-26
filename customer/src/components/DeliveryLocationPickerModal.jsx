import React, { useEffect, useRef, useState } from "react";
import {
  HiOutlineMapPin,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiXMark,
  HiOutlineCursorArrowRays,
} from "react-icons/hi2";
import { loadGoogleMapsScript } from "../utils/googleMapsLoader.js";
import { api } from "../api.js";
import "./DeliveryLocationPickerModal.css";

// Default coordinates centered on Tadepalli, AP
const DEFAULT_CENTER = { lat: 16.4812, lng: 80.6015 };

export default function DeliveryLocationPickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialLocation,
  activeAreas = [],
  getIdToken,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState("");
  const [locatingCurrent, setLocatingCurrent] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(
    initialLocation?.latitude && initialLocation?.longitude
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
      : DEFAULT_CENTER
  );
  const [resolvedAddress, setResolvedAddress] = useState(
    initialLocation?.formattedAddress || "Move the pin to your exact delivery location"
  );
  const [geocoding, setGeocoding] = useState(false);
  const [serviceable, setServiceable] = useState(initialLocation?.verified ?? false);
  const [deliveryArea, setDeliveryArea] = useState(initialLocation?.deliveryArea || "");
  const [validationError, setValidationError] = useState("");
  const [placeId, setPlaceId] = useState(initialLocation?.placeId || "");

  // Load Google Maps JavaScript API
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    setLoadingMap(true);
    setMapError("");

    loadGoogleMapsScript()
      .then((googleMaps) => {
        if (isCancelled || !mapContainerRef.current) return;

        geocoderRef.current = new googleMaps.Geocoder();

        const initialLat = initialLocation?.latitude || DEFAULT_CENTER.lat;
        const initialLng = initialLocation?.longitude || DEFAULT_CENTER.lng;
        const center = { lat: initialLat, lng: initialLng };

        const map = new googleMaps.Map(mapContainerRef.current, {
          center,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        mapInstanceRef.current = map;

        const marker = new googleMaps.Marker({
          position: center,
          map,
          draggable: true,
          animation: googleMaps.Animation.DROP,
          title: "Drag to delivery location",
        });
        markerRef.current = marker;

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) {
            const newCoords = { lat: pos.lat(), lng: pos.lng() };
            setCurrentPosition(newCoords);
            reverseGeocodeAndValidate(newCoords);
          }
        });

        map.addListener("click", (e) => {
          if (e.latLng) {
            const newCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            marker.setPosition(newCoords);
            setCurrentPosition(newCoords);
            reverseGeocodeAndValidate(newCoords);
          }
        });

        // Trigger initial geocode and validation for the starting position
        reverseGeocodeAndValidate(center);
        setLoadingMap(false);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn("[map-picker] Google Maps load failed:", err.message);
          setMapError(err.message || "Could not load Google Maps. Please check your connection or API key.");
          setLoadingMap(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  async function reverseGeocodeAndValidate(coords) {
    setGeocoding(true);
    setValidationError("");

    let clientAddress = "";
    let clientPlaceId = "";

    // 1. Client-side reverse geocode using Google Geocoder for live feedback
    if (geocoderRef.current) {
      try {
        const response = await geocoderRef.current.geocode({
          location: { lat: coords.lat, lng: coords.lng },
        });
        if (response.results && response.results.length > 0) {
          clientAddress = response.results[0].formatted_address;
          clientPlaceId = response.results[0].place_id;
          setResolvedAddress(clientAddress);
          setPlaceId(clientPlaceId);
        }
      } catch (geoErr) {
        console.warn("[map-picker] Client geocode notice:", geoErr.message);
      }
    }

    // 2. Authoritative backend validation
    try {
      const token = getIdToken ? await getIdToken().catch(() => null) : null;
      const valResult = await api.validateDeliveryLocation(
        {
          latitude: coords.lat,
          longitude: coords.lng,
          formattedAddress: clientAddress,
          placeId: clientPlaceId,
        },
        token
      );

      if (valResult.serviceable) {
        setServiceable(true);
        setDeliveryArea(valResult.deliveryLocation?.deliveryArea || "");
        if (valResult.deliveryLocation?.formattedAddress) {
          setResolvedAddress(valResult.deliveryLocation.formattedAddress);
        }
        setValidationError("");
      } else {
        setServiceable(false);
        setDeliveryArea("");
        setValidationError(
          valResult.error || "Selected location is outside NvFresh serviceable delivery areas."
        );
      }
    } catch (err) {
      console.warn("[map-picker] Backend validation notice:", err.message);
      // Fallback check against active area names if offline
      setServiceable(false);
      setValidationError(err.message || "Could not verify delivery eligibility for this location.");
    } finally {
      setGeocoding(false);
    }
  }

  // Handle "Use Current Location"
  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocatingCurrent(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingCurrent(false);
        const userCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCurrentPosition(userCoords);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(userCoords);
          mapInstanceRef.current.setZoom(17);
        }
        if (markerRef.current) {
          markerRef.current.setPosition(userCoords);
        }

        reverseGeocodeAndValidate(userCoords);
      },
      (err) => {
        setLocatingCurrent(false);
        let msg = "Could not fetch current location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location access was denied. Please allow location permissions in your browser or drag the pin manually.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Location information is unavailable. Please pan the map manually.";
        }
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function handleConfirm() {
    if (!serviceable) return;
    onConfirm({
      latitude: currentPosition.lat,
      longitude: currentPosition.lng,
      formattedAddress: resolvedAddress,
      deliveryArea,
      placeId,
      verified: true,
    });
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="loc-modal-overlay">
      <div className="loc-modal-card">
        {/* Header */}
        <div className="loc-modal-header">
          <div className="loc-modal-title-row">
            <HiOutlineMapPin className="loc-modal-header-icon" />
            <div>
              <h3>Choose Delivery Pin</h3>
              <p>Place pin on your exact doorstep for fresh Sunday delivery</p>
            </div>
          </div>
          <button className="loc-modal-close-btn" onClick={onClose} aria-label="Close map">
            <HiXMark />
          </button>
        </div>

        {/* Map Container */}
        <div className="loc-modal-map-wrap">
          {mapError ? (
            <div className="loc-modal-map-error">
              <HiOutlineExclamationCircle className="loc-modal-error-icon" />
              <h4>Google Maps could not be loaded</h4>
              <p>{mapError}</p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setMapError("");
                  setLoadingMap(true);
                  loadGoogleMapsScript()
                    .then(() => setLoadingMap(false))
                    .catch((e) => setMapError(e.message));
                }}
              >
                Retry Loading Map
              </button>
            </div>
          ) : (
            <div ref={mapContainerRef} className="loc-modal-map" />
          )}

          {loadingMap && (
            <div className="loc-modal-map-loader">
              <div className="loc-spinner" />
              <span>Loading Google Maps...</span>
            </div>
          )}

          {/* Floating Current Location Button */}
          {!loadingMap && !mapError && (
            <button
              type="button"
              className="loc-current-location-btn"
              onClick={handleUseCurrentLocation}
              disabled={locatingCurrent}
              title="Use current location"
            >
              <HiOutlineCursorArrowRays className={locatingCurrent ? "loc-icon-spin" : ""} />
              <span>{locatingCurrent ? "Locating..." : "Locate Me"}</span>
            </button>
          )}
        </div>

        {/* Footer Details Card */}
        <div className="loc-modal-footer">
          {/* Status Badge */}
          <div className="loc-modal-status-bar">
            {geocoding ? (
              <span className="loc-badge loc-badge-loading">
                <span className="loc-spinner-sm" /> Checking delivery area...
              </span>
            ) : serviceable ? (
              <span className="loc-badge loc-badge-success">
                <HiOutlineCheckCircle /> Delivering to {deliveryArea || "Serviceable Area"}
              </span>
            ) : (
              <span className="loc-badge loc-badge-error">
                <HiOutlineExclamationCircle /> Outside Delivery Area
              </span>
            )}
          </div>

          {/* Address Display */}
          <div className="loc-modal-address-box">
            <div className="loc-modal-address-label">Delivery Pin Address:</div>
            <div className="loc-modal-address-text">
              {geocoding ? "Resolving address..." : resolvedAddress}
            </div>
          </div>

          {validationError && !geocoding && (
            <div className="loc-modal-error-alert">{validationError}</div>
          )}

          {/* Action Buttons */}
          <div className="loc-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary loc-modal-confirm-btn"
              disabled={!serviceable || geocoding || loadingMap}
              onClick={handleConfirm}
            >
              {serviceable ? "Confirm Delivery Pin" : "Select Serviceable Pin"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
