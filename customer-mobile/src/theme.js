// theme.js — design tokens ported from customer/src/index.css (:root vars),
// so the app keeps the same NvFresh brand look.

export const colors = {
  primary: "#C62828",
  primaryDark: "#8D2323",
  secondary: "#EF5350",
  accent: "#FFB300",
  bg: "#FFF8F5",
  card: "#FFFFFF",
  text: "#2A1B18",
  textMuted: "#7A6560",
  border: "#F0DFD9",
  success: "#2E7D32",
  white: "#FFFFFF",
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

export const shadow = {
  sm: {
    shadowColor: colors.primary,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Gradients — mirror customer/src/index.css's --gradient-primary / --gradient-accent,
// consumed via expo-linear-gradient's `colors` prop.
export const gradients = {
  primary: [colors.primary, colors.secondary],
  accent: ["#FFB300", "#FF8A00"],
};

// Typography — Baloo 2 (display: headings, logo, prices — matches the
// website's --font-display) and Inter (body — matches --font-body).
// Font files are loaded via useFonts() in App.js under these exact names;
// fall back to platform defaults until they're ready (see App.js).
export const typography = {
  display: {
    regular: "Baloo2_400Regular",
    medium: "Baloo2_500Medium",
    semibold: "Baloo2_600SemiBold",
    bold: "Baloo2_700Bold",
    extrabold: "Baloo2_800ExtraBold",
  },
  body: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
    extrabold: "Inter_800ExtraBold",
  },
};
