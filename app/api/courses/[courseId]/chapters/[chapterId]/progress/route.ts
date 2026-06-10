import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readItems, createItem, updateItem } from "@directus/sdk";

export async function PUT(
  req: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const user = await getCurrentUser();
    const { isCompleted } = await req.json();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
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
    console.error("[CHAPTER_ID_PROGRESS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}