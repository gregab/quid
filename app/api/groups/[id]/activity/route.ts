import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const QuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("GroupMember")
    .select("id")
    .eq("groupId", groupId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const parsed = QuerySchema.safeParse({
    before: searchParams.get("before") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "Invalid query" }, { status: 400 });
  }

  const { before, limit } = parsed.data;

  // Fetch one extra to detect whether there are more pages.
  let query = supabase
    .from("ActivityLog")
    .select("*, User!actorId(displayName)")
    .eq("groupId", groupId)
    .order("createdAt", { ascending: false })
    .limit(limit + 1);

  if (before) {
    query = query.lt("createdAt", before);
  }

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  const hasMore = logs.length > limit;
  const sliced = hasMore ? logs.slice(0, limit) : logs;

  const transformed = sliced.map((log) => ({
    ...log,
    actor: log.User ?? { displayName: "Deleted User" },
  }));

  return NextResponse.json({ data: { logs: transformed, hasMore } });
}
