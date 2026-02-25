import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGroupSchema } from "@aviary/shared";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = createGroupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name } = parsed.data;

  const { data: groupId, error } = await supabase.rpc("create_group", { _name: name });

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  // Fetch the created group to return it
  const { data: group } = await supabase
    .from("Group")
    .select("*")
    .eq("id", groupId)
    .single();

  return NextResponse.json({ data: group, error: null }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: memberships } = await supabase
    .from("GroupMember")
    .select("*, Group(*)")
    .eq("userId", user.id);

  const groups = (memberships ?? [])
    .map((m) => m.Group!)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ data: groups, error: null });
}
