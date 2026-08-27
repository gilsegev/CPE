"use client";

import { Activity, Award, CheckCircle, Clock, LayoutDashboard, MessageSquare, ShieldCheck, Trophy } from "lucide-react";
import { useState } from "react";

import { CourseFeedbackSurvey } from "@/components/course-feedback-survey";
import { CourseFeedbackClient } from "@/app/admin/observability/_components/course-feedback-client";

const COURSE_ID = "preview-course-adhd";
const COURSE_TITLE = "Teaching Students with ADHD";

const completions = [
  { id: "completion-1", courseId: COURSE_ID, completedAt: "2026-08-18T15:10:00Z" },
  { id: "completion-2", courseId: COURSE_ID, completedAt: "2026-08-19T17:25:00Z" },
  { id: "completion-3", courseId: COURSE_ID, completedAt: "2026-08-20T14:40:00Z" },
  { id: "completion-4", courseId: COURSE_ID, completedAt: "2026-08-21T20:05:00Z" },
  { id: "completion-5", courseId: COURSE_ID, completedAt: "2026-08-22T16:30:00Z" },
  { id: "completion-6", courseId: COURSE_ID, completedAt: "2026-08-23T13:15:00Z" },
  { id: "completion-7", courseId: "preview-course-inclusive", completedAt: "2026-08-23T18:45:00Z" },
  { id: "completion-8", courseId: "preview-course-inclusive", completedAt: "2026-08-24T19:20:00Z" },
];

const responses = [
  {
    id: "response-1", completionId: "completion-1", learner: "alex@example.com", courseId: COURSE_ID, courseTitle: COURSE_TITLE,
    submittedAt: "2026-08-18T15:15:00Z", knowledgeBefore: 2, knowledgeAfter: 5, relevance: 5, instructionalEffectiveness: 5,
    intentToApply: 5, intentNotApplicable: false, plannedApplication: "Use shorter directions and visible completion points.",
    mostHelpful: "The executive-function examples were immediately practical.", improvement: "Add one more middle-school scenario.",
    technicalIssues: [], technicalIssueDetail: null,
  },
  {
    id: "response-2", completionId: "completion-2", learner: "jamie@example.com", courseId: COURSE_ID, courseTitle: COURSE_TITLE,
    submittedAt: "2026-08-21T11:05:00Z", knowledgeBefore: 3, knowledgeAfter: 4, relevance: 5, instructionalEffectiveness: 4,
    intentToApply: 4, intentNotApplicable: false, plannedApplication: "Try the transition checklist with two students.",
    mostHelpful: "Classroom routines.", improvement: null, technicalIssues: ["video"], technicalIssueDetail: "One video paused briefly near the end.",
  },
  {
    id: "response-3", completionId: "completion-3", learner: "morgan@example.com", courseId: COURSE_ID, courseTitle: COURSE_TITLE,
    submittedAt: "2026-08-20T14:48:00Z", knowledgeBefore: 2, knowledgeAfter: 4, relevance: 4, instructionalEffectiveness: 4,
    intentToApply: null, intentNotApplicable: true, plannedApplication: null, mostHelpful: "The misconception checks.",
    improvement: "Include downloadable examples.", technicalIssues: ["navigation"], technicalIssueDetail: "I initially missed the next-module action.",
  },
  {
    id: "response-4", completionId: "completion-5", learner: "riley@example.com", courseId: COURSE_ID, courseTitle: COURSE_TITLE,
    submittedAt: "2026-08-25T09:00:00Z", knowledgeBefore: 1, knowledgeAfter: 4, relevance: 5, instructionalEffectiveness: 5,
    intentToApply: 5, intentNotApplicable: false, plannedApplication: "Adjust independent-work instructions.", mostHelpful: null,
    improvement: null, technicalIssues: ["quiz", "other"], technicalIssueDetail: "The final confirmation took a few seconds to appear.",
  },
  {
    id: "response-5", completionId: "completion-7", learner: "taylor@example.com", courseId: "preview-course-inclusive", courseTitle: "Inclusive Classroom Foundations",
    submittedAt: "2026-08-24T08:20:00Z", knowledgeBefore: 3, knowledgeAfter: 5, relevance: 4, instructionalEffectiveness: 5,
    intentToApply: 4, intentNotApplicable: false, plannedApplication: "Revise group-work norms.", mostHelpful: "The reflection prompts.",
    improvement: "More elementary examples.", technicalIssues: [], technicalIssueDetail: null,
  },
];

