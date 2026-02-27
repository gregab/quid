// Stub for expo-router — full implementation provided by vi.mock() in vitest.setup.ts
export const useRouter = () => ({ push: () => {}, replace: () => {}, back: () => {}, canGoBack: () => true });
export const useLocalSearchParams = () => ({});
export const useSegments = () => [];
export const Link = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const Stack = Object.assign(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  { Screen: () => null },
);
export const Slot = () => null;
export const Redirect = ({ href }: { href: string }) => <div data-href={href} />;
import React from "react";
