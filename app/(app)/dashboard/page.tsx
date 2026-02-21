import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import CreateGroupButton from "./CreateGroupButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // user is guaranteed by layout, but TypeScript needs this check
  if (!user) return null;

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: { group: true },
    orderBy: { group: { createdAt: "desc" } },
  });

  const groups = memberships.map((m) => m.group);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Your groups</h1>
        <CreateGroupButton userId={user.id} />
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No groups yet</p>
          <p className="text-sm">Create a group to start splitting expenses.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id}>
              <a
                href={`/groups/${group.id}`}
                className="block bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-gray-400 transition-colors"
              >
                <span className="font-medium">{group.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
