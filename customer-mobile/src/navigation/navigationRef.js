// navigationRef.js — lets components rendered outside the navigator tree
// (like the persistent AppHeader, which sits above the Stack.Navigator the
// same way Header.jsx sits above <Routes> on the web) still navigate.
// See: https://reactnavigation.org/docs/navigating-without-navigation-prop/
import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
