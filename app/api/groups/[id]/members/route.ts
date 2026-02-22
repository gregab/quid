import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(
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

  // Verify the requesting user is a member of the group
  const { data: requestingMember } = await supabase
    .from("GroupMember")
    .select("id")
    .eq("groupId", groupId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!requestingMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  const body: unknown = await request.json();
  const parsed = addMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Look up the user by email
  const { data: targetUser } = await supabase
    .from("User")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json(
      { data: null, error: "No user found with that email address" },
      { status: 404 }
    );
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("GroupMember")
    .select("id")
    .eq("groupId", groupId)
    .eq("userId", targetUser.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { data: null, error: "That user is already a member of this group" },
      { status: 409 }
    );
  }

  const { data: member, error } = await supabase
    .from("GroupMember")
    .insert({ groupId, userId: targetUser.id })
    .select("*, User(*)")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: member, error: null }, { status: 201 });
}

export async function DELETE(
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

  // Verify the requesting user is a member of the group
  const { data: requestingMember } = await supabase
    .from("GroupMember")
    .select("id")
    .eq("groupId", groupId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!requestingMember) {
    return NextResponse.json({ data: null, error: "Not a member of this group" }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("leave_group", { _group_id: groupId });

  if (error) {
    // RPC raises exceptions for balance checks and membership issues
    return NextResponse.json({ data: null, error: error.message }, { status: 400 });
  }

  const result = data as { deleted_group: boolean };
  return NextResponse.json({ data: { deletedGroup: result.deleted_group }, error: null });
}
