import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateSettingsSchema } from "@aviary/shared";

export async function PUT(
  request: NextRequest,
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

  const { data: membership } = await supabase
    .from("GroupMember")
    .select("id")
    .eq("groupId", groupId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  const body: unknown = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const updates: { name?: string; bannerUrl?: string | null } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if ("bannerUrl" in parsed.data) updates.bannerUrl = parsed.data.bannerUrl ?? null;

  const { data, error } = await supabase
    .from("Group")
    .update(updates)
    .eq("id", groupId)
    .select("id, name, bannerUrl")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
