import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { ColorSchemeProvider, useColorSchemePreference } from "./colorScheme";

afterEach(cleanup);

function TestConsumer() {
  const { preference, colorScheme, cyclePreference } =
    useColorSchemePreference();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="colorScheme">{colorScheme}</span>
      <button onClick={cyclePreference}>cycle</button>
    </div>
  );
}

async function renderWithProvider() {
  await act(async () => {
    render(
      <ColorSchemeProvider>
        <TestConsumer />
      </ColorSchemeProvider>,
    );
  });
}

let setColorSchemeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  vi.mocked(AsyncStorage.setItem).mockResolvedValue();
  setColorSchemeSpy = vi.spyOn(Appearance, "setColorScheme");
});

describe("ColorSchemeProvider", () => {
  it("defaults to system preference", async () => {
    await renderWithProvider();
    expect(screen.getByTestId("preference").textContent).toBe("system");
    expect(screen.getByTestId("colorScheme").textContent).toBe("light");
  });

  it("loads stored preference on mount", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("dark");
    await renderWithProvider();
    expect(screen.getByTestId("preference").textContent).toBe("dark");
    expect(screen.getByTestId("colorScheme").textContent).toBe("dark");
  });

  it("cycles system → light → dark → system", async () => {
    await renderWithProvider();

    const cycleBtn = screen.getByText("cycle");

    // system → light
    await act(async () => {
      fireEvent.click(cycleBtn);
    });
    expect(screen.getByTestId("preference").textContent).toBe("light");
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      "aviary-color-scheme",
      "light",
    );

    // light → dark
    await act(async () => {
      fireEvent.click(cycleBtn);
    });
    expect(screen.getByTestId("preference").textContent).toBe("dark");
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      "aviary-color-scheme",
      "dark",
    );

    // dark → system
    await act(async () => {
      fireEvent.click(cycleBtn);
    });
    expect(screen.getByTestId("preference").textContent).toBe("system");
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      "aviary-color-scheme",
      "system",
    );
  });

  it("calls Appearance.setColorScheme on cycle", async () => {
    await renderWithProvider();
    const cycleBtn = screen.getByText("cycle");

    // system → light
    await act(async () => {
      fireEvent.click(cycleBtn);
    });
    expect(setColorSchemeSpy).toHaveBeenLastCalledWith("light");

    // light → dark
    await act(async () => {
      fireEvent.click(cycleBtn);
    });
    expect(setColorSchemeSpy).toHaveBeenLastCalledWith("dark");

    // dark → system (null resets to system)
    await act(async () => {
      fireEvent.click(cycleBtn);
    });
    expect(setColorSchemeSpy).toHaveBeenLastCalledWith(null);
  });

  it("resolves colorScheme from preference when not system", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("light");
    await renderWithProvider();
    expect(screen.getByTestId("colorScheme").textContent).toBe("light");
  });
});
