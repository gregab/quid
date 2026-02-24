// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GroupThumbnail } from "./GroupThumbnail";

const GROUP_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("GroupThumbnail", () => {
  describe("with bannerUrl", () => {
    it("renders an img tag", () => {
      const { container } = render(
        <GroupThumbnail groupId={GROUP_ID} bannerUrl="https://example.com/banner.jpg" />,
      );
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img!.getAttribute("src")).toBe("https://example.com/banner.jpg");
    });

    it("applies lazy loading", () => {
      const { container } = render(
        <GroupThumbnail groupId={GROUP_ID} bannerUrl="https://example.com/banner.jpg" />,
      );
      const img = container.querySelector("img");
      expect(img!.getAttribute("loading")).toBe("lazy");
    });

    it("uses default size of 44", () => {
      const { container } = render(
        <GroupThumbnail groupId={GROUP_ID} bannerUrl="https://example.com/banner.jpg" />,
      );
      const img = container.querySelector("img");
      expect(img!.getAttribute("width")).toBe("44");
      expect(img!.getAttribute("height")).toBe("44");
    });

    it("respects custom size", () => {
      const { container } = render(
        <GroupThumbnail groupId={GROUP_ID} bannerUrl="https://example.com/banner.jpg" size={60} />,
      );
      const img = container.querySelector("img");
      expect(img!.getAttribute("width")).toBe("60");
      expect(img!.getAttribute("height")).toBe("60");
    });
  });

  describe("without bannerUrl", () => {
    it("renders SVG patterns (light and dark)", () => {
      const { container } = render(
        <GroupThumbnail groupId={GROUP_ID} bannerUrl={null} />,
      );
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(2); // light + dark
    });

    it("has dark:hidden on light variant and hidden dark:block on dark variant", () => {
      const { container } = render(
        <GroupThumbnail groupId={GROUP_ID} bannerUrl={null} />,
      );
      const wrappers = container.querySelectorAll("[class*='rounded-lg']");
      expect(wrappers.length).toBe(2);
      expect(wrappers[0]!.className).toContain("dark:hidden");
      expect(wrappers[1]!.className).toContain("hidden");
      expect(wrappers[1]!.className).toContain("dark:block");
    });

    it("applies flex-shrink-0 on root wrapper", () => {
      const { container } = render(
        <GroupThumbnail groupId={GROUP_ID} bannerUrl={null} />,
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toContain("flex-shrink-0");
    });

    it("does not render an img tag", () => {
      const { container } = render(
        <GroupThumbnail groupId={GROUP_ID} bannerUrl={null} />,
      );
      expect(container.querySelector("img")).toBeNull();
    });
  });
});
