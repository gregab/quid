import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  // 1. Clean up all app data (leave groups, delete User row)
  const { error: rpcError } = await supabase.rpc("delete_account");

  if (rpcError) {
    return NextResponse.json({ data: null, error: rpcError.message }, { status: 500 });
  }

  // 2. Delete the auth user via admin client
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return NextResponse.json({ data: null, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { deleted: true }, error: null });
}
