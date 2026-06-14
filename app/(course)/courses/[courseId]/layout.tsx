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
  const userId = user?.id;

  if (user && (!user.legal_name || user.legal_name.trim() === "")) {
    return redirect("/confirm-profile");
  }

  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app';

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
      fields: ["id", "title", "order_index", "mux_asset_id", "is_free_preview", "type"],
    })
  );

  const moduleIds = modules.map((m) => m.id);

  // 3. Fetch progress for these modules for the current user
  const progresses = (moduleIds.length > 0 && userId) ? await db.request(
    readItems("UserProgress", {
      filter: {
        user_id: { _eq: userId },
        module_id: { _in: moduleIds },
      },
      fields: ["id", "module_id", "is_completed"],
    })
  ) : [];

  const progressMap = new Map(progresses.map((p) => [p.module_id, p.is_completed]));

  // Fetch active purchase for the user
  const purchases = userId ? await db.request(
    readItems("Purchases", {
      filter: {
        user_id: { _eq: userId },
        course_id: { _eq: params.courseId },
        status: { _eq: "active" },
      },
      limit: 1,
    })
  ) : [];
  const purchase = purchases[0] || null;

  const imageUrl = courseRaw.thumbnail_url
    ? `${directusUrl}/assets/${courseRaw.thumbnail_url}`
    : null;

  // 4. Map properties from Directus naming to frontend component expectations
  const course = {
    id: courseRaw.id,
    title: courseRaw.title,
    description: courseRaw.description,
    price: Number(courseRaw.price) || 0,
    isPublished: courseRaw.is_published,
    imageUrl,
    chapters: modules.map((m, index) => {
      const isCompleted = !!progressMap.get(m.id);

      // Compute locked state based on purchase and preceding completion rules
      let isLocked = false;
      if (!m.is_free_preview && !purchase) {
        isLocked = true;
      } else if (purchase) {
        if (m.type === 'quiz') {
          // Locked if any preceding 'video' module is not completed
          isLocked = modules.slice(0, index).some((prev) => {
            return (prev.type === 'video' || !prev.type) && !progressMap.get(prev.id);
          });
        } else if (m.type === 'essay') {
          // Locked if any preceding 'video' or 'quiz' module is not completed
          isLocked = modules.slice(0, index).some((prev) => {
            return !progressMap.get(prev.id);
          });
        }
      }

      return {
        id: m.id,
        title: m.title,
        position: m.order_index,
        isPublished: true,
        isFree: m.is_free_preview,
        type: m.type || 'video',
        isLocked,
        userProgress: isCompleted && userId ? [{ id: m.id, isCompleted, userId, chapterId: m.id }] : null,
      };
    }),
  };

  const progressCount = userId ? await getProgress(userId, course.id) : 0;

  return (
    <div className="h-full">
      <div className="h-[80px] fixed inset-x-0 top-0 z-50">
        <CourseNavbar
          course={course}
          progressCount={progressCount}
        />
      </div>
      <div className="hidden md:flex h-[calc(100vh-80px)] w-80 flex-col fixed top-20 left-0 z-50">
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