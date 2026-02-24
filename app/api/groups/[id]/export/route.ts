import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGroupExportData, type ExportExpense, type ExportMember } from "@/lib/export/buildExportData";
import { generateSpreadsheet } from "@/lib/export/generateSpreadsheet";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await params;

  // Verify membership
  const { data: membership } = await supabase
    .from("GroupMember")
    .select("id")
    .eq("groupId", groupId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  // Fetch group, members, and expenses in parallel
  const [groupResult, membersResult, expensesResult] = await Promise.all([
    supabase.from("Group").select("name").eq("id", groupId).single(),
    supabase.from("GroupMember").select("*, User(*)").eq("groupId", groupId),
    supabase
      .from("Expense")
      .select("*, User!paidById(displayName), ExpenseSplit(*, User(displayName))")
      .eq("groupId", groupId),
  ]);

  const groupName = groupResult.data?.name ?? "Group";
  const members = membersResult.data ?? [];
  const expenses = expensesResult.data ?? [];

  // Build display name map (handles departed members)
  const allUserNames: Record<string, string> = {};
  for (const m of members) {
    if (m.User) allUserNames[m.userId] = m.User.displayName;
  }
  for (const expense of expenses) {
    if (expense.User) allUserNames[expense.paidById] = expense.User.displayName;
    for (const split of expense.ExpenseSplit ?? []) {
      const name = (split as { User?: { displayName: string } | null }).User?.displayName;
      if (name) allUserNames[split.userId] = name;
    }
  }

  const exportMembers: ExportMember[] = members.map((m) => ({
    userId: m.userId,
    displayName: m.User?.displayName ?? "Unknown",
  }));

  const exportExpenses: ExportExpense[] = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    date: e.date.split("T")[0]!,
    paidById: e.paidById,
    isPayment: e.isPayment,
    splits: (e.ExpenseSplit ?? []).map((s) => ({
      userId: s.userId,
      amountCents: s.amountCents,
    })),
  }));

  const exportData = buildGroupExportData(
    groupName,
    user.id,
    exportExpenses,
    exportMembers,
    allUserNames
  );

  const buffer = await generateSpreadsheet(exportData);

  // Sanitize group name for filename
  const safeGroupName = groupName.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "group";
  const filename = `${safeGroupName} - Expenses.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
