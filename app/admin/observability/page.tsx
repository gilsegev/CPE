import { redirect } from "next/navigation";
import { readItems } from "@directus/sdk";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { relationId } from "@/lib/course-completion-rules";
import { AdminObservabilityTabs } from "./_components/admin-observability-tabs";

export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const isUserAdmin = await isAdmin(user.id);
  if (!isUserAdmin) {
    redirect("/search");
  }

  const [logs, courses, modules, completions, responses, certificateFailures] = await Promise.all([
    db.request(readItems("UserActivityLogs", {
      sort: ["-timestamp"],
      limit: 2000,
      fields: ["*", "user_id.email" as any],
    })),
    db.request(readItems("Courses", {
      fields: ["id", "title"],
      limit: -1,
    })),
    db.request(readItems("Modules", {
      fields: ["id", "title"],
      limit: -1,
    })),
    db.request(readItems("CourseCompletions", {
      fields: ["id", "course_id", "completed_at"],
      limit: -1,
    })),
    db.request(readItems("FeedbackResponses", {
      fields: [
        "id", "completion_id", "course_id", "user_id.email" as any, "knowledge_before", "knowledge_after",
        "relevance", "instructional_effectiveness", "intent_to_apply", "intent_not_applicable",
        "planned_application", "most_helpful", "improvement", "technical_issues", "technical_issue_detail", "submitted_at",
      ],
      sort: ["-submitted_at"],
      limit: -1,
    })),
    db.request(readItems("Certificates", {
      filter: { status: { _eq: "failed" } },
      fields: [
        "id", "user_id.email" as any, "course_id", "course_title_snapshot", "failure_code", "failure_detail",
        "attempt_count", "last_attempt_at",
      ],
      sort: ["-last_attempt_at"],
      limit: -1,
    })),
  ]);

  const courseMap: Record<string, string> = {};
  courses.forEach((c) => {
    courseMap[c.id] = c.title;
  });

  const moduleMap: Record<string, string> = {};
  modules.forEach((m) => {
    moduleMap[m.id] = m.title;
  });

  const completionViews = completions.map((completion) => ({
    id: completion.id,
    courseId: relationId(completion.course_id),
    completedAt: completion.completed_at,
  }));
  const responseViews = responses.map((response: any) => {
    const responseCourseId = relationId(response.course_id);
    return {
      id: response.id,
      completionId: relationId(response.completion_id),
      learner: typeof response.user_id === "object" ? response.user_id?.email || "Unknown learner" : "Unknown learner",
      courseId: responseCourseId,
      courseTitle: courseMap[responseCourseId] || "Unknown course",
      submittedAt: response.submitted_at,
      knowledgeBefore: response.knowledge_before,
      knowledgeAfter: response.knowledge_after,
      relevance: response.relevance,
      instructionalEffectiveness: response.instructional_effectiveness,
      intentToApply: response.intent_to_apply,
      intentNotApplicable: response.intent_not_applicable,
      plannedApplication: response.planned_application,
      mostHelpful: response.most_helpful,
      improvement: response.improvement,
      technicalIssues: Array.isArray(response.technical_issues) ? response.technical_issues : [],
      technicalIssueDetail: response.technical_issue_detail,
    };
  });
  const certificateFailureViews = certificateFailures.map((certificate: any) => {
    const courseId = relationId(certificate.course_id);
    return {
      id: certificate.id,
      learner: typeof certificate.user_id === "object" ? certificate.user_id?.email || "Unknown learner" : "Unknown learner",
      courseTitle: certificate.course_title_snapshot || courseMap[courseId] || "Unknown course",
      failureCode: certificate.failure_code,
      failureDetail: certificate.failure_detail,
      attemptCount: Number(certificate.attempt_count || 0),
      lastAttemptAt: certificate.last_attempt_at,
    };
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            System Observability & Conversion Analytics
          </h1>
          <p className="text-slate-400 mt-1">
            Journey diagnostics, authoritative course feedback, and certificate workflow failures.
          </p>
        </div>

        <AdminObservabilityTabs
          logs={logs as any[]}
          courseMap={courseMap}
          moduleMap={moduleMap}
          completions={completionViews}
          responses={responseViews}
          courses={courses.map((course) => ({ id: course.id, title: course.title }))}
          certificateFailures={certificateFailureViews}
        />
      </div>
    </div>
  );
}
