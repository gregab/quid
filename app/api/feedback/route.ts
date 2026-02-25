import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { feedbackSchema } from "@aviary/shared";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { message, metadata } = parsed.data;

  const { error } = await supabase.from("Feedback").insert({
    userId: user.id,
    message: message.trim(),
    metadata: metadata ?? {},
  });

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { submitted: true }, error: null }, { status: 201 });
}
