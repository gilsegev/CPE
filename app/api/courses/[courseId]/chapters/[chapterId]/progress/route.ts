import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readItem, readItems, createItem, updateItem } from "@directus/sdk";
import { completeModuleContent, CourseWorkflowError } from "@/lib/course-completion";
import { logServerEvent } from "@/lib/observability";

export async function PUT(
  req: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const course = await db.request(
      readItem("Courses", params.courseId, { fields: ["id", "structure_version"] }),
    );
    if (course.structure_version === "module_quiz_v2") {
      const result = await completeModuleContent(user, params.courseId, params.chapterId);
      await logServerEvent(
        "module_content_completed",
        `/courses/${params.courseId}/chapters/${params.chapterId}`,
        { courseId: params.courseId, moduleId: params.chapterId, quizRequired: result.quizRequired },
        user.id,
      );
      return NextResponse.json({
        id: result.progress.id,
        userId: user.id,
        chapterId: params.chapterId,
        isCompleted: result.moduleComplete,
        contentCompletedAt: result.progress.content_completed_at,
        quizRequired: result.quizRequired,
        nextModuleId: result.nextModuleId,
      });
    }

    const { isCompleted } = await req.json();
    if (typeof isCompleted !== "boolean") {
      return new NextResponse("isCompleted must be a boolean", { status: 400 });
    }

    // Query if there is an existing progress record for this module and user
    const existingProgress = await db.request(
      readItems("UserProgress", {
        filter: {
          user_id: { _eq: user.id },
          module_id: { _eq: params.chapterId },
        },
        limit: 1,
      })
    );

    let result;
    if (existingProgress[0]) {
      // Update existing record
      result = await db.request(
        updateItem("UserProgress", existingProgress[0].id, {
          is_completed: isCompleted,
        })
      );
    } else {
      // Create new progress record
      result = await db.request(
        createItem("UserProgress", {
          user_id: user.id,
          module_id: params.chapterId,
          is_completed: isCompleted,
        })
      );
    }

    // Map output fields back to the format expected by the client UI
    return NextResponse.json({
      id: result.id,
      userId: user.id,
      chapterId: params.chapterId,
      isCompleted: result.is_completed,
    });
  } catch (error) {
    if (error instanceof CourseWorkflowError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error("[CHAPTER_ID_PROGRESS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
