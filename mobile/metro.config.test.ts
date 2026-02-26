import { describe, it, expect } from "vitest";

// The regex used in metro.config.js to pin react/react-native to a single
// instance in the monorepo. Tested here because it's easy to accidentally
// match too broadly (e.g. react-native-gesture-handler) or too narrowly.
const PINNED_TO_MOBILE = /^react(-native)?(\/|$)/;

describe("PINNED_TO_MOBILE regex", () => {
  it("matches bare 'react'", () => {
    expect(PINNED_TO_MOBILE.test("react")).toBe(true);
  });

  it("matches react subpaths", () => {
    expect(PINNED_TO_MOBILE.test("react/jsx-runtime")).toBe(true);
    expect(PINNED_TO_MOBILE.test("react/jsx-dev-runtime")).toBe(true);
    expect(PINNED_TO_MOBILE.test("react/package.json")).toBe(true);
  });

  it("matches bare 'react-native'", () => {
    expect(PINNED_TO_MOBILE.test("react-native")).toBe(true);
  });

  it("matches react-native subpaths", () => {
    expect(PINNED_TO_MOBILE.test("react-native/Libraries/Animated/Animated")).toBe(true);
    expect(PINNED_TO_MOBILE.test("react-native/package.json")).toBe(true);
  });

  it("does NOT match third-party react-native-* packages", () => {
    expect(PINNED_TO_MOBILE.test("react-native-gesture-handler")).toBe(false);
    expect(PINNED_TO_MOBILE.test("react-native-reanimated")).toBe(false);
    expect(PINNED_TO_MOBILE.test("react-native-safe-area-context")).toBe(false);
    expect(PINNED_TO_MOBILE.test("react-native-screens")).toBe(false);
    expect(PINNED_TO_MOBILE.test("react-native-svg")).toBe(false);
    expect(PINNED_TO_MOBILE.test("react-native-css-interop")).toBe(false);
  });

  it("does NOT match other react-* packages", () => {
    expect(PINNED_TO_MOBILE.test("react-query")).toBe(false);
    expect(PINNED_TO_MOBILE.test("react-dom")).toBe(false);
    expect(PINNED_TO_MOBILE.test("react-router")).toBe(false);
  });
});
