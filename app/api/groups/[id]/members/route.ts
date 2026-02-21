import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
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
  const requestingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });

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
  const targetUser = await prisma.user.findUnique({ where: { email } });

  if (!targetUser) {
    return NextResponse.json(
      { data: null, error: "No user found with that email address" },
      { status: 404 }
    );
  }

  // Check if already a member
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUser.id } },
  });

  if (existing) {
    return NextResponse.json(
      { data: null, error: "That user is already a member of this group" },
      { status: 409 }
    );
  }

  const member = await prisma.groupMember.create({
    data: { groupId, userId: targetUser.id },
    include: { user: true },
  });

  return NextResponse.json({ data: member, error: null }, { status: 201 });
}
