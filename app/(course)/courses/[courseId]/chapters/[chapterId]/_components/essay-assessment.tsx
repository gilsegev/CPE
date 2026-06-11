"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Save, Send, Clock, CheckCircle2, AlertTriangle, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Submission {
  id: string;
  essay_text: string;
  status: "Draft" | "Pending" | "Approved" | "Rejected";
}

interface EssayAssessmentProps {
  courseId: string;
  chapterId: string;
  initialData: Submission | null;
}

export const EssayAssessment = ({
  courseId,
  chapterId,
  initialData,
}: EssayAssessmentProps) => {
  const [text, setText] = useState(initialData?.essay_text || "");
  const [loadedText, setLoadedText] = useState(initialData?.essay_text || "");
  const [status, setStatus] = useState<"Draft" | "Pending" | "Approved" | "Rejected" | "None">(
    initialData?.status || "None"
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Client-side fetch on mount to bypass Next.js client router cache
  useEffect(() => {
    const fetchDraft = async () => {
      try {
        const response = await axios.get(`/api/courses/${courseId}/chapters/${chapterId}/essay`);
        if (response.data) {
          setText(response.data.essay_text || "");
          setLoadedText(response.data.essay_text || "");
          setStatus(response.data.status || "None");
        } else {
          setText("");
          setLoadedText("");
          setStatus("None");
        }
      } catch (err) {
        console.error("Failed to load draft client-side", err);
      } finally {
        setIsLoading(false);
        setInitialLoaded(true);
      }
    };
    fetchDraft();
  }, [courseId, chapterId]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!initialLoaded || isLoading) return;
    if (status !== "Draft" && status !== "None") return; // Submissions are locked if Pending/Approved/Rejected
    if (!text.trim() || text === loadedText) return;

    setSaveState("saving");
    const delayDebounce = setTimeout(async () => {
      try {
        await axios.post(`/api/courses/${courseId}/chapters/${chapterId}/essay`, {
          essayText: text,
          status: "Draft",
        });
        setStatus("Draft");
        setSaveState("saved");
        setLoadedText(text);
      } catch (err) {
        setSaveState("error");
      }
    }, 2000);

    return () => clearTimeout(delayDebounce);
  }, [text, initialLoaded, isLoading, courseId, chapterId, status, loadedText]);

  const onSaveManual = async () => {
    if (status !== "Draft" && status !== "None") return;
    try {
      setSaveState("saving");
      await axios.post(`/api/courses/${courseId}/chapters/${chapterId}/essay`, {
        essayText: text,
        status: "Draft",
      });
      setStatus("Draft");
      setSaveState("saved");
      setLoadedText(text);
      toast.success("Draft saved successfully");
    } catch (err) {
      setSaveState("error");
      toast.error("Failed to save draft");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-5 md:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 shadow-md mt-6 flex flex-col items-center justify-center min-h-[300px]">
        <Clock className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
        <span className="text-sm text-slate-500 font-medium">Loading assessment state...</span>
      </div>
    );
  }

  const onSubmitFinal = async () => {
    if (!text.trim()) {
      toast.error("Please write your essay response before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      await axios.post(`/api/courses/${courseId}/chapters/${chapterId}/essay`, {
        essayText: text,
        status: "Pending",
      });

      setStatus("Pending");
      setIsSubmitModalOpen(false);
      toast.success("Assessment submitted for review!");

      // Refresh page cache & sidebar locks
      window.location.reload();
    } catch (err) {
      toast.error("Failed to submit assessment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReadOnly = status === "Pending" || status === "Approved" || status === "Rejected";

  return (
    <div className="max-w-4xl mx-auto p-5 md:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 shadow-md mt-6 relative">
      
      {/* Assessment Title */}
      <div className="flex items-center gap-x-3 pb-4 border-b mb-6">
        <div className="bg-indigo-100 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-200/40">
          <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Final Essay Assessment
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Observational Case Study Analysis
          </p>
        </div>
      </div>

      {/* Grading Banners */}
      {status === "Pending" && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 p-4 rounded-xl mb-6 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">
              Status: Pending Review
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-500/80 mt-1 leading-relaxed">
              An instructor will evaluate your case study within 3 business days. Once approved, your compliance certificate will be automatically issued.
            </p>
          </div>
        </div>
      )}

      {status === "Approved" && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 p-4 rounded-xl mb-6 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm">
              Status: Approved
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-500/80 mt-1 leading-relaxed">
              Congratulations! Your essay has been approved. Your custom PDF certificate is being processed and will be delivered shortly.
            </p>
          </div>
        </div>
      )}

      {status === "Rejected" && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 p-4 rounded-xl mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-rose-800 dark:text-rose-400 text-sm">
              Status: Action Required (Not Approved)
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-500/80 mt-1 leading-relaxed">
              Your submission did not meet the certification standards. Please contact your coordinator or review feedback in Directus to make adjustments.
            </p>
          </div>
        </div>
      )}

      {/* Essay Prompt Card */}
      <div className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl mb-6">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          Reflective Writing Prompt & Directions
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          Write a reflective case study response (recommended 300–500 words) describing how you will implement targeted accommodations for students with ADHD in your classroom setting. Include specific applications for:
        </p>
        <ul className="list-disc list-inside text-xs text-slate-500 dark:text-slate-400 space-y-2 pl-2">
          <li><strong>Physical Structuring:</strong> Spatial arrangements, visual seating priorities, and distraction reduction.</li>
          <li><strong>Behavioral Interventions:</strong> Positive reinforcement loops, schedules, and active breaks.</li>
          <li><strong>Collaboration Protocols:</strong> Structured communication loops connecting home environment with classroom practices.</li>
        </ul>
      </div>

      {/* Textarea Workspace */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isReadOnly || isSubmitting}
          placeholder="Type your essay response here..."
          className="w-full min-h-[350px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:text-slate-500 disabled:cursor-not-allowed text-sm leading-relaxed shadow-inner transition duration-200"
        />

        {/* Word Counter & Autosave Status */}
        <div className="flex items-center justify-between mt-2 text-xs text-slate-400 font-medium px-1">
          <span>
            {text.trim() === "" ? 0 : text.trim().split(/\s+/).length} words
          </span>

          {!isReadOnly && (
            <span>
              {saveState === "saving" && <span className="text-indigo-500 animate-pulse">Saving draft...</span>}
              {saveState === "saved" && <span className="text-emerald-500">Draft saved</span>}
              {saveState === "error" && <span className="text-rose-500">Failed to save draft</span>}
              {saveState === "idle" && status !== "None" && <span>Draft restored</span>}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || saveState === "saving"}
            onClick={onSaveManual}
            className="py-5 px-5 rounded-xl text-slate-600 border-slate-300 flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            Save Draft
          </Button>

          <Button
            type="button"
            disabled={isSubmitting || !text.trim()}
            onClick={() => setIsSubmitModalOpen(true)}
            className="py-5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
          >
            <Send className="h-4 w-4" />
            Submit Assessment
          </Button>
        </div>
      )}

      {/* Confirmation Dialog Overlay */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Submit Assessment?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Once submitted, your response will be locked for evaluation and cannot be edited. Are you sure you are ready to submit your final reflection?
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsSubmitModalOpen(false)}
                className="py-4 px-5 rounded-xl border-slate-300 text-slate-600"
              >
                Cancel
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={onSubmitFinal}
                className="py-4 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                Confirm Submission
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
