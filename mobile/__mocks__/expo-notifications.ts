export const getPermissionsAsync = () => Promise.resolve({ status: "granted", expires: "never", granted: true });
export const requestPermissionsAsync = () => Promise.resolve({ status: "granted", expires: "never", granted: true });
export const getExpoPushTokenAsync = () => Promise.resolve({ data: "ExponentPushToken[stub]", type: "expo" });
export const setNotificationHandler = () => {};
export const AndroidImportance = { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 };
