import { db } from "@/lib/db";
import { readItems } from "@directus/sdk";
import { getProgress } from "@/actions/get-progress";

export const getDashboardCourses = async (userId: string) => {
  try {
    // 1. Fetch active purchases for the user
    const purchases = await db.request(
      readItems("Purchases", {
        filter: {
          user_id: { _eq: userId },
          status: { _eq: "active" },
        },
        fields: ["course_id"],
      })
    );

    const courseIds = purchases.map((p) => p.course_id);
    if (courseIds.length === 0) {
      return {
        completedCourses: [],
        coursesInProgress: [],
      };
    }

    // 2. Fetch the purchased courses
    const courses = await db.request(
      readItems("Courses", {
        filter: {
          id: { _in: courseIds },
        },
        fields: ["id", "title", "description", "price", "is_published", "thumbnail_url"],
      })
    );

    // 3. Populate course details, modules (chapters), and progress
    const coursesWithProgress = await Promise.all(
      courses.map(async (course) => {
        const modules = await db.request(
          readItems("Modules", {
            filter: {
              course_id: { _eq: course.id },
            },
            fields: ["id", "title", "order_index", "mux_asset_id", "is_free_preview"],
          })
        );

        const progress = await getProgress(userId, course.id);

        return {
          id: course.id,
          title: course.title,
          description: course.description || "",
          price: Number(course.price) || 0,
          isPublished: course.is_published,
          thumbnailUrl: course.thumbnail_url || null,
          category: null,
          chapters: modules.map((m) => ({
            id: m.id,
            title: m.title,
            position: m.order_index,
            isPublished: true,
            isFree: m.is_free_preview,
          })),
          progress,
        };
      })
    );

    const completedCourses = coursesWithProgress.filter((course) => course.progress === 100);
    const coursesInProgress = coursesWithProgress.filter((course) => (course.progress ?? 0) < 100);

    return {
      completedCourses,
      coursesInProgress,
    };
  } catch (error) {
    console.error("[GET_DASHBOARD_COURSES_ERROR]", error);
    return {
      completedCourses: [],
      coursesInProgress: [],
    };
  }
};