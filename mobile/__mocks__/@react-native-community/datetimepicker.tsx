/**
 * Mock for @react-native-community/datetimepicker
 * Used as a vitest alias to avoid loading platform-specific native code.
 */
export default function DateTimePicker() {
  return null;
}

export const DateTimePickerAndroid = {
  open: () => {},
  dismiss: () => {},
};
