"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CreateGroupBillDialog } from "./CreateGroupBillDialog";
import type { GroupBillSummary } from "@aviary/shared";
import type { Member } from "./ExpensesList";

interface GroupBillsSectionProps {
  groupId: string;
  currentUserId: string;
  initialBills: GroupBillSummary[];
  members: Member[];
}

export function GroupBillsSection({
  groupId,
  initialBills,
}: GroupBillsSectionProps) {
  const router = useRouter();
  const [bills, setBills] = useState<GroupBillSummary[]>(initialBills);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleCreated(newBill: { id: string }) {
    // Navigate to the new bill detail page
    router.push(`/groups/${groupId}/bills/${newBill.id}`);
    setDialogOpen(false);
    // Refresh to pick up the new bill in the list
    router.refresh();
  }

  const inProgressBills = bills.filter((b) => b.status === "in_progress");

  return (
    <section>
      {inProgressBills.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Group Bills</h2>
          </div>
          <ul className="space-y-2 mb-3">
            {inProgressBills.map((bill) => (
              <li key={bill.id}>
                <Link
                  href={`/groups/${groupId}/bills/${bill.id}`}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl"
                >
                  <Card className="px-3 sm:px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Receipt icon */}
                      <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                          <circle cx="12" cy="13" r="3" />
                        </svg>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                          {bill.name}
                        </p>
                        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                          {bill.itemCount} item{bill.itemCount !== 1 ? "s" : ""}
                          {bill.unclaimedCount > 0 && (
                            <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-medium">
                              · {bill.unclaimedCount} unclaimed
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Status badge + chevron */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                          Active
                        </span>
                        <svg
                          className="w-4 h-4 text-stone-300 dark:text-stone-600"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Scan Receipt button — always visible */}
      <Button
        type="button"
        variant="secondary"
        onClick={() => setDialogOpen(true)}
        className="w-full sm:w-auto flex items-center gap-2 justify-center"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
        Scan Receipt
      </Button>

      <CreateGroupBillDialog
        groupId={groupId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
    </section>
  );
}
