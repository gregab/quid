import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GroupThumbnail } from "./GroupThumbnail";

afterEach(cleanup);

const SEED = 123456789;

describe("GroupThumbnail", () => {
  describe("with bannerUrl", () => {
    it("renders an Image when bannerUrl is provided", () => {
      render(<GroupThumbnail patternSeed={SEED} bannerUrl="https://example.com/banner.jpg" />);
      const thumb = screen.getByTestId("group-thumbnail");
      expect(thumb).toBeTruthy();
    });

    it("does not render an Image when bannerUrl is null", () => {
      // When null, the SVG wrapper View is rendered instead
      render(<GroupThumbnail patternSeed={SEED} bannerUrl={null} />);
      const thumb = screen.getByTestId("group-thumbnail");
      expect(thumb).toBeTruthy();
    });
  });

  describe("sizing", () => {
    it("defaults to md size (44px)", () => {
      render(<GroupThumbnail patternSeed={SEED} bannerUrl={null} />);
      const thumb = screen.getByTestId("group-thumbnail");
      expect(thumb.style.width).toBe("44px");
      expect(thumb.style.height).toBe("44px");
    });

    it("renders sm size (36px)", () => {
      render(<GroupThumbnail patternSeed={SEED} bannerUrl={null} size="sm" />);
      const thumb = screen.getByTestId("group-thumbnail");
      expect(thumb.style.width).toBe("36px");
      expect(thumb.style.height).toBe("36px");
    });

    it("renders lg size (56px)", () => {
      render(<GroupThumbnail patternSeed={SEED} bannerUrl={null} size="lg" />);
      const thumb = screen.getByTestId("group-thumbnail");
      expect(thumb.style.width).toBe("56px");
      expect(thumb.style.height).toBe("56px");
    });
  });

  describe("pattern fallback", () => {
    it("handles null patternSeed gracefully", () => {
      render(<GroupThumbnail patternSeed={null} bannerUrl={null} />);
      expect(screen.getByTestId("group-thumbnail")).toBeTruthy();
    });
  });
});
