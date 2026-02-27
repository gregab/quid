import { describe, it, expect, afterEach, vi } from "vitest";

// Unmock toast so we test the real implementation (vitest.setup.ts mocks it globally)
vi.unmock("./toast");
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast";

afterEach(cleanup);

function TestConsumer() {
  const { showToast } = useToast();
  return (
    <div>
      <button
        onClick={() =>
          showToast({ message: "Success!", type: "success" })
        }
      >
        Show success
      </button>
      <button
        onClick={() =>
          showToast({ message: "Oops!", type: "error" })
        }
      >
        Show error
      </button>
      <button
        onClick={() =>
          showToast({ message: "FYI", type: "info" })
        }
      >
        Show info
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <TestConsumer />
    </ToastProvider>,
  );
}

describe("useToast + ToastProvider", () => {
  it("shows no toast initially", () => {
    renderWithProvider();
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("shows a success toast when triggered", () => {
    renderWithProvider();
    fireEvent.click(screen.getByText("Show success"));
    expect(screen.getByText("Success!")).toBeTruthy();
    expect(screen.getByTestId("toast")).toBeTruthy();
  });

  it("shows an error toast when triggered", () => {
    renderWithProvider();
    fireEvent.click(screen.getByText("Show error"));
    expect(screen.getByText("Oops!")).toBeTruthy();
  });

  it("shows an info toast when triggered", () => {
    renderWithProvider();
    fireEvent.click(screen.getByText("Show info"));
    expect(screen.getByText("FYI")).toBeTruthy();
  });

  it("replaces existing toast with new one", () => {
    renderWithProvider();
    fireEvent.click(screen.getByText("Show success"));
    expect(screen.getByText("Success!")).toBeTruthy();

    fireEvent.click(screen.getByText("Show error"));
    expect(screen.queryByText("Success!")).toBeNull();
    expect(screen.getByText("Oops!")).toBeTruthy();
  });

  it("throws when useToast is used outside provider", () => {
    function BadConsumer() {
      useToast();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow(
      "useToast must be used within a ToastProvider",
    );
  });
});
