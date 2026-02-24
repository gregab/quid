"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

type State = "idle" | "open" | "submitting" | "success" | "error";

export function FeedbackModal() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleOpen() {
    setMessage("");
    setErrorMsg(null);
    setState("open");
  }

  function handleClose() {
    setState("idle");
    setMessage("");
    setErrorMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setState("submitting");
    setErrorMsg(null);

    const metadata = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    };

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, metadata }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setErrorMsg(json.error ?? "Something went wrong. Please try again.");
        setState("error");
      } else {
        setState("success");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Send feedback"
        className="text-sm text-gray-500 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-white"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>

      {(state === "open" || state === "submitting" || state === "success" || state === "error") && createPortal(
        <div
          className="modal-backdrop fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-[15vh] sm:pt-4 overflow-y-auto backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="modal-content bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Send feedback</h2>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {state === "success" ? (
              <div className="py-4 text-center">
                <p className="text-emerald-700 dark:text-emerald-400 font-medium mb-1">Thanks for your feedback!</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">It&apos;s been sent.</p>
                <div className="mt-4 flex justify-center">
                  <Button type="button" variant="ghost" onClick={handleClose}>Close</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="feedbackMessage" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    What&apos;s on your mind?
                  </label>
                  <textarea
                    id="feedbackMessage"
                    rows={5}
                    required
                    placeholder="Bug, suggestion, or anything else…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-shadow dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Your browser info and current page will be included to help with debugging.
                  </p>
                </div>

                {(state === "error") && errorMsg && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
                  <Button type="submit" disabled={state === "submitting" || !message.trim()}>
                    {state === "submitting" ? "Sending…" : "Send feedback"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
