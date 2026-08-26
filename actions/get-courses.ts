import { publicDb } from "@/lib/db";
import { readItems } from "@directus/sdk";
import { getProgress } from "@/actions/get-progress";
import { getSessionClient } from "@/lib/auth";

type CourseWithProgressWithCategory = any; // Interface mapped to UI requirements

type GetCourses = {
  userId?: string | null;
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
    const courses = await publicDb.request(
      readItems("Courses", {
        filter: {
          is_published: { _eq: true },
          ...(title ? { title: { _icontains: title } } : {}),
        },
        fields: ["id", "title", "description", "price", "is_published", "thumbnail_url"],
      })
    );

    // 2. Fetch all active purchases for the current user (if logged in)
    const purchasedCourseIds = new Set<string>();
    const sessionDb = userId ? await getSessionClient() : null;
    if (userId) {
      if (!sessionDb) {
        console.warn("[GET_COURSES] User session is unavailable; returning the public catalog without purchase state.");
      } else {
        try {
          const purchases = await sessionDb.request(
            readItems("Purchases", {
              filter: {
                user_id: { _eq: userId },
                status: { _eq: "active" },
              },
              fields: ["course_id"],
            })
          );
          purchases.forEach((p) => purchasedCourseIds.add(p.course_id));
        } catch (error) {
          // Purchase state must never make the public course catalog disappear.
          console.error("[GET_COURSE_PURCHASES_ERROR]", error);
        }
      }
    }

    // 3. Map courses and fetch their respective modules and progress
    const coursesWithProgress = await Promise.all(
      courses.map(async (course) => {
        // Fetch course modules (mapped as chapters in the frontend UI)
        const modules = await publicDb.request(
          readItems("Modules", {
            filter: {
              course_id: { _eq: course.id },
            },
            fields: ["id"],
          })
        );

        const hasPurchased = purchasedCourseIds.has(course.id);
        let progress: number | null = null;

        if (hasPurchased && userId && sessionDb) {
          progress = await getProgress(userId, course.id, sessionDb);
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
