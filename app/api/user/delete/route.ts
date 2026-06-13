import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readItems, deleteItems, deleteUser } from "@directus/sdk";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = user.id;

    // 1. Clean Purchases
    const purchases = await db.request(
      readItems("Purchases", {
        filter: { user_id: { _eq: userId } },
        fields: ["id"],
      })
    );
    if (purchases.length > 0) {
      await db.request(deleteItems("Purchases", purchases.map((p) => p.id)));
    }

    // 2. Clean UserProgress
    const progress = await db.request(
      readItems("UserProgress", {
        filter: { user_id: { _eq: userId } },
        fields: ["id"],
      })
    );
    if (progress.length > 0) {
      await db.request(deleteItems("UserProgress", progress.map((p) => p.id)));
    }

    // 3. Clean Submissions
    const submissions = await db.request(
      readItems("Submissions", {
        filter: { user_id: { _eq: userId } },
        fields: ["id"],
      })
    );
    if (submissions.length > 0) {
      await db.request(deleteItems("Submissions", submissions.map((s) => s.id)));
    }

    // 4. Clean Certificates
    const certificates = await db.request(
      readItems("Certificates", {
        filter: { user_id: { _eq: userId } },
        fields: ["id"],
      })
    );
    if (certificates.length > 0) {
      await db.request(deleteItems("Certificates", certificates.map((c) => c.id)));
    }

    // 5. Clean QuizProgress
    const quizProgresses = await db.request(
      readItems("QuizProgress", {
        filter: { user_id: { _eq: userId } },
        fields: ["id"],
      })
    );
    if (quizProgresses.length > 0) {
      await db.request(deleteItems("QuizProgress", quizProgresses.map((qp) => qp.id)));
    }

    // 6. Delete the user from directus_users
    await db.request(deleteUser(userId));

    // 7. Delete local cookies to log the user out
    const cookieStore = cookies();
    cookieStore.delete("directus_access_token");
    cookieStore.delete("directus_refresh_token");

    return new NextResponse("Success", { status: 200 });
  } catch (error) {
    console.error("[USER_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
