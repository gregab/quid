import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;

  const { data, error } = await supabase.rpc("join_group_by_token", { _token: token });

  if (error) {
    const status = error.message.includes("Invalid invite token") ? 404 : 500;
    return NextResponse.json({ data: null, error: error.message }, { status });
  }

  const result = data as { groupId: string; alreadyMember: boolean };
  return NextResponse.json({ data: result, error: null });
}
