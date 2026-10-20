// AnnouncementBanner.jsx — horizontally scrolling announcement banner
// positioned directly below AppHeader.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme.js";

const MESSAGE = "Bulk orders are available for all kinds of functions and events.";

export default function AnnouncementBanner() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    if (contentWidth <= 0) return;

    scrollX.setValue(0);
    // Smooth reading speed: ~38 points per second
    const duration = (contentWidth / 38) * 1000;

    const anim = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -contentWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    anim.start();

    return () => anim.stop();
  }, [contentWidth, scrollX]);

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={MESSAGE}
    >
      <Animated.View
        style={[
          styles.track,
          {
            transform: [{ translateX: scrollX }],
          },
        ]}
      >
        <View
          style={styles.group}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width > 0 && Math.abs(width - contentWidth) > 1) {
              setContentWidth(width);
            }
          }}
        >
          {[0, 1, 2].map((idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.text}>{MESSAGE}</Text>
              <Text style={styles.dot}>•</Text>
            </View>
          ))}
        </View>

        {/* Duplicate group to create a seamless infinite loop */}
        <View style={styles.group} aria-hidden>
          {[0, 1, 2].map((idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.text}>{MESSAGE}</Text>
              <Text style={styles.dot}>•</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    overflow: "hidden",
    height: 30,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#B71C1C",
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    color: colors.white,
    fontSize: 12,
    fontFamily: typography.body.semibold,
    letterSpacing: 0.1,
  },
  dot: {
    color: colors.accent,
    fontSize: 12,
    marginHorizontal: 16,
  },
});

