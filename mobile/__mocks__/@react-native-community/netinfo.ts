/**
 * Mock for @react-native-community/netinfo
 * Used as a vitest alias to avoid loading native code.
 */
const addEventListener = (_listener: (state: { isConnected: boolean | null }) => void) => {
  // Return unsubscribe function
  return () => {};
};

const fetch = () =>
  Promise.resolve({ isConnected: true, isInternetReachable: true });

export default { addEventListener, fetch };
