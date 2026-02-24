import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // Validate cron secret to prevent unauthorized invocations
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ data: null, error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  // Use admin client (service role) to bypass RLS
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("process_due_recurring_expenses");

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { processed: data }, error: null });
}
