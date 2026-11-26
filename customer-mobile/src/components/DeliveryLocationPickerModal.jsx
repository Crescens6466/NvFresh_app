// DeliveryLocationPickerModal.jsx — Native Google Maps location picker for Android
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api.js";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const DEFAULT_COORDS = {
  latitude: 16.4812,
  longitude: 80.6015,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function DeliveryLocationPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLocation,
  getIdToken,
}) {
  const mapRef = useRef(null);

  const [coords, setCoords] = useState({
    latitude: initialLocation?.latitude || DEFAULT_COORDS.latitude,
    longitude: initialLocation?.longitude || DEFAULT_COORDS.longitude,
  });
  const [resolvedAddress, setResolvedAddress] = useState(
    initialLocation?.formattedAddress || "Move pin to your exact delivery location"
  );
  const [deliveryArea, setDeliveryArea] = useState(initialLocation?.deliveryArea || "");
  const [serviceable, setServiceable] = useState(initialLocation?.verified ?? false);
  const [placeId, setPlaceId] = useState(initialLocation?.placeId || "");
  const [validationError, setValidationError] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [locatingCurrent, setLocatingCurrent] = useState(false);

  // Sync initial location when modal opens
  useEffect(() => {
    if (visible) {
      const initialLat = initialLocation?.latitude || DEFAULT_COORDS.latitude;
      const initialLng = initialLocation?.longitude || DEFAULT_COORDS.longitude;
      const newCoords = { latitude: initialLat, longitude: initialLng };
      setCoords(newCoords);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...newCoords,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          },
          500
        );
      }

      reverseGeocodeAndValidate(newCoords);
    }
  }, [visible]);

  async function reverseGeocodeAndValidate(targetCoords) {
    setGeocoding(true);
    setValidationError("");

    let nativeAddress = "";
    // 1. Native reverse geocode for immediate text preview
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: targetCoords.latitude,
        longitude: targetCoords.longitude,
      });
      if (results && results.length > 0) {
        const item = results[0];
        const parts = [
          item.name,
          item.street,
          item.district || item.subregion,
          item.city,
          item.postalCode,
        ].filter(Boolean);
        nativeAddress = parts.join(", ");
        if (nativeAddress) {
          setResolvedAddress(nativeAddress);
        }
      }
    } catch (e) {
      // Native reverse geocode failure is non-fatal
    }

    // 2. Authoritative backend validation against active delivery areas
    try {
      const token = getIdToken ? await getIdToken().catch(() => null) : null;
      const result = await api.validateDeliveryLocation(
        {
          latitude: targetCoords.latitude,
          longitude: targetCoords.longitude,
          formattedAddress: nativeAddress,
          placeId,
        },
        token
      );

      if (result.serviceable) {
        setServiceable(true);
        setDeliveryArea(result.deliveryLocation?.deliveryArea || "");
        if (result.deliveryLocation?.formattedAddress) {
          setResolvedAddress(result.deliveryLocation.formattedAddress);
        }
        setValidationError("");
      } else {
        setServiceable(false);
        setDeliveryArea("");
        setValidationError(
          result.error || "Selected location is outside NvFresh delivery areas."
        );
      }
    } catch (err) {
      setServiceable(false);
      setValidationError(err.message || "Could not verify location serviceability.");
    } finally {
      setGeocoding(false);
    }
  }

  // Handle "Locate Me"
  async function handleLocateMe() {
    if (locatingCurrent) return;
    setLocatingCurrent(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Location permission was denied. You can drag the pin manually.");
        setLocatingCurrent(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userCoords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setCoords(userCoords);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...userCoords,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          600
        );
      }

      await reverseGeocodeAndValidate(userCoords);
    } catch (err) {
      alert("Could not detect current location. Please pan the map manually.");
    } finally {
      setLocatingCurrent(false);
    }
  }

  function handleMapPress(e) {
    const newCoords = e.nativeEvent.coordinate;
    setCoords(newCoords);
    reverseGeocodeAndValidate(newCoords);
  }

  function handleMarkerDragEnd(e) {
    const newCoords = e.nativeEvent.coordinate;
    setCoords(newCoords);
    reverseGeocodeAndValidate(newCoords);
  }

  function handleConfirm() {
    if (!serviceable) return;
    onConfirm({
      latitude: coords.latitude,
      longitude: coords.longitude,
      formattedAddress: resolvedAddress,
      deliveryArea,
      placeId,
      verified: true,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close map">
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Choose Delivery Pin</Text>
            <Text style={styles.headerSub}>Move pin to your exact delivery doorstep</Text>
          </View>
        </View>

        {/* Map Container */}
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              ...coords,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
          >
            <Marker
              coordinate={coords}
              draggable
              onDragEnd={handleMarkerDragEnd}
              title="Delivery Location"
              description="Drag to your house/apartment"
              pinColor="#C62828"
            />
          </MapView>

          {/* Floating Current Location Button */}
          <TouchableOpacity
            style={styles.currentLocationBtn}
            onPress={handleLocateMe}
            disabled={locatingCurrent}
            accessibilityLabel="Use current location"
          >
            {locatingCurrent ? (
              <ActivityIndicator size="small" color="#C62828" />
            ) : (
              <Ionicons name="locate" size={20} color="#C62828" />
            )}
            <Text style={styles.currentLocationText}>
              {locatingCurrent ? "Locating..." : "Locate Me"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Details Card */}
        <View style={styles.footer}>
          {/* Status Badge */}
          <View style={styles.statusBar}>
            {geocoding ? (
              <View style={[styles.badge, styles.badgeLoading]}>
                <ActivityIndicator size="small" color="#666" style={{ marginRight: 6 }} />
                <Text style={styles.badgeLoadingText}>Verifying area...</Text>
              </View>
            ) : serviceable ? (
              <View style={[styles.badge, styles.badgeSuccess]}>
                <Ionicons name="checkmark-circle" size={16} color="#2E7D32" style={{ marginRight: 4 }} />
                <Text style={styles.badgeSuccessText}>
                  Delivering to {deliveryArea || "Serviceable Area"}
                </Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgeError]}>
                <Ionicons name="alert-circle" size={16} color="#C62828" style={{ marginRight: 4 }} />
                <Text style={styles.badgeErrorText}>Outside Delivery Area</Text>
              </View>
            )}
          </View>

          {/* Address Box */}
          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>DELIVERY PIN ADDRESS</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {geocoding ? "Resolving address..." : resolvedAddress}
            </Text>
          </View>

          {validationError && !geocoding ? (
            <Text style={styles.errorAlert}>{validationError}</Text>
          ) : null}

          {/* Confirm Button */}
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (!serviceable || geocoding) && styles.confirmBtnDisabled,
            ]}
            disabled={!serviceable || geocoding}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmBtnText}>
              {serviceable ? "Confirm Delivery Pin" : "Select Serviceable Pin"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  closeBtn: {
    padding: 6,
    marginRight: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text || "#1a1a1a",
  },
  headerSub: {
    fontSize: 12,
    color: colors.textMuted || "#777",
    marginTop: 2,
  },
  mapWrap: {
    flex: 1,
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  currentLocationBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    ...shadow.md,
    gap: 6,
  },
  currentLocationText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  footer: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  statusBar: {
    marginBottom: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  badgeSuccess: {
    backgroundColor: "#E8F5E9",
  },
  badgeSuccessText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },
  badgeError: {
    backgroundColor: "#FFEBEE",
  },
  badgeErrorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#C62828",
  },
  badgeLoading: {
    backgroundColor: "#f5f5f5",
  },
  badgeLoadingText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  addressBox: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: "#222",
    lineHeight: 18,
  },
  errorAlert: {
    fontSize: 11,
    color: "#C62828",
    marginBottom: 10,
    fontWeight: "600",
  },
  confirmBtn: {
    backgroundColor: "#C62828",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    backgroundColor: "#e0e0e0",
  },
  confirmBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
