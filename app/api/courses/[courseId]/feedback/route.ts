import { createItem, readItems } from "@directus/sdk";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateFeedbackPayload } from "@/lib/feedback-rules";
import { logServerEvent } from "@/lib/observability";

function isUniqueConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /RECORD_NOT_UNIQUE|duplicate key|unique constraint|already exists|has to be unique/i.test(message);
}

export async function POST(
  request: Request,
  { params }: { params: { courseId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const purchases = await db.request(
      readItems("Purchases", {
        filter: {
          user_id: { _eq: user.id },
          course_id: { _eq: params.courseId },
          status: { _eq: "active" },
        },
        fields: ["id"],
        limit: 1,
      }),
    );
    if (!purchases[0]) {
      return NextResponse.json({ error: "purchase_required", message: "An active purchase is required." }, { status: 403 });
    }

    const completions = await db.request(
      readItems("CourseCompletions", {
        filter: { user_id: { _eq: user.id }, course_id: { _eq: params.courseId } },
        fields: ["id", "user_id", "course_id"],
        limit: 1,
      }),
    );
    const completion = completions[0];
    if (!completion) {
      return NextResponse.json({ error: "completion_required", message: "Complete the course before submitting feedback." }, { status: 409 });
    }

    const existing = await db.request(
      readItems("FeedbackResponses", {
        filter: { completion_id: { _eq: completion.id } },
        fields: ["id"],
        limit: 1,
      }),
    );
    if (existing[0]) {
      return NextResponse.json({ error: "feedback_already_submitted", message: "Feedback has already been submitted for this course." }, { status: 409 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json", message: "A valid JSON request body is required." }, { status: 400 });
    }
    const validation = validateFeedbackPayload(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "invalid_feedback", message: "Review the highlighted feedback fields.", fields: validation.errors },
        { status: 400 },
      );
    }

    const feedback = await db.request(
      createItem("FeedbackResponses", {
        completion_id: completion.id,
        user_id: user.id,
        course_id: params.courseId,
        knowledge_before: validation.data.knowledgeBefore,
        knowledge_after: validation.data.knowledgeAfter,
        relevance: validation.data.relevance,
        instructional_effectiveness: validation.data.instructionalEffectiveness,
        intent_to_apply: validation.data.intentToApply,
        intent_not_applicable: validation.data.intentNotApplicable,
        planned_application: validation.data.plannedApplication,
        most_helpful: validation.data.mostHelpful,
        improvement: validation.data.improvement,
        technical_issues: validation.data.technicalIssues,
        technical_issue_detail: validation.data.technicalIssueDetail,
        submitted_at: new Date().toISOString(),
      }),
    );

    await logServerEvent(
      "survey_submitted",
      `/courses/${params.courseId}/feedback`,
      { courseId: params.courseId, completionId: completion.id, technicalIssues: validation.data.technicalIssues },
      user.id,
    );

    return NextResponse.json({ id: feedback.id, submittedAt: feedback.submitted_at }, { status: 201 });
  } catch (error) {
    if (isUniqueConflict(error)) {
      return NextResponse.json({ error: "feedback_already_submitted", message: "Feedback has already been submitted for this course." }, { status: 409 });
    }
    console.error("[COURSE_FEEDBACK_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
