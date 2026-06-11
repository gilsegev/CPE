import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readItems, createItem, updateItem } from "@directus/sdk";

export async function GET(
  req: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Retrieve user's submission for this course
    const submissions = await db.request(
      readItems("Submissions", {
        filter: {
          user_id: { _eq: user.id },
          course_id: { _eq: params.courseId },
        },
        limit: 1,
      })
    );

    return NextResponse.json(submissions[0] || null);
  } catch (error) {
    console.error("[ESSAY_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { essayText, status } = await req.json(); // status: 'Draft' | 'Pending'

    if (status !== "Draft" && status !== "Pending") {
      return new NextResponse("Invalid Status", { status: 400 });
    }

    // Check if user has an existing submission for this course
    const submissions = await db.request(
      readItems("Submissions", {
        filter: {
          user_id: { _eq: user.id },
          course_id: { _eq: params.courseId },
        },
        limit: 1,
      })
    );

    const existingSubmission = submissions[0];

    // If existing submission is already Pending/Approved/Rejected, prevent editing
    if (existingSubmission && existingSubmission.status !== "Draft") {
      return new NextResponse("Submission is locked and cannot be edited", {
        status: 400,
      });
    }

    let result;
    if (existingSubmission) {
      result = await db.request(
        updateItem("Submissions", existingSubmission.id, {
          essay_text: essayText,
          status: status,
        })
      );
    } else {
      result = await db.request(
        createItem("Submissions", {
          user_id: user.id,
          course_id: params.courseId,
          essay_text: essayText,
          status: status,
        })
      );
    }

    // If status is transitioning to Pending, mark this essay module completed in UserProgress
    if (status === "Pending") {
      const existingUserProgress = await db.request(
        readItems("UserProgress", {
          filter: {
            user_id: { _eq: user.id },
            module_id: { _eq: params.chapterId },
          },
          limit: 1,
        })
      );

      if (existingUserProgress[0]) {
        await db.request(
          updateItem("UserProgress", existingUserProgress[0].id, {
            is_completed: true,
          })
        );
      } else {
        await db.request(
          createItem("UserProgress", {
            user_id: user.id,
            module_id: params.chapterId,
            is_completed: true,
          })
        );
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ESSAY_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
