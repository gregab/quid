import { useEffect } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../lib/auth";
import { queryClient } from "../lib/queryClient";
import { fontAssets } from "../lib/fonts";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ToastProvider } from "../lib/toast";
import { ColorSchemeProvider } from "../lib/colorScheme";
import { OfflineBanner } from "../components/ui/OfflineBanner";
import "../global.css";

// Keep splash visible while fonts load
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ColorSchemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
              <BottomSheetModalProvider>
                  <StatusBar style="auto" />
                  <OfflineBanner />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(app)" />
                  </Stack>
                </BottomSheetModalProvider>
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ColorSchemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
