import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Input } from "./Input";

afterEach(cleanup);

describe("Input", () => {
  it("renders with label", () => {
    render(<Input label="Email" value="" onChangeText={vi.fn()} />);
    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("renders with placeholder", () => {
    render(
      <Input
        placeholder="you@example.com"
        value=""
        onChangeText={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
  });

  it("displays error message", () => {
    render(
      <Input
        label="Password"
        error="Password is required"
        value=""
        onChangeText={vi.fn()}
      />,
    );
    expect(screen.getByText("Password is required")).toBeTruthy();
  });

  it("does not show error when not provided", () => {
    render(<Input label="Name" value="" onChangeText={vi.fn()} />);
    // No error element
    expect(
      screen.queryByText(/required|invalid|error/i),
    ).toBeNull();
  });

  it("calls onChangeText when typing", () => {
    const onChangeText = vi.fn();
    render(
      <Input
        placeholder="Type here"
        value=""
        onChangeText={onChangeText}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Type here"), {
      target: { value: "hello" },
    });
    expect(onChangeText).toHaveBeenCalledWith("hello");
  });
});
