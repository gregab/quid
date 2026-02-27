import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

/**
 * Request push notification permissions and return the Expo push token.
 * Returns null if permissions are denied, device is an emulator, or any error occurs.
 * Never throws — all errors are caught and logged.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log("[push] Not a physical device — skipping token registration");
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[push] Permission not granted");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId as string,
    });

    return tokenData.data;
  } catch (error) {
    console.log("[push] Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Save a push token for a user.
 * TODO: Store token in a push_tokens table (not yet created).
 * For now, just logs the token.
 */
export async function savePushToken(
  userId: string,
  token: string,
): Promise<void> {
  // TODO: store token in a push_tokens table (not yet created)
  console.log("[push] token for", userId, ":", token);
}
