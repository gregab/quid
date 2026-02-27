import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Appearance, useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "aviary-color-scheme";

type ColorSchemePreference = "system" | "light" | "dark";

interface ColorSchemeContextValue {
  /** The user's stored preference: system, light, or dark */
  preference: ColorSchemePreference;
  /** The resolved scheme after applying preference over system default */
  colorScheme: "light" | "dark";
  /** Cycle through system → light → dark → system */
  cyclePreference: () => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue>({
  preference: "system",
  colorScheme: "light",
  cyclePreference: () => {},
});

const CYCLE_ORDER: ColorSchemePreference[] = ["system", "light", "dark"];

function getNextPreference(
  current: ColorSchemePreference,
): ColorSchemePreference {
  const idx = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
}

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useRNColorScheme() ?? "light";
  const [preference, setPreference] =
    useState<ColorSchemePreference>("system");
  const [loaded, setLoaded] = useState(false);

  // Load stored preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === "light" || value === "dark" || value === "system") {
        setPreference(value);
        if (value !== "system") {
          Appearance.setColorScheme(value);
        } else {
          Appearance.setColorScheme(null);
        }
      }
      setLoaded(true);
    });
  }, []);

  const cyclePreference = useCallback(() => {
    setPreference((prev) => {
      const next = getNextPreference(prev);
      AsyncStorage.setItem(STORAGE_KEY, next);
      if (next === "system") {
        Appearance.setColorScheme(null);
      } else {
        Appearance.setColorScheme(next);
      }
      return next;
    });
  }, []);

  const colorScheme: "light" | "dark" =
    preference === "system" ? systemScheme : preference;

  if (!loaded) return null;

  return (
    <ColorSchemeContext.Provider
      value={{ preference, colorScheme, cyclePreference }}
    >
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorSchemePreference(): ColorSchemeContextValue {
  return useContext(ColorSchemeContext);
}
