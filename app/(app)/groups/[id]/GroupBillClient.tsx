"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { computeBillSplits } from "@aviary/shared";
import { formatCents } from "@/lib/format";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { filterDecimalInput } from "@/lib/amount";

export interface GroupBillItem {
  id: string;
  groupBillId: string;
  description: string;
  amountCents: number;
  isTaxOrTip: boolean;
  claimedByUserIds: string[];
  sortOrder: number;
}

export interface Member {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface GroupBillClientProps {
  groupId: string;
  billId: string;
  currentUserId: string;
  bill: {
    id: string;
    name: string;
    receiptType: "meal" | "other";
    status: "in_progress" | "finalized";
    expenseId: string | null;
    receiptImageSignedUrl: string | null;
  };
  initialItems: GroupBillItem[];
  members: Member[];
}

// Member initials avatar for claim chips
function MemberChip({
  member,
  claimed,
  isCurrentUser,
  onClick,
}: {
  member: Member;
  claimed: boolean;
  isCurrentUser: boolean;
  onClick?: () => void;
}) {
  const initials = member.displayName
    .split(" ")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  const [imgError, setImgError] = useState(false);
  const showAvatar = member.avatarUrl && !imgError;

  return (
    <button
      type="button"
      title={`${formatDisplayName(member.displayName)}${claimed ? " (claimed)" : ""}${isCurrentUser ? " — click to toggle" : ""}`}
      onClick={isCurrentUser ? onClick : undefined}
      className={`
        w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden
        transition-all duration-150
        ${claimed
          ? "ring-2 ring-offset-1 ring-amber-400 dark:ring-amber-500 opacity-100"
          : "opacity-30 grayscale"
        }
        ${isCurrentUser ? "cursor-pointer hover:opacity-80 active:scale-95" : "cursor-default"}
        bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300
      `}
    >
      {showAvatar ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={member.avatarUrl!}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </button>
  );
}

// Inline editable field
function InlineEdit({
  value,
  onSave,
  type = "text",
  placeholder,
  disabled,
}: {
  value: string;
  onSave: (val: string) => Promise<void>;
  type?: "text" | "amount";
  placeholder?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    if (editValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(editValue);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        className={`text-left truncate max-w-full ${disabled ? "cursor-default" : "cursor-text hover:text-amber-600 dark:hover:text-amber-400 transition-colors"}`}
        onClick={() => {
          if (!disabled) {
            setEditValue(value);
            setEditing(true);
          }
        }}
      >
        {value || <span className="text-stone-400">{placeholder}</span>}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={editValue}
      disabled={saving}
      className="w-full min-w-0 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
      onChange={(e) => {
        if (type === "amount") {
          setEditValue(filterDecimalInput(e.target.value));
        } else {
          setEditValue(e.target.value);
        }
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

export function GroupBillClient({
  groupId,
  billId,
  currentUserId,
  bill,
  initialItems,
  members,
}: GroupBillClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<GroupBillItem[]>(initialItems);
  const [billStatus, setBillStatus] = useState(bill.status);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paidById, setPaidById] = useState<string>(currentUserId);
  const [finalizing, setFinalizing] = useState(false);
  const [unfinalizing, setUnfinalizing] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [togglingAll, setTogglingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Subscribe to real-time item changes
  useEffect(() => {
    const channel = supabase
      .channel(`group-bill-items:${billId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "GroupBillItem",
          filter: `groupBillId=eq.${billId}`,
        },
        (payload) => {
          setItems((prev) =>
            prev.map((item) =>
              item.id === (payload.new as GroupBillItem).id
                ? { ...item, ...(payload.new as GroupBillItem) }
                : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [billId, supabase]);

  const regularItems = items.filter((i) => !i.isTaxOrTip);
  const taxTipItems = items.filter((i) => i.isTaxOrTip);
  const unclaimedCount = regularItems.filter((i) => i.claimedByUserIds.length === 0).length;
  const currentUserClaimed = regularItems.some((i) =>
    i.claimedByUserIds.includes(currentUserId)
  );

  async function toggleClaim(itemId: string, userId: string) {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const already = item.claimedByUserIds.includes(userId);
        const next = already
          ? item.claimedByUserIds.filter((id) => id !== userId)
          : [...item.claimedByUserIds, userId];
        return { ...item, claimedByUserIds: next };
      })
    );

    try {
      const res = await fetch(
        `/api/groups/${groupId}/bills/${billId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle_claim" }),
        }
      );
      if (!res.ok) {
        // Revert on failure
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== itemId) return item;
            const already = item.claimedByUserIds.includes(userId);
            const next = already
              ? item.claimedByUserIds.filter((id) => id !== userId)
              : [...item.claimedByUserIds, userId];
            return { ...item, claimedByUserIds: next };
          })
        );
      }
    } catch {
      // Revert on error — refetch current state
      const json = await fetch(`/api/groups/${groupId}/bills/${billId}`).then(
        (r) => r.json() as Promise<{ data: { items: GroupBillItem[] } | null }>
      );
      if (json.data?.items) setItems(json.data.items);
    }
  }

  async function toggleAllForUser(include: boolean) {
    if (togglingAll) return;
    setTogglingAll(true);

    // Optimistic: add/remove currentUserId from all regular items
    setItems((prev) =>
      prev.map((item) => {
        if (item.isTaxOrTip) return item;
        if (include) {
          if (item.claimedByUserIds.includes(currentUserId)) return item;
          return { ...item, claimedByUserIds: [...item.claimedByUserIds, currentUserId] };
        } else {
          return {
            ...item,
            claimedByUserIds: item.claimedByUserIds.filter((id) => id !== currentUserId),
          };
        }
      })
    );

    try {
      const itemId = items[0]?.id ?? "none";
      await fetch(
        `/api/groups/${groupId}/bills/${billId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle_all", include }),
        }
      );
    } finally {
      setTogglingAll(false);
    }
  }

  const editItem = useCallback(
    async (itemId: string, update: { description?: string; amountCents?: number }) => {
      const res = await fetch(
        `/api/groups/${groupId}/bills/${billId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "edit", ...update }),
        }
      );
      const json = (await res.json()) as { data: GroupBillItem | null; error: string | null };
      if (json.data) {
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, ...json.data } : item))
        );
      }
    },
    [groupId, billId]
  );

  async function addItem() {
    setAddingItem(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/bills/${billId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "New item",
          amountCents: 0,
          isTaxOrTip: false,
        }),
      });
      const json = (await res.json()) as { data: GroupBillItem | null; error: string | null };
      if (json.data) {
        setItems((prev) => [...prev, json.data!]);
      }
    } finally {
      setAddingItem(false);
    }
  }

  async function deleteItem(itemId: string) {
    // Optimistic
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    const res = await fetch(
      `/api/groups/${groupId}/bills/${billId}/items/${itemId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      // Revert — refetch
      const json = await fetch(`/api/groups/${groupId}/bills/${billId}`).then(
        (r) => r.json() as Promise<{ data: { items: GroupBillItem[] } | null }>
      );
      if (json.data?.items) setItems(json.data.items);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/bills/${billId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paidById }),
        }
      );
      const json = (await res.json()) as { data: unknown; error: string | null };
      if (!res.ok) {
        setFinalizeError(json.error ?? "Failed to finalize.");
        return;
      }
      setShowFinalizeModal(false);
      setBillStatus("finalized");
      setSuccessMessage("Expense created!");
      setTimeout(() => {
        router.push(`/groups/${groupId}`);
      }, 1200);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleUnfinalize() {
    setUnfinalizing(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/bills/${billId}/unfinalize`,
        { method: "POST" }
      );
      if (res.ok) {
        setBillStatus("in_progress");
      }
    } finally {
      setUnfinalizing(false);
    }
  }

  const splits = computeBillSplits(items);
  const totalCents = splits.reduce((sum, s) => sum + s.amountCents, 0);

  if (successMessage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-stone-900 dark:text-white">{successMessage}</p>
        <p className="text-sm text-stone-400">Redirecting to group&hellip;</p>
      </div>
    );
  }

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <Link
            href={`/groups/${groupId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 mb-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to group
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-stone-900 dark:text-white">{bill.name}</h1>
            {billStatus === "finalized" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                </svg>
                Finalized
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Receipt image toggle */}
      {bill.receiptImageSignedUrl && (
        <div className="mb-5">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors cursor-pointer mb-2"
            onClick={() => setShowReceipt((v) => !v)}
          >
            <svg
              className={`w-4 h-4 transition-transform ${showReceipt ? "rotate-90" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
            {showReceipt ? "Hide receipt" : "Show receipt"}
          </button>
          {showReceipt && (
            <div className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 max-h-96">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bill.receiptImageSignedUrl}
                alt="Receipt"
                className="w-full object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Member opt-in/out row */}
      {billStatus === "in_progress" && (
        <div className="mb-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-2.5">
            Your participation
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={togglingAll}
              onClick={() => toggleAllForUser(!currentUserClaimed)}
              className={`
                inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium border transition-all cursor-pointer
                ${currentUserClaimed
                  ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                  : "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400"
                }
                disabled:opacity-50
              `}
            >
              <div className={`w-2 h-2 rounded-full ${currentUserClaimed ? "bg-amber-500" : "bg-stone-400"}`} />
              {currentUserClaimed ? "I'm in (all items)" : "I'm out"}
            </button>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Toggle individual items below
            </p>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-5">
        {/* Regular items */}
        <div>
          <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">
            Items
          </h2>
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
            {regularItems.length === 0 ? (
              <div className="px-4 py-6 text-sm text-stone-400 dark:text-stone-500 text-center">
                No items yet
              </div>
            ) : (
              regularItems.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                  {/* Description + amount */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                      <InlineEdit
                        value={item.description}
                        disabled={billStatus !== "in_progress"}
                        onSave={(val) => editItem(item.id, { description: val })}
                        placeholder="Item description"
                      />
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      <InlineEdit
                        value={(item.amountCents / 100).toFixed(2)}
                        type="amount"
                        disabled={billStatus !== "in_progress"}
                        onSave={(val) => {
                          const cents = Math.round(parseFloat(val) * 100);
                          if (!isNaN(cents) && cents >= 0) {
                            return editItem(item.id, { amountCents: cents });
                          }
                          return Promise.resolve();
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Claim chips */}
                  <div className="flex items-center gap-1 shrink-0">
                    {members.map((member) => (
                      <MemberChip
                        key={member.userId}
                        member={member}
                        claimed={item.claimedByUserIds.includes(member.userId)}
                        isCurrentUser={member.userId === currentUserId}
                        onClick={
                          billStatus === "in_progress"
                            ? () => toggleClaim(item.id, currentUserId)
                            : undefined
                        }
                      />
                    ))}
                  </div>

                  {/* Delete button (in_progress only) */}
                  {billStatus === "in_progress" && (
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="w-5 h-5 flex items-center justify-center text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0 mt-0.5"
                      title="Delete item"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}

            {/* Add item button */}
            {billStatus === "in_progress" && (
              <div className="px-4 py-2.5">
                <button
                  type="button"
                  disabled={addingItem}
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {addingItem ? "Adding…" : "Add item"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tax & Tip items */}
        {taxTipItems.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">
              Tax &amp; Tip
            </h2>
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
              {taxTipItems.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                      {item.description}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                      {formatCents(item.amountCents)} &middot;{" "}
                      <span className="italic">Distributed proportionally</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-person split preview */}
        {splits.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">
              Split preview
            </h2>
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
              {splits.map((s) => {
                const member = members.find((m) => m.userId === s.userId);
                const name = member ? formatDisplayName(member.displayName) : "Unknown";
                return (
                  <div key={s.userId} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-stone-700 dark:text-stone-300">{name}</span>
                    <span className="text-sm font-semibold text-stone-900 dark:text-white">
                      {formatCents(s.amountCents)}
                    </span>
                  </div>
                );
              })}
              <div className="px-4 py-2.5 flex items-center justify-between bg-stone-50 dark:bg-stone-800/50">
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Total
                </span>
                <span className="text-sm font-bold text-stone-900 dark:text-white">
                  {formatCents(totalCents)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-950/90 backdrop-blur-sm px-4 py-3 safe-area-pb">
        <div className="max-w-2xl mx-auto">
          {billStatus === "in_progress" ? (
            <div className="space-y-2">
              {unclaimedCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                  {unclaimedCount} item{unclaimedCount !== 1 ? "s" : ""} still unclaimed
                </p>
              )}
              <div className="flex items-center gap-2">
                {/* Payer selector */}
                <div className="flex-1">
                  <select
                    value={paidById}
                    onChange={(e) => setPaidById(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {formatDisplayName(m.displayName)}
                        {m.userId === currentUserId ? " (you)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={splits.length === 0}
                  onClick={() => {
                    setFinalizeError(null);
                    setShowFinalizeModal(true);
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
                >
                  Finalize
                </button>
              </div>
              <p className="text-xs text-stone-400 dark:text-stone-500 text-center">
                Who paid for this bill?
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-center">
              <span className="text-sm text-stone-500 dark:text-stone-400">
                This bill has been finalized.
              </span>
              <button
                type="button"
                disabled={unfinalizing}
                onClick={handleUnfinalize}
                className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {unfinalizing ? "Unfinalizing…" : "Unfinalize"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Finalize confirmation modal */}
      {showFinalizeModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !finalizing) setShowFinalizeModal(false);
          }}
        >
          <div className="w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden">
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-stone-200 dark:bg-stone-700 rounded-full" />
            </div>

            <div className="px-5 pt-4 pb-5 sm:pt-5">
              <h3 className="text-base font-bold text-stone-900 dark:text-white mb-1">
                Finalize bill?
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                This creates a group expense with the following splits:
              </p>

              <div className="bg-stone-50 dark:bg-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-700 overflow-hidden mb-4">
                {splits.map((s) => {
                  const member = members.find((m) => m.userId === s.userId);
                  const name = member ? formatDisplayName(member.displayName) : "Unknown";
                  return (
                    <div key={s.userId} className="px-3 py-2 flex items-center justify-between">
                      <span className="text-sm text-stone-700 dark:text-stone-300">
                        {name}
                        {s.userId === currentUserId ? (
                          <span className="text-stone-400 ml-1">(you)</span>
                        ) : null}
                      </span>
                      <span className="text-sm font-semibold text-stone-900 dark:text-white">
                        {formatCents(s.amountCents)}
                      </span>
                    </div>
                  );
                })}
                <div className="px-3 py-2 flex items-center justify-between bg-stone-100/70 dark:bg-stone-700/50">
                  <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                    Paid by
                  </span>
                  <span className="text-sm font-bold text-stone-900 dark:text-white">
                    {formatDisplayName(
                      members.find((m) => m.userId === paidById)?.displayName ?? "Unknown"
                    )}
                  </span>
                </div>
              </div>

              {finalizeError && (
                <p className="text-sm text-red-500 dark:text-red-400 mb-3">{finalizeError}</p>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={finalizing}
                  onClick={() => setShowFinalizeModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-stone-200 dark:border-stone-700 rounded-xl text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={finalizing}
                  onClick={handleFinalize}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {finalizing ? "Creating…" : "Create expense"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
