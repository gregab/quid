import { useState } from "react";
import { Text, Pressable } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";

// Ensure the auth session completes properly on Android
WebBrowser.maybeCompleteAuthSession();

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectUri = makeRedirectUri({ scheme: "aviary" });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        setLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
      );

      if (result.type === "success" && result.url) {
        // Extract tokens from the callback URL fragment
        const url = new URL(result.url);
        // Supabase returns tokens in the URL fragment (#access_token=...&refresh_token=...)
        const fragment = url.hash.substring(1);
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          // Auth state change listener in AuthProvider handles navigation
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handleGoogleSignIn}
      disabled={loading}
      className="flex-row items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-3.5 py-3 active:scale-[0.97] dark:border-stone-700 dark:bg-stone-800"
      style={loading ? { opacity: 0.5 } : undefined}
    >
      <GoogleLogo />
      <Text className="text-sm font-semibold text-stone-700 dark:text-stone-200">
        {loading ? "Signing in..." : "Continue with Google"}
      </Text>
    </Pressable>
  );
}

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <Path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <Path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <Path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </Svg>
  );
}
