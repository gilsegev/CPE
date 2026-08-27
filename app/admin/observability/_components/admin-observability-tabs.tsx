"use client";

import { Activity, MessageSquare } from "lucide-react";
import { useState } from "react";

import { ObservabilityClient } from "./observability-client";
import {
  CertificateFailureView,
  CourseFeedbackClient,
  FeedbackCompletionView,
  FeedbackResponseView,
} from "./course-feedback-client";

export function AdminObservabilityTabs({
  logs,
  courseMap,
  moduleMap,
  completions,
  responses,
  courses,
  certificateFailures,
}: {
  logs: any[];
  courseMap: Record<string, string>;
  moduleMap: Record<string, string>;
  completions: FeedbackCompletionView[];
  responses: FeedbackResponseView[];
  courses: Array<{ id: string; title: string }>;
  certificateFailures: CertificateFailureView[];
}) {
  const [activeTab, setActiveTab] = useState<"journey" | "feedback">("journey");
  return (
    <>
      <div className="flex w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-1" role="tablist" aria-label="Observability views">
        <button className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === "journey" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"}`} role="tab" aria-selected={activeTab === "journey"} onClick={() => setActiveTab("journey")}><Activity className="h-4 w-4" /> Journey telemetry</button>
        <button className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === "feedback" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"}`} role="tab" aria-selected={activeTab === "feedback"} onClick={() => setActiveTab("feedback")}><MessageSquare className="h-4 w-4" /> Course Feedback</button>
      </div>
      {activeTab === "journey" ? (
        <ObservabilityClient initialLogs={logs} courseMap={courseMap} moduleMap={moduleMap} />
      ) : (
        <CourseFeedbackClient completions={completions} responses={responses} courses={courses} certificateFailures={certificateFailures} />
      )}
    </>
  );
}
