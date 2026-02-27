import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import {
  registerForPushNotifications,
  savePushToken,
} from "./notifications";

describe("registerForPushNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: physical device with granted permissions
    (Device as { isDevice: boolean }).isDevice = true;
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "granted",
      expires: "never",
      granted: true,
      canAskAgain: true,
    } as never);
    vi.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
      data: "ExponentPushToken[test-token]",
      type: "expo",
    });
  });

  it("returns a push token on a physical device with granted permissions", async () => {
    const token = await registerForPushNotifications();
    expect(token).toBe("ExponentPushToken[test-token]");
  });

  it("returns null when not a physical device", async () => {
    (Device as { isDevice: boolean }).isDevice = false;
    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });

  it("requests permissions when not already granted", async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "undetermined",
      expires: "never",
      granted: false,
      canAskAgain: true,
    } as never);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      status: "granted",
      expires: "never",
      granted: true,
      canAskAgain: true,
    } as never);

    const token = await registerForPushNotifications();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(token).toBe("ExponentPushToken[test-token]");
  });

  it("returns null when permissions are denied", async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "undetermined",
      expires: "never",
      granted: false,
      canAskAgain: true,
    } as never);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      status: "denied",
      expires: "never",
      granted: false,
      canAskAgain: false,
    } as never);

    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });

  it("returns null and does not throw when getExpoPushTokenAsync errors", async () => {
    vi.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValue(
      new Error("Network error"),
    );
    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });

  it("returns null and does not throw when getPermissionsAsync errors", async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockRejectedValue(
      new Error("Permissions error"),
    );
    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });
});

describe("savePushToken", () => {
  it("logs the token without throwing", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await savePushToken("user-123", "ExponentPushToken[abc]");
    expect(spy).toHaveBeenCalledWith(
      "[push] token for",
      "user-123",
      ":",
      "ExponentPushToken[abc]",
    );
    spy.mockRestore();
  });
});
