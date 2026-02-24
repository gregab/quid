/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { InstallPrompt } from "./InstallPrompt";

describe("InstallPrompt", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();

    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    // Default: not standalone
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });

    // Default: Android Chrome UA
    Object.defineProperty(navigator, "userAgent", {
      writable: true,
      configurable: true,
      value:
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0",
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders nothing when no install signal and not iOS", () => {
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when already in standalone mode", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when previously dismissed", () => {
    localStorage.setItem("aviary-install-dismissed", "true");
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("shows iOS instructions on iOS Safari", () => {
    Object.defineProperty(navigator, "userAgent", {
      writable: true,
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    render(<InstallPrompt />);
    expect(screen.getByText("Add Aviary to Home Screen")).toBeDefined();
    expect(screen.getByText(/Share, then/)).toBeDefined();
  });

  it("shows install button when beforeinstallprompt fires", () => {
    render(<InstallPrompt />);

    const call = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "beforeinstallprompt"
    );
    expect(call).toBeDefined();
    const handler = call![1] as EventListener;

    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    (mockEvent as Event).preventDefault = vi.fn();

    act(() => handler(mockEvent));

    expect(screen.getByText("Install App")).toBeDefined();
  });

  it("calls prompt() when Install App button is clicked", async () => {
    render(<InstallPrompt />);

    const call = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "beforeinstallprompt"
    );
    const handler = call![1] as EventListener;

    const promptFn = vi.fn().mockResolvedValue(undefined);
    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, {
      prompt: promptFn,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    (mockEvent as Event).preventDefault = vi.fn();

    act(() => handler(mockEvent));

    await act(async () => {
      fireEvent.click(screen.getByText("Install App"));
    });

    expect(promptFn).toHaveBeenCalled();
  });

  it("dismisses and saves to localStorage", () => {
    Object.defineProperty(navigator, "userAgent", {
      writable: true,
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    render(<InstallPrompt />);

    fireEvent.click(screen.getByLabelText("Dismiss install prompt"));

    expect(localStorage.getItem("aviary-install-dismissed")).toBe("true");
    expect(screen.queryByText("Add Aviary to Home Screen")).toBeNull();
  });

  it("cleans up beforeinstallprompt listener on unmount", () => {
    const { unmount } = render(<InstallPrompt />);
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function)
    );
  });
});
