// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { FeedbackModal } from "./FeedbackModal";

afterEach(cleanup);

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /send feedback/i }));
}

function getForm() {
  return document.querySelector("form")!;
}

function getTextarea() {
  return screen.getByRole("textbox") as HTMLTextAreaElement;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

describe("FeedbackModal — trigger button", () => {
  it("renders the feedback trigger button", () => {
    render(<FeedbackModal />);
    expect(screen.getByRole("button", { name: /send feedback/i })).toBeTruthy();
  });

  it("does not render the modal initially", () => {
    render(<FeedbackModal />);
    expect(screen.queryByText(/what's on your mind/i)).toBeNull();
  });
});

// ─── Modal lifecycle ──────────────────────────────────────────────────────────

describe("FeedbackModal — modal lifecycle", () => {
  it("opens the modal when the trigger is clicked", () => {
    render(<FeedbackModal />);
    openModal();
    expect(screen.getByRole("heading", { name: /send feedback/i })).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("closes via the X button", () => {
    render(<FeedbackModal />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("closes via the Cancel button", () => {
    render(<FeedbackModal />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("closes via backdrop click", () => {
    render(<FeedbackModal />);
    openModal();
    const backdrop = document.querySelector(".modal-backdrop")!;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("resets message when reopened after close", () => {
    render(<FeedbackModal />);
    openModal();
    fireEvent.change(getTextarea(), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    openModal();
    expect(getTextarea().value).toBe("");
  });
});

// ─── Submission ───────────────────────────────────────────────────────────────

describe("FeedbackModal — submission", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submitted: true }, error: null }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls fetch with correct body on submit", async () => {
    render(<FeedbackModal />);
    openModal();
    fireEvent.change(getTextarea(), { target: { value: "Great app!" } });
    await act(async () => { fireEvent.submit(getForm()); });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/feedback");
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.message).toBe("Great app!");
    expect(body.metadata).toBeDefined();
  });

  it("includes metadata fields in the payload", async () => {
    render(<FeedbackModal />);
    openModal();
    fireEvent.change(getTextarea(), { target: { value: "Bug here" } });
    await act(async () => { fireEvent.submit(getForm()); });
    const body = JSON.parse(
      ((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string
    );
    expect(typeof body.metadata.url).toBe("string");
    expect(typeof body.metadata.userAgent).toBe("string");
  });

  it("shows success confirmation after submit", async () => {
    render(<FeedbackModal />);
    openModal();
    fireEvent.change(getTextarea(), { target: { value: "Nice!" } });
    await act(async () => { fireEvent.submit(getForm()); });
    expect(screen.getByText(/thanks for your feedback/i)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("closes from success state via Close button", async () => {
    render(<FeedbackModal />);
    openModal();
    fireEvent.change(getTextarea(), { target: { value: "Nice!" } });
    await act(async () => { fireEvent.submit(getForm()); });
    // Two "close" buttons exist (X icon + text button); click the text "Close" button (last one)
    const closeBtns = screen.getAllByRole("button", { name: /close/i });
    fireEvent.click(closeBtns[closeBtns.length - 1]!);
    expect(screen.queryByText(/thanks for your feedback/i)).toBeNull();
  });

  it("shows error message when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ data: null, error: "Something went wrong" }),
    } as Response);
    render(<FeedbackModal />);
    openModal();
    fireEvent.change(getTextarea(), { target: { value: "Crash!" } });
    await act(async () => { fireEvent.submit(getForm()); });
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("does not submit when message is empty", async () => {
    render(<FeedbackModal />);
    openModal();
    await act(async () => { fireEvent.submit(getForm()); });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting", async () => {
    let resolve!: (v: Response) => void;
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockReturnValue(new Promise((r) => { resolve = r; }));

    render(<FeedbackModal />);
    openModal();
    fireEvent.change(getTextarea(), { target: { value: "Test" } });

    act(() => { fireEvent.submit(getForm()); });

    const submitBtn = screen.getByRole("button", { name: /sending/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    // Clean up
    resolve({ ok: true, json: async () => ({}) } as Response);
  });
});
