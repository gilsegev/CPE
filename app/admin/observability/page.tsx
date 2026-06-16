import { redirect } from "next/navigation";
import { readItems } from "@directus/sdk";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ObservabilityClient } from "./_components/observability-client";

export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const isUserAdmin = await isAdmin(user.id);
  if (!isUserAdmin) {
    redirect("/search");
  }

  // Fetch the last 2000 logs using the Admin client to populate dashboard metrics
  const logs = await db.request(
    readItems("UserActivityLogs", {
      sort: ["-timestamp"],
      limit: 2000,
      fields: ["*", "user_id.email" as any],
    })
  );

  // Fetch all courses and modules to resolve IDs to names in visitor flow maps
  const courses = await db.request(
    readItems("Courses", {
      fields: ["id", "title"],
    })
  );

  const modules = await db.request(
    readItems("Modules", {
      fields: ["id", "title"],
    })
  );

  const courseMap: Record<string, string> = {};
  courses.forEach((c) => {
    courseMap[c.id] = c.title;
  });

  const moduleMap: Record<string, string> = {};
  modules.forEach((m) => {
    moduleMap[m.id] = m.title;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            System Observability & Conversion Analytics
          </h1>
          <p className="text-slate-400 mt-1">
            Real-time tracking of visitor traffic, interactive engagement, and checkout conversion performance.
          </p>
        </div>

        <ObservabilityClient 
          initialLogs={logs as any[]} 
          courseMap={courseMap}
          moduleMap={moduleMap}
        />
      </div>
    </div>
  );
}
