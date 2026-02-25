/**
 * Font configuration for Expo.
 * Load these with `useFonts()` in the root layout.
 *
 * Font files must be placed in assets/fonts/:
 *   - Geist-Regular.otf
 *   - Geist-Medium.otf
 *   - Geist-SemiBold.otf
 *   - Geist-Bold.otf
 *   - CormorantGaramond-Regular.ttf
 */

/* eslint-disable @typescript-eslint/no-require-imports */
export const fontAssets = {
  Geist: require("../assets/fonts/Geist-Regular.otf"),
  "Geist-Medium": require("../assets/fonts/Geist-Medium.otf"),
  "Geist-SemiBold": require("../assets/fonts/Geist-SemiBold.otf"),
  "Geist-Bold": require("../assets/fonts/Geist-Bold.otf"),
  "CormorantGaramond-Regular": require("../assets/fonts/CormorantGaramond-Regular.ttf"),
} as const;
