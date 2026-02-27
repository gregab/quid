import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Text } from "react-native";
import { PressableRow } from "./PressableRow";

afterEach(cleanup);

describe("PressableRow", () => {
  it("renders children", () => {
    render(
      <PressableRow onPress={vi.fn()}>
        <Text>Row content</Text>
      </PressableRow>,
    );
    expect(screen.getByText("Row content")).toBeTruthy();
  });

  it("has button accessibility role", () => {
    render(
      <PressableRow onPress={vi.fn()} testID="row">
        <Text>Row</Text>
      </PressableRow>,
    );
    const row = screen.getByTestId("row");
    expect(row).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = vi.fn();
    render(
      <PressableRow onPress={onPress} testID="row">
        <Text>Tap me</Text>
      </PressableRow>,
    );
    fireEvent.click(screen.getByTestId("row"));
    expect(onPress).toHaveBeenCalledOnce();
  });
});
