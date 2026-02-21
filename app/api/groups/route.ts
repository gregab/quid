import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
});

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

  const group = await prisma.group.create({
    data: {
      name,
      createdById: user.id,
      members: {
        create: { userId: user.id },
      },
    },
  });

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

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: { group: true },
    orderBy: { group: { createdAt: "desc" } },
  });

  const groups = memberships.map((m) => m.group);
  return NextResponse.json({ data: groups, error: null });
}