const certificateFailures = [
  {
    id: "certificate-preview-1",
    learner: "casey@example.com",
    courseTitle: COURSE_TITLE,
    failureCode: "email_provider_unavailable",
    failureDetail: "The email provider did not accept the delivery request.",
    attemptCount: 3,
    lastAttemptAt: "2026-08-26T21:05:00Z",
  },
];

function PreviewNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
      <div><p className="font-semibold">Safe fixture preview</p><p className="mt-1 text-sky-800">These controls use sample data. Survey submissions, retries, and telemetry are not sent to Directus.</p></div>
    </div>
  );
}

function CompletionPreview() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
        <Trophy className="h-14 w-14 text-emerald-600" />
      </div>
      <h2 className="mt-5 text-3xl font-extrabold text-slate-900">Course Completed!</h2>
      <p className="mx-auto mt-2 max-w-lg text-slate-600">Congratulations! You completed {COURSE_TITLE} and earned 3 CPE credits. Your certificate is being prepared.</p>
      <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">CPE award</p><p className="mt-1 text-xl font-bold text-slate-900">3 credits</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Certificate</p><p className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900"><Clock className="h-5 w-5 text-amber-500" /> Processing</p></div>
      </div>
      <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-5 text-left">
        <h3 className="font-semibold text-slate-900">Help improve this course</h3>
        <p className="mb-4 mt-1 text-sm text-slate-600">The survey is optional and does not affect your credit or certificate.</p>
        <CourseFeedbackSurvey courseId={COURSE_ID} courseTitle={COURSE_TITLE} previewMode />
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Completed course</p><h2 className="mt-1 text-xl font-bold text-slate-900">{COURSE_TITLE}</h2></div><Award className="h-9 w-9 text-indigo-500" /></div>
        <div className="my-5 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full w-full bg-emerald-500" /></div>
        <p className="mb-4 text-sm font-medium text-slate-600">3 CPE · Certificate processing</p>
        <CourseFeedbackSurvey courseId={COURSE_ID} courseTitle={COURSE_TITLE} compact previewMode />
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-md">
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">After submission</p><h2 className="mt-1 text-xl font-bold text-slate-900">{COURSE_TITLE}</h2></div><CheckCircle className="h-9 w-9 text-emerald-500" /></div>
        <div className="my-5 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full w-full bg-emerald-500" /></div>
        <p className="mb-4 text-sm font-medium text-slate-600">3 CPE · Certificate delivered</p>
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle className="h-4 w-4" /> Thank you for your feedback</p>
      </div>
    </div>
  );
}

export function FeedbackPreviewClient() {
  const [view, setView] = useState<"completion" | "dashboard" | "admin">("completion");
  return (
    <main className={`min-h-screen p-5 md:p-8 ${view === "admin" ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className={view === "admin" ? "text-white" : "text-slate-900"}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Developer preview</p>
          <h1 className={`mt-1 text-3xl font-black ${view === "admin" ? "!text-white" : "!text-slate-900"}`}>Survey + observability</h1>
          <p className={`mt-1 text-sm ${view === "admin" ? "text-slate-400" : "text-slate-600"}`}>Inspect every new state without completing a course or changing application data.</p>
        </div>
        <PreviewNotice />
        <div className={`flex flex-wrap gap-2 rounded-xl border p-1 ${view === "admin" ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`} role="tablist" aria-label="Feedback preview views">
          {([
            ["completion", "Completion + survey", Trophy],
            ["dashboard", "Dashboard states", LayoutDashboard],
            ["admin", "Administrator reporting", Activity],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${view === id ? "bg-indigo-600 text-white" : view === "admin" ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"}`}><Icon className="h-4 w-4" /> {label}</button>
          ))}
        </div>
        {view === "completion" && <CompletionPreview />}
        {view === "dashboard" && <DashboardPreview />}
        {view === "admin" && (
          <CourseFeedbackClient
            completions={completions}
            responses={responses}
            courses={[{ id: COURSE_ID, title: COURSE_TITLE }, { id: "preview-course-inclusive", title: "Inclusive Classroom Foundations" }]}
            certificateFailures={certificateFailures}
            previewMode
          />
        )}
        <p className={`flex items-center justify-center gap-2 pb-4 text-xs ${view === "admin" ? "text-slate-500" : "text-slate-500"}`}><MessageSquare className="h-3.5 w-3.5" /> Local preview route · production access is disabled unless explicitly enabled</p>
      </div>
    </main>
  );
}
