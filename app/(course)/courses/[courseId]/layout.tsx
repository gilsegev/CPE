import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readItem, readItems } from "@directus/sdk";
import { getProgress } from "@/actions/get-progress";

import { CourseSidebar } from "./_components/course-sidebar";
import { CourseNavbar } from "./_components/course-navbar";

const CourseLayout = async ({
  children,
  params
}: {
  children: React.ReactNode;
  params: { courseId: string };
}) => {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // 1. Fetch course details from Directus
  const courseRaw = await db.request(
    readItem("Courses", params.courseId, {
      fields: ["id", "title", "description", "price", "is_published", "thumbnail_url"],
    })
  );

  if (!courseRaw || !courseRaw.is_published) {
    return redirect("/");
  }

  // 2. Fetch course modules (chapters)
  const modules = await db.request(
    readItems("Modules", {
      filter: {
        course_id: { _eq: params.courseId },
      },
      sort: ["order_index"],
      fields: ["id", "title", "order_index", "mux_asset_id", "is_free_preview"],
    })
  );

  const moduleIds = modules.map((m) => m.id);

  // 3. Fetch progress for these modules for the current user
  const progresses = moduleIds.length > 0 ? await db.request(
    readItems("UserProgress", {
      filter: {
        user_id: { _eq: user.id },
        module_id: { _in: moduleIds },
      },
      fields: ["id", "module_id", "is_completed"],
    })
  ) : [];

  const progressMap = new Map(progresses.map((p) => [p.module_id, p]));

  // 4. Map properties from Directus naming to frontend component expectations
  const course = {
    id: courseRaw.id,
    title: courseRaw.title,
    description: courseRaw.description,
    price: Number(courseRaw.price) || 0,
    isPublished: courseRaw.is_published,
    imageUrl: courseRaw.thumbnail_url || null,
    chapters: modules.map((m) => {
      const prog = progressMap.get(m.id);
      return {
        id: m.id,
        title: m.title,
        position: m.order_index,
        isPublished: true,
        isFree: m.is_free_preview,
        userProgress: prog ? [{ id: prog.id, isCompleted: prog.is_completed, userId: user.id, chapterId: m.id }] : null,
      };
    }),
  };

  const progressCount = await getProgress(user.id, course.id);

  return (
    <div className="h-full">
      <div className="h-[80px] md:pl-80 fixed inset-y-0 w-full z-50">
        <CourseNavbar
          course={course}
          progressCount={progressCount}
        />
      </div>
      <div className="hidden md:flex h-full w-80 flex-col fixed inset-y-0 z-50">
        <CourseSidebar
          course={course}
          progressCount={progressCount}
        />
      </div>
      <main className="md:pl-80 pt-[80px] h-full">
        {children}
      </main>
    </div>
  );
};

export default CourseLayout;