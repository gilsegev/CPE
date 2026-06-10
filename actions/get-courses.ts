import { db } from "@/lib/db";
import { readItems } from "@directus/sdk";
import { getProgress } from "@/actions/get-progress";

type CourseWithProgressWithCategory = any; // Interface mapped to UI requirements

type GetCourses = {
  userId: string;
  title?: string;
  categoryId?: string; // Kept for interface compatibility but ignored since Directus has no Categories collection
};

export const getCourses = async ({
  userId,
  title,
  categoryId
}: GetCourses): Promise<CourseWithProgressWithCategory[]> => {
  try {
    // 1. Fetch published courses matching the title filter
    const courses = await db.request(
      readItems("Courses", {
        filter: {
          is_published: { _eq: true },
          ...(title ? { title: { _contains: title } } : {}),
        },
        fields: ["id", "title", "description", "price", "is_published", "thumbnail_url"],
      })
    );

    // 2. Fetch all active purchases for the current user
    const purchases = await db.request(
      readItems("Purchases", {
        filter: {
          user_id: { _eq: userId },
          status: { _eq: "active" },
        },
        fields: ["course_id"],
      })
    );

    const purchasedCourseIds = new Set(purchases.map((p) => p.course_id));

    // 3. Map courses and fetch their respective modules and progress
    const coursesWithProgress = await Promise.all(
      courses.map(async (course) => {
        // Fetch course modules (mapped as chapters in the frontend UI)
        const modules = await db.request(
          readItems("Modules", {
            filter: {
              course_id: { _eq: course.id },
            },
            fields: ["id"],
          })
        );

        const hasPurchased = purchasedCourseIds.has(course.id);
        let progress: number | null = null;

        if (hasPurchased) {
          progress = await getProgress(userId, course.id);
        }

        const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app';
        const imageUrl = course.thumbnail_url
          ? `${directusUrl}/assets/${course.thumbnail_url}`
          : null;

        return {
          id: course.id,
          title: course.title,
          description: course.description || "",
          price: Number(course.price) || 0,
          isPublished: course.is_published,
          imageUrl,
          category: null, // No category system in current Phase 1 schema
          chapters: modules.map((m) => ({ id: m.id })), // Map to chapters for frontend routing
          progress,
        };
      })
    );

    return coursesWithProgress;
  } catch (error) {
    console.error("[GET_COURSES_ERROR]", error);
    return [];
  }
};