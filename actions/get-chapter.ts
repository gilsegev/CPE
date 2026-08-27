import { db, type CourseContentItem } from "@/lib/db";
import { readItems, readItem } from "@directus/sdk";
import { calculateCpeTotal, isV2ContentModule, relationId } from "@/lib/course-completion-rules";

interface GetChapterProps {
  userId?: string | null;
  courseId: string;
  chapterId: string; // Map to module_id
}

export interface CourseDetails {
  title: string;
  structureVersion: "legacy" | "module_quiz_v2";
  subtitle?: string | null;
  cpeHours: number | null;
  estimatedDuration?: string | null;
  deliveryFormat?: string | null;
  instructor?: string | null;
  instructorHeading?: string | null;
  instructorBio?: string | null;
  instructorPhotoUrl?: string | null;
  ctaLabel?: string | null;
  benefitHeading?: string | null;
  benefitDescription?: string | null;
  benefits: string[];
  learningObjectives: string[];
  courseContents: CourseContentItem[];
  cpeTrustHeading?: string | null;
  cpeTrustDescription?: string | null;
  cpeProviderNumber?: string | null;
  cpeProviderListingUrl?: string | null;
  price: number;
  imageUrl: string | null;
}

const defaultCourseContents: CourseContentItem[] = [
  {
    title: "Breaking Down ADHD",
    duration_minutes: 45,
    description: "Learn how ADHD affects attention, executive functioning, and behavior in the classroom.",
  },
  {
    title: "Knowledge Check",
    duration_minutes: 10,
    description: "Confirm your understanding of the course's key concepts and classroom strategies.",
  },
  {
    title: "Course Evaluation and Certificate",
    duration_minutes: 5,
    description: "Share course feedback and complete the requirements for your CPE certificate.",
  },
];

const parseCourseContents = (value: unknown): CourseContentItem[] => {
  if (!Array.isArray(value)) return defaultCourseContents;

  const items = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
    const durationMinutes = Number(candidate.duration_minutes);

    if (!title || !description || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];

    return [{ title, description, duration_minutes: durationMinutes }];
  });

  return items.length > 0 ? items : defaultCourseContents;
};

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

    // 2. Fetch course marketing details for the pre-enrollment hero
    const courseRaw = await db.request(
      readItem("Courses", courseId, {
        fields: [
          "title",
          "structure_version",
          "subtitle",
          "cpe_hours",
          "estimated_duration",
          "delivery_format",
          "instructor",
          "instructor_heading",
          "instructor_bio",
          "instructor_photo",
          "cta_label",
          "benefit_heading",
          "benefit_description",
          "benefits",
          "learning_objectives",
          "course_contents",
          "cpe_trust_heading",
          "cpe_trust_description",
          "cpe_provider_number",
          "cpe_provider_listing_url",
          "price",
          "is_published",
          "thumbnail_url",
        ],
      })
    );
    if (!courseRaw || !courseRaw.is_published) {
      throw new Error("Course not found or unpublished");
    }

    const course: CourseDetails = {
      title: courseRaw.title,
      structureVersion: courseRaw.structure_version || "legacy",
      subtitle: courseRaw.subtitle,
      cpeHours: courseRaw.cpe_hours == null ? null : Number(courseRaw.cpe_hours),
      estimatedDuration: courseRaw.estimated_duration,
      deliveryFormat: courseRaw.delivery_format,
      instructor: courseRaw.instructor,
      instructorHeading: courseRaw.instructor_heading,
      instructorBio: courseRaw.instructor_bio,
      instructorPhotoUrl: courseRaw.instructor_photo
        ? `${process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app'}/assets/${courseRaw.instructor_photo}`
        : null,
      ctaLabel: courseRaw.cta_label,
      benefitHeading: courseRaw.benefit_heading,
      benefitDescription: courseRaw.benefit_description,
      benefits: Array.isArray(courseRaw.benefits)
        ? courseRaw.benefits.filter((benefit): benefit is string => typeof benefit === "string" && benefit.trim().length > 0).slice(0, 3)
        : [],
      learningObjectives: Array.isArray(courseRaw.learning_objectives)
        ? courseRaw.learning_objectives
            .filter((objective): objective is string => typeof objective === "string" && objective.trim().length > 0)
            .map((objective) => objective.trim())
            .slice(0, 5)
        : [],
      courseContents: parseCourseContents(courseRaw.course_contents),
      cpeTrustHeading: courseRaw.cpe_trust_heading,
      cpeTrustDescription: courseRaw.cpe_trust_description,
      cpeProviderNumber: courseRaw.cpe_provider_number,
      cpeProviderListingUrl: courseRaw.cpe_provider_listing_url,
      price: Number(courseRaw.price) || 0,
      imageUrl: courseRaw.thumbnail_url
        ? `${process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app'}/assets/${courseRaw.thumbnail_url}`
        : null,
    };

    // 3. Fetch specific module (chapter) details
    const moduleRaw = await db.request(
      readItem("Modules", chapterId, {
        fields: ["id", "course_id", "title", "order_index", "mux_asset_id", "is_free_preview", "type", "cpe_value", "migration_status"],
      })
    );
    if (!moduleRaw || relationId(moduleRaw.course_id) !== courseId) {
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
    const allCourseModules = await db.request(
      readItems("Modules", {
        filter: {
          course_id: { _eq: courseId },
        },
        sort: ["order_index"],
        fields: ["id", "course_id", "title", "is_free_preview", "type", "order_index", "cpe_value", "migration_status"],
      })
    );
    const courseModules = course.structureVersion === "module_quiz_v2"
      ? allCourseModules.filter(isV2ContentModule)
      : allCourseModules;
    if (!courseModules.some((module) => module.id === chapterId)) {
      throw new Error("Module is not part of the active course structure");
    }
    if (course.structureVersion === "module_quiz_v2") {
      course.cpeHours = calculateCpeTotal(courseModules);
    }

    const allProgresses = userId ? await db.request(
      readItems("UserProgress", {
        filter: {
          user_id: { _eq: userId },
          module_id: { _in: courseModules.map((m) => m.id) },
        },
        fields: ["module_id", "is_completed", "content_completed_at", "quiz_passed_at", "completed_at"],
      })
    ) : [];

    const progressMap = new Map(allProgresses.map((p) => [relationId(p.module_id), p]));

    // Compute locked state based on purchase and preceding completion rules
    let isLocked = false;
    if (!moduleRaw.is_free_preview && !purchase) {
      isLocked = true;
    } else if (purchase) {
      const currentIndex = courseModules.findIndex((m) => m.id === chapterId);
      if (course.structureVersion === "module_quiz_v2") {
        isLocked = courseModules.slice(0, currentIndex).some((m) => !progressMap.get(m.id)?.completed_at);
      } else if (moduleRaw.type === 'quiz') {
        // Locked if any preceding 'video' module is not completed
        isLocked = courseModules.slice(0, currentIndex).some((m) => {
          return (m.type === 'video' || !m.type) && !progressMap.get(m.id)?.is_completed;
        });
      } else if (moduleRaw.type === 'essay') {
        // Locked if any preceding 'video' or 'quiz' module is not completed
        isLocked = courseModules.slice(0, currentIndex).some((m) => {
          return !progressMap.get(m.id)?.is_completed;
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

      // 4. Use the active course order so migrated quiz and essay shells stay excluded.
      const currentIndex = courseModules.findIndex((module) => module.id === chapterId);
      const nextModule = courseModules[currentIndex + 1];
      if (nextModule) {
        nextChapter = {
          id: nextModule.id,
          title: nextModule.title,
          position: nextModule.order_index,
          isPublished: true,
          isFree: nextModule.is_free_preview,
          type: nextModule.type || 'video',
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
        fields: ["id", "is_completed", "content_completed_at", "quiz_passed_at", "completed_at"],
      })
    ) : [];

    const userProgress = progresses[0]
      ? {
          id: progresses[0].id,
          isCompleted: Boolean(progresses[0].completed_at || progresses[0].is_completed),
          contentCompletedAt: progresses[0].content_completed_at || null,
          quizPassedAt: progresses[0].quiz_passed_at || null,
          completedAt: progresses[0].completed_at || null,
        }
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
      isLocked: true,
    };
  }
};
