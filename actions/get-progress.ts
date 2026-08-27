import { db } from "@/lib/db";
import { readItem, readItems } from "@directus/sdk";
import { isV2ContentModule } from "@/lib/course-completion-rules";

export const getProgress = async (
  userId: string,
  courseId: string,
): Promise<number> => {
  try {
    const course = await db.request(
      readItem("Courses", courseId, { fields: ["id", "structure_version"] }),
    );
    const isV2 = course.structure_version === "module_quiz_v2";

    if (isV2) {
      const completions = await db.request(
        readItems("CourseCompletions", {
          filter: { user_id: { _eq: userId }, course_id: { _eq: courseId } },
          fields: ["id"],
          limit: 1,
        }),
      );
      if (completions[0]) return 100;
    }

    const allModules = await db.request(
      readItems("Modules", {
        filter: {
          course_id: { _eq: courseId },
        },
        fields: ["id", "type", "migration_status"],
      })
    );
    const modules = isV2 ? allModules.filter(isV2ContentModule) : allModules;

    const moduleIds = modules.map((m) => m.id);
    if (moduleIds.length === 0) {
      return 0;
    }

    const completedProgress = await db.request(
      readItems("UserProgress", {
        filter: {
          user_id: { _eq: userId },
          module_id: { _in: moduleIds },
          ...(isV2 ? { completed_at: { _nnull: true } } : { is_completed: { _eq: true } }),
        },
        fields: ["id"],
      })
    );

    const progressPercentage = (completedProgress.length / moduleIds.length) * 100;

    return Math.round(progressPercentage);
  } catch (error) {
    console.error("[GET_PROGRESS_ERROR]", error);
    return 0;
  }
};
