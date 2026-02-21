import Link from "next/link";
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
        <h1 className="text-2xl font-bold text-gray-900">Your groups</h1>
        <CreateGroupButton userId={user.id} />
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">💸</div>
          <p className="text-lg font-medium text-gray-600 mb-1">No groups yet</p>
          <p className="text-sm">Create a group to start splitting expenses.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 hover:shadow-md transition-all duration-150 group"
              >
                <span className="font-semibold text-gray-900">{group.name}</span>
                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
