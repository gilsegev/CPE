import { db } from "@/lib/db";
import { readItems } from "@directus/sdk";
import { getProgress } from "@/actions/get-progress";
import { calculateCpeTotal, isV2ContentModule, relationId } from "@/lib/course-completion-rules";

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
          is_published: { _eq: true },
        },
        fields: ["id", "title", "description", "price", "is_published", "thumbnail_url", "structure_version", "cpe_hours"],
      })
    );

    const completions = await db.request(
      readItems("CourseCompletions", {
        filter: { user_id: { _eq: userId }, course_id: { _in: courseIds } },
        fields: ["id", "course_id", "completed_at", "cpe_earned"],
      }),
    );
    const completionByCourse = new Map(completions.map((completion) => [relationId(completion.course_id), completion]));
    const completionIds = completions.map((completion) => completion.id);
    const feedbackResponses = completionIds.length > 0 ? await db.request(
      readItems("FeedbackResponses", {
        filter: { completion_id: { _in: completionIds } },
        fields: ["id", "completion_id"],
      }),
    ) : [];
    const feedbackCompletionIds = new Set(feedbackResponses.map((response) => relationId(response.completion_id)));
    const certificates = completionIds.length > 0 ? await db.request(
      readItems("Certificates", {
        filter: { completion_id: { _in: completionIds } },
        fields: ["id", "completion_id", "status", "pdf_url", "issued_date"],
      }),
    ) : [];
    const certificateByCompletion = new Map(certificates.map((certificate) => [relationId(certificate.completion_id), certificate]));

    // 3. Populate course details, modules (chapters), and progress
    const coursesWithProgress = await Promise.all(
      courses.map(async (course) => {
        const allModules = await db.request(
          readItems("Modules", {
            filter: {
              course_id: { _eq: course.id },
            },
            fields: ["id", "title", "order_index", "mux_asset_id", "is_free_preview", "type", "migration_status", "cpe_value"],
          })
        );
        const isV2 = course.structure_version === "module_quiz_v2";
        const modules = isV2 ? allModules.filter(isV2ContentModule) : allModules;

        const progress = await getProgress(userId, course.id);
        const completion = completionByCourse.get(course.id) || null;
        const certificate = completion ? certificateByCompletion.get(completion.id) || null : null;

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
          category: null,
          chapters: modules.map((m) => ({
            id: m.id,
            title: m.title,
            position: m.order_index,
            isPublished: true,
            isFree: m.is_free_preview,
          })),
          progress,
          isCompleted: isV2 ? Boolean(completion) : progress === 100,
          cpeValue: completion?.cpe_earned ?? (isV2 ? calculateCpeTotal(modules) : Number(course.cpe_hours || 0)),
          completedAt: completion?.completed_at || null,
          completionId: completion?.id || null,
          feedbackSubmitted: completion ? feedbackCompletionIds.has(completion.id) : false,
          certificate: completion ? {
            id: certificate?.id || "",
            status: certificate?.status || "pending",
            pdfUrl: certificate?.pdf_url || null,
            issuedDate: certificate?.issued_date || null,
          } : null,
        };
      })
    );

    const completedCourses = coursesWithProgress.filter((course) => course.isCompleted);
    const coursesInProgress = coursesWithProgress.filter((course) => !course.isCompleted);

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
