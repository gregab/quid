import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  SkeletonBlock,
  DashboardSkeleton,
  GroupDetailSkeleton,
} from "./SkeletonLoader";

afterEach(cleanup);

describe("SkeletonBlock", () => {
  it("renders a shimmer block", () => {
    const { container } = render(<SkeletonBlock className="h-4 w-20" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("applies custom className", () => {
    const { container } = render(<SkeletonBlock className="h-8 w-32" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-8");
    expect(el.className).toContain("w-32");
  });
});

describe("DashboardSkeleton", () => {
  it("renders with testID", () => {
    render(<DashboardSkeleton />);
    expect(screen.getByTestId("dashboard-skeleton")).toBeTruthy();
  });

  it("renders 4 group card placeholders", () => {
    const { container } = render(<DashboardSkeleton />);
    // Each group row has a border-b class
    const rows = container.querySelectorAll('[class*="border-b"]');
    expect(rows.length).toBe(4);
  });
});

describe("GroupDetailSkeleton", () => {
  it("renders with testID", () => {
    render(<GroupDetailSkeleton />);
    expect(screen.getByTestId("group-detail-skeleton")).toBeTruthy();
  });

  it("renders 3 expense row placeholders", () => {
    const { container } = render(<GroupDetailSkeleton />);
    const rows = container.querySelectorAll('[class*="border-b"]');
    expect(rows.length).toBe(3);
  });
});
