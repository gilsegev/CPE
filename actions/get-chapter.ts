import { db } from "@/lib/db";
import { readItems, readItem } from "@directus/sdk";

interface GetChapterProps {
  userId?: string | null;
  courseId: string;
  chapterId: string; // Map to module_id
}

export const getChapter = async ({
  userId,
  courseId,
  chapterId,
}: GetChapterProps) => {
  try {
    // 1. Fetch purchase status for the course
    const purchases = userId ? await db.request(
      readItems("Purchases", {
        filter: {
          user_id: { _eq: userId },
          course_id: { _eq: courseId },
          status: { _eq: "active" },
        },
        limit: 1,
      })
    ) : [];
    const purchase = purchases[0] || null;

    // 2. Fetch course pricing
    const courseRaw = await db.request(
      readItem("Courses", courseId, {
        fields: ["price", "is_published"],
      })
    );
    if (!courseRaw || !courseRaw.is_published) {
      throw new Error("Course not found or unpublished");
    }

    const course = {
      price: Number(courseRaw.price) || 0,
    };

    // 3. Fetch specific module (chapter) details
    const moduleRaw = await db.request(
      readItem("Modules", chapterId, {
        fields: ["id", "title", "order_index", "mux_asset_id", "is_free_preview", "type"],
      })
    );
    if (!moduleRaw) {
      throw new Error("Module not found");
    }

    const chapter = {
      id: moduleRaw.id,
      title: moduleRaw.title,
      position: moduleRaw.order_index,
      isPublished: true,
      isFree: moduleRaw.is_free_preview,
      type: moduleRaw.type || 'video',
      videoUrl: null,
      description: "",
    };

    // Fetch all course modules to compute progress lock constraints
    const courseModules = await db.request(
      readItems("Modules", {
        filter: {
          course_id: { _eq: courseId },
        },
        sort: ["order_index"],
        fields: ["id", "is_free_preview", "type", "order_index"],
      })
    );

    const allProgresses = userId ? await db.request(
      readItems("UserProgress", {
        filter: {
          user_id: { _eq: userId },
          module_id: { _in: courseModules.map((m) => m.id) },
        },
        fields: ["module_id", "is_completed"],
      })
    ) : [];

    const progressMap = new Map(allProgresses.map((p) => [p.module_id, p.is_completed]));

    // Compute locked state based on purchase and preceding completion rules
    let isLocked = false;
    if (!moduleRaw.is_free_preview && !purchase) {
      isLocked = true;
    } else if (purchase) {
      const currentIndex = courseModules.findIndex((m) => m.id === chapterId);
      if (moduleRaw.type === 'quiz') {
        // Locked if any preceding 'video' module is not completed
        isLocked = courseModules.slice(0, currentIndex).some((m) => {
          return (m.type === 'video' || !m.type) && !progressMap.get(m.id);
        });
      } else if (moduleRaw.type === 'essay') {
        // Locked if any preceding 'video' or 'quiz' module is not completed
        isLocked = courseModules.slice(0, currentIndex).some((m) => {
          return !progressMap.get(m.id);
        });
      }
    }

    let muxData = null;
    let nextChapter = null;
    const attachments: any[] = []; // Attachments not used in current Phase 1 schema

    if (!isLocked) {
      // Map custom Directus field mux_asset_id directly to the expected UI muxData object
      if (moduleRaw.mux_asset_id) {
        muxData = {
          playbackId: moduleRaw.mux_asset_id,
          assetId: moduleRaw.mux_asset_id,
        };
      }

      // 4. Fetch next module (chapter) for autoplay/navigation
      const nextModules = await db.request(
        readItems("Modules", {
          filter: {
            course_id: { _eq: courseId },
            order_index: { _gt: moduleRaw.order_index },
          },
          sort: ["order_index"],
          limit: 1,
          fields: ["id", "title", "order_index", "is_free_preview", "type"],
        })
      );

      if (nextModules[0]) {
        nextChapter = {
          id: nextModules[0].id,
          title: nextModules[0].title,
          position: nextModules[0].order_index,
          isPublished: true,
          isFree: nextModules[0].is_free_preview,
          type: nextModules[0].type || 'video',
        };
      }
    }

    // 5. Fetch user progress for this module
    const progresses = userId ? await db.request(
      readItems("UserProgress", {
        filter: {
          user_id: { _eq: userId },
          module_id: { _eq: chapterId },
        },
        limit: 1,
        fields: ["id", "is_completed"],
      })
    ) : [];

    const userProgress = progresses[0]
      ? { id: progresses[0].id, isCompleted: progresses[0].is_completed }
      : null;

    return {
      chapter,
      course,
      muxData,
      attachments,
      nextChapter,
      userProgress,
      purchase,
      isLocked,
    };
  } catch (error) {
    console.error("[GET_CHAPTER_ERROR]", error);
    return {
      chapter: null,
      course: null,
      muxData: null,
      attachments: [],
      nextChapter: null,
      userProgress: null,
      purchase: null,
    };
  }
};