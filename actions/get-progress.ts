import { db } from "@/lib/db";
import { readItems } from "@directus/sdk";

export const getProgress = async (
  userId: string,
  courseId: string,
): Promise<number> => {
  try {
    // 1. Fetch all modules for the course
    const modules = await db.request(
      readItems("Modules", {
        filter: {
          course_id: { _eq: courseId },
        },
        fields: ["id"],
      })
    );

    const moduleIds = modules.map((m) => m.id);
    if (moduleIds.length === 0) {
      return 0;
    }

    // 2. Fetch completed modules for this user that belong to this course
    const completedProgress = await db.request(
      readItems("UserProgress", {
        filter: {
          user_id: { _eq: userId },
          module_id: { _in: moduleIds },
          is_completed: { _eq: true },
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
