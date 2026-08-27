"use client";

import axios from "axios";
import { CheckCircle, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TECHNICAL_ISSUE_CATEGORIES } from "@/lib/feedback-rules";
import { useObservability } from "@/components/providers/observability-provider";

type RatingField = "knowledgeBefore" | "knowledgeAfter" | "relevance" | "instructionalEffectiveness" | "intentToApply";

type SurveyState = {
  knowledgeBefore?: number;
  knowledgeAfter?: number;
  relevance?: number;
  instructionalEffectiveness?: number;
  intentToApply?: number;
  intentNotApplicable: boolean;
  plannedApplication: string;
  mostHelpful: string;
  improvement: string;
  technicalIssues: string[];
  technicalIssueDetail: string;
};

const INITIAL_STATE: SurveyState = {
  intentNotApplicable: false,
  plannedApplication: "",
  mostHelpful: "",
  improvement: "",
  technicalIssues: [],
  technicalIssueDetail: "",
};

const ISSUE_LABELS: Record<string, string> = {
  video: "Video",
  quiz: "Quiz",
  navigation: "Navigation",
  certificate: "Certificate",
  other: "Other",
};

function RatingQuestion({
  field,
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  field: RatingField;
  label: string;
  value?: number;
  onChange: (field: RatingField, value: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-slate-800">{label} <span aria-hidden="true">*</span></legend>
      <div className="flex items-center gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating} className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name={field}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(field, rating)}
            />
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-sm font-semibold text-slate-700 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2">
              {rating}
            </span>
          </label>
        ))}
      </div>
      <div className="flex max-w-[232px] justify-between text-xs text-slate-500">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </fieldset>
  );
}

export function CourseFeedbackSurvey({
  courseId,
  courseTitle,
  initiallyOpen = false,
  compact = false,
  previewMode = false,
  onSubmitted,
  onClosed,
}: {
  courseId: string;
  courseTitle: string;
  initiallyOpen?: boolean;
  compact?: boolean;
  previewMode?: boolean;
  onSubmitted?: () => void;
  onClosed?: () => void;
}) {
  const { logEvent } = useObservability();
  const [open, setOpen] = useState(initiallyOpen);
  const [survey, setSurvey] = useState<SurveyState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!previewMode && open && !shownRef.current) {
      shownRef.current = true;
      void logEvent("survey_shown", { courseId });
    }
  }, [courseId, logEvent, open, previewMode]);

  const setRating = (field: RatingField, value: number) => {
    setSurvey((current) => ({
      ...current,
      [field]: value,
      ...(field === "intentToApply" ? { intentNotApplicable: false } : {}),
    }));
  };

  const setIssue = (category: string, checked: boolean) => {
    setSurvey((current) => ({
      ...current,
      technicalIssues: checked
        ? [...current.technicalIssues, category]
        : current.technicalIssues.filter((issue) => issue !== category),
    }));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting) return;
    setOpen(nextOpen);
    if (nextOpen) {
      shownRef.current = false;
    } else if (!submittedRef.current) {
      if (!previewMode) void logEvent("survey_closed", { courseId });
      onClosed?.();
    }
  };

  const submit = async () => {
    try {
      setSubmitting(true);
      if (!previewMode) {
        await axios.post(`/api/courses/${courseId}/feedback`, survey);
      }
      submittedRef.current = true;
      setSubmitted(true);
      setOpen(false);
      onSubmitted?.();
      toast.success("Thank you for your feedback.");
    } catch (error: any) {
      const message = error?.response?.data?.message || "Feedback could not be submitted.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-700" role="status">
        <CheckCircle className="h-4 w-4" /> Thank you for providing feedback.
      </p>
    );
  }

  return (
    <>
      {!initiallyOpen && (
        <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={() => setOpen(true)}>
          <MessageSquare className="mr-2 h-4 w-4" /> Provide feedback
        </Button>
      )}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" onEscapeKeyDown={(event) => submitting && event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Course feedback</DialogTitle>
            <DialogDescription>
              Share optional feedback about {courseTitle}. Your response does not affect your CPE credit or certificate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <RatingQuestion field="knowledgeBefore" label="Before this course, how knowledgeable or skilled were you in the topic?" value={survey.knowledgeBefore} onChange={setRating} lowLabel="Not at all" highLabel="Extremely" />
            <RatingQuestion field="knowledgeAfter" label="After this course, how knowledgeable or skilled are you in the topic?" value={survey.knowledgeAfter} onChange={setRating} lowLabel="Not at all" highLabel="Extremely" />
            <RatingQuestion field="relevance" label="How relevant is this course to your current work as an educator?" value={survey.relevance} onChange={setRating} lowLabel="Not at all" highLabel="Extremely" />
            <RatingQuestion field="instructionalEffectiveness" label="The course content, examples, and activities helped me learn." value={survey.instructionalEffectiveness} onChange={setRating} lowLabel="Strongly disagree" highLabel="Strongly agree" />

            <div className="space-y-3">
              <RatingQuestion field="intentToApply" label="How likely are you to use what you learned in your work?" value={survey.intentToApply} onChange={setRating} lowLabel="Definitely not" highLabel="Definitely will" />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={survey.intentNotApplicable}
                  onCheckedChange={(checked) => setSurvey((current) => ({ ...current, intentNotApplicable: checked === true, intentToApply: checked === true ? undefined : current.intentToApply }))}
                />
                Not applicable
              </label>
            </div>

            {([
              ["plannedApplication", "What, if anything, do you plan to use from this course?", 2000],
              ["mostHelpful", "What part of the course was most helpful to your learning?", 2000],
              ["improvement", "How could this course be improved?", 2000],
            ] as const).map(([field, label, maxLength]) => (
              <div className="space-y-2" key={field}>
                <Label htmlFor={field}>{label}</Label>
                <Textarea id={field} maxLength={maxLength} value={survey[field]} onChange={(event) => setSurvey((current) => ({ ...current, [field]: event.target.value }))} />
                <p className="text-right text-xs text-slate-500">{survey[field].length}/{maxLength}</p>
              </div>
            ))}

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-slate-800">Did you experience a technical problem? Select all that apply.</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TECHNICAL_ISSUE_CATEGORIES.map((category) => (
                  <label key={category} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={survey.technicalIssues.includes(category)} onCheckedChange={(checked) => setIssue(category, checked === true)} />
                    {ISSUE_LABELS[category]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">Leave all choices unchecked if you had no technical problems.</p>
              {survey.technicalIssues.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="technicalIssueDetail">Technical issue details{survey.technicalIssues.includes("other") ? " *" : ""}</Label>
                  <Textarea id="technicalIssueDetail" maxLength={1000} value={survey.technicalIssueDetail} onChange={(event) => setSurvey((current) => ({ ...current, technicalIssueDetail: event.target.value }))} />
                </div>
              )}
            </fieldset>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>Close</Button>
            <Button type="button" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit feedback"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
