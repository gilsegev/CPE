"use client";

import axios from "axios";
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { buildFeedbackReport, TECHNICAL_ISSUE_CATEGORIES } from "@/lib/feedback-rules";

export type FeedbackCompletionView = {
  id: string;
  courseId: string;
  completedAt: string;
};

export type FeedbackResponseView = {
  id: string;
  completionId: string;
  learner: string;
  courseId: string;
  courseTitle: string;
  submittedAt: string;
  knowledgeBefore: number;
  knowledgeAfter: number;
  relevance: number;
  instructionalEffectiveness: number;
  intentToApply: number | null;
  intentNotApplicable: boolean;
  plannedApplication: string | null;
  mostHelpful: string | null;
  improvement: string | null;
  technicalIssues: string[];
  technicalIssueDetail: string | null;
};

export type CertificateFailureView = {
  id: string;
  learner: string;
  courseTitle: string;
  failureCode: string | null;
  failureDetail: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
};

const ISSUE_LABELS: Record<string, string> = {
  video: "Video",
  quiz: "Quiz",
  navigation: "Navigation",
  certificate: "Certificate",
  other: "Other",
};

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-800/70 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function Distribution({ label, values, extra }: { label: string; values: Record<number, number>; extra?: string }) {
  const max = Math.max(1, ...Object.values(values));
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-sm font-semibold text-white">{label}</h3>
      <div className="mt-4 space-y-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <div className="grid grid-cols-[1rem_1fr_2rem] items-center gap-2 text-xs" key={rating}>
            <span className="text-slate-400">{rating}</span>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(values[rating] / max) * 100}%` }} />
            </div>
            <span className="text-right text-slate-300">{values[rating]}</span>
          </div>
        ))}
      </div>
      {extra && <p className="mt-3 text-xs text-slate-400">{extra}</p>}
    </div>
  );
}

export function CourseFeedbackClient({
  completions,
  responses,
  courses,
  certificateFailures: initialCertificateFailures,
  previewMode = false,
}: {
  completions: FeedbackCompletionView[];
  responses: FeedbackResponseView[];
  courses: Array<{ id: string; title: string }>;
  certificateFailures: CertificateFailureView[];
  previewMode?: boolean;
}) {
  const [courseId, setCourseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [certificateFailures, setCertificateFailures] = useState(initialCertificateFailures);
  const [retrying, setRetrying] = useState<string | null>(null);
  const pageSize = 10;

  const report = useMemo(
    () => buildFeedbackReport(completions, responses as any, { courseId: courseId || undefined, from: from || undefined, to: to || undefined }),
    [completions, responses, courseId, from, to],
  );
  const totalPages = Math.max(1, Math.ceil(report.rows.length / pageSize));
  const rows = report.rows.slice((page - 1) * pageSize, page * pageSize) as Array<FeedbackResponseView & { completedAt: string | null }>;

  useEffect(() => setPage(1), [courseId, from, to]);

  const retryCertificate = async (certificateId: string) => {
    try {
      setRetrying(certificateId);
      if (!previewMode) {
        await axios.post(`/api/admin/certificates/${certificateId}/retry`);
      }
      setCertificateFailures((current) => current.filter((failure) => failure.id !== certificateId));
      toast.success("Certificate returned to the processing queue.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Certificate retry failed.");
    } finally {
      setRetrying(null);
    }
  };

  const formatAverage = (value: number | null) => value == null ? "—" : value.toFixed(2);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-800/40 p-4 md:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Course
          <select className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm normal-case text-white" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">All courses</option>
            {courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Completion date from
          <input className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm normal-case text-white" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Completion date through
          <input className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm normal-case text-white" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Completions" value={report.completionCount} detail="Authoritative completion records in range" />
        <MetricCard label="Responses" value={report.responseCount} detail="Responses linked to those completions" />
        <MetricCard label="Response rate" value={`${report.responseRate.toFixed(1)}%`} detail="Responses ÷ completions" />
        <MetricCard label="Knowledge change" value={formatAverage(report.averages.knowledgeChange)} detail={`${formatAverage(report.averages.knowledgeBefore)} before → ${formatAverage(report.averages.knowledgeAfter)} after`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Distribution label="Relevance" values={report.distributions.relevance} />
        <Distribution label="Instructional effectiveness" values={report.distributions.instructionalEffectiveness} />
        <Distribution label="Intent to apply" values={report.distributions.intentToApply} extra={`${report.intentNotApplicableCount} not applicable · ${formatAverage(report.averages.intentToApply)} average`} />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-5">
        <h2 className="text-lg font-bold text-white">Technical issues</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TECHNICAL_ISSUE_CATEGORIES.map((category) => (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4" key={category}>
              <p className="text-xs uppercase tracking-wide text-slate-400">{ISSUE_LABELS[category]}</p>
              <p className="mt-1 text-2xl font-bold text-white">{report.technicalIssues[category]}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-800/40">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="text-lg font-bold text-white">Responses</h2>
            <p className="text-xs text-slate-400">Comments are rendered as plain text and are visible only to administrators.</p>
          </div>
          <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>{["Learner / course", "Dates", "Knowledge", "Ratings", "Comments", "Technical"].map((heading) => <th className="px-4 py-3 font-semibold uppercase tracking-wide" key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {rows.map((row) => (
                <tr className="align-top" key={row.id}>
                  <td className="px-4 py-4"><p className="font-semibold text-white">{row.learner}</p><p className="mt-1 text-slate-400">{row.courseTitle}</p></td>
                  <td className="whitespace-nowrap px-4 py-4"><p>Completed {row.completedAt ? new Date(row.completedAt).toLocaleDateString() : "—"}</p><p className="mt-1 text-slate-400">Submitted {new Date(row.submittedAt).toLocaleString()}</p></td>
                  <td className="whitespace-nowrap px-4 py-4">{row.knowledgeBefore} → {row.knowledgeAfter} <span className="text-emerald-400">({row.knowledgeAfter - row.knowledgeBefore >= 0 ? "+" : ""}{row.knowledgeAfter - row.knowledgeBefore})</span></td>
                  <td className="whitespace-nowrap px-4 py-4"><p>Relevance {row.relevance}/5</p><p>Instruction {row.instructionalEffectiveness}/5</p><p>Intent {row.intentNotApplicable ? "N/A" : `${row.intentToApply}/5`}</p></td>
                  <td className="min-w-[260px] space-y-2 px-4 py-4"><p><span className="text-slate-500">Plan:</span> {row.plannedApplication || "—"}</p><p><span className="text-slate-500">Helpful:</span> {row.mostHelpful || "—"}</p><p><span className="text-slate-500">Improve:</span> {row.improvement || "—"}</p></td>
                  <td className="min-w-[180px] px-4 py-4"><p>{row.technicalIssues.length ? row.technicalIssues.map((issue) => ISSUE_LABELS[issue] || issue).join(", ") : "None reported"}</p>{row.technicalIssueDetail && <p className="mt-1 text-slate-400">{row.technicalIssueDetail}</p>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-400" colSpan={6}>No feedback responses match this completion range.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 p-4">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-rose-900/60 bg-rose-950/20">
        <div className="flex items-center gap-3 border-b border-rose-900/50 p-5">
          <AlertTriangle className="h-5 w-5 text-rose-400" />
          <div><h2 className="font-bold text-white">Certificate failures</h2><p className="text-xs text-slate-400">Sanitized workflow failures that need administrator attention.</p></div>
        </div>
        {certificateFailures.length === 0 ? (
          <p className="flex items-center gap-2 p-5 text-sm text-emerald-400"><CheckCircle className="h-4 w-4" /> No failed certificates.</p>
        ) : (
          <div className="divide-y divide-rose-900/40">
            {certificateFailures.map((failure) => (
              <div className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-center" key={failure.id}>
                <div><p className="font-semibold text-white">{failure.learner}</p><p className="text-xs text-slate-400">{failure.courseTitle}</p></div>
                <div><p className="text-sm text-rose-300">{failure.failureCode || "certificate_processing_failed"}</p><p className="text-xs text-slate-400">{failure.failureDetail || "No additional detail"} · {failure.attemptCount} attempt(s)</p></div>
                <Button size="sm" disabled={retrying === failure.id} onClick={() => retryCertificate(failure.id)}><RefreshCw className={`mr-2 h-4 w-4 ${retrying === failure.id ? "animate-spin" : ""}`} /> Retry</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
