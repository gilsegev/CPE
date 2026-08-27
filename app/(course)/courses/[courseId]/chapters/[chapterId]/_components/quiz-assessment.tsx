"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { Check, X, ArrowLeft, ArrowRight, RefreshCw, Trophy, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfettiStore } from "@/hooks/use-confetti-store";
import { cn } from "@/lib/utils";
import { CourseFeedbackSurvey } from "@/components/course-feedback-survey";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  explanation?: string;
}

interface QuizAssessmentProps {
  courseId: string;
  courseTitle: string;
  chapterId: string;
  nextChapterId?: string;
  initialData: {
    attemptId?: string;
    attemptNumber?: number;
    isCompleted: boolean;
    score?: number | null;
    passed?: boolean | null;
    answers: Record<string, number>;
    questions: Question[];
    correctAnswers: Record<string, { correctIndex: number; explanation: string }>;
    passingScore: number;
    courseCompletion?: {
      id: string;
      completedAt: string;
      cpeEarned: number;
      certificate: {
        id: string;
        status?: "pending" | "processing" | "issued" | "delivered" | "failed";
        pdfUrl?: string | null;
        issuedDate?: string | null;
      };
    } | null;
  };
}

export const QuizAssessment = ({
  courseId,
  courseTitle,
  chapterId,
  nextChapterId,
  initialData,
}: QuizAssessmentProps) => {
  const confetti = useConfettiStore();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>(initialData.questions);
  const [answers, setAnswers] = useState<Record<string, number>>(initialData.answers);
  const [correctAnswers, setCorrectAnswers] = useState<
    Record<string, { correctIndex: number; explanation: string }>
  >(initialData.correctAnswers);
  const [isCompleted, setIsCompleted] = useState<boolean>(initialData.isCompleted);
  const [attemptId] = useState(initialData.attemptId || "");
  const [courseCompletion, setCourseCompletion] = useState(initialData.courseCompletion || null);
  const [showCompletionSurvey, setShowCompletionSurvey] = useState(false);

  // Score states (loaded after quiz submission)
  const [score, setScore] = useState<number | null>(() => {
    if (initialData.score != null) return initialData.score;
    if (initialData.isCompleted && questions.length > 0) {
      let correct = 0;
      questions.forEach((q) => {
        if (
          initialData.answers[q.id] !== undefined &&
          initialData.correctAnswers[q.id]?.correctIndex === initialData.answers[q.id]
        ) {
          correct++;
        }
      });
      return Math.round((correct / questions.length) * 100);
    }
    return null;
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    // If quiz is not completed, start at the first unanswered question
    if (!initialData.isCompleted) {
      const firstUnanswered = questions.findIndex((q) => !(q.id in initialData.answers));
      return firstUnanswered === -1 ? 0 : firstUnanswered;
    }
    return 0;
  });

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentQuestion = questions[currentIndex];
  const isQuestionAnswered = currentQuestion?.id in answers;
  const userAnswer = answers[currentQuestion?.id];
  const questionFeedback = correctAnswers[currentQuestion?.id];

  const onSelectOption = (index: number) => {
    if (isQuestionAnswered || isSubmitting) return;
    setSelectedOption(index);
  };

  const onSubmitAnswer = async () => {
    if (selectedOption === null || isQuestionAnswered || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const response = await axios.post(
        `/api/courses/${courseId}/chapters/${chapterId}/quiz`,
        {
          action: "submit-answer",
          attemptId,
          questionId: currentQuestion.id,
          answerIndex: selectedOption,
        }
      );

      const { correct, correctIndex, explanation } = response.data;

      // Update local states
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: selectedOption }));
      setCorrectAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: { correctIndex, explanation },
      }));

      // Update question text explanation for current view
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === currentQuestion.id ? { ...q, explanation } : q
        )
      );

      if (correct) {
        toast.success("Correct answer!");
      } else {
        toast.error("Incorrect. Review the explanation below to continue.");
      }
      setSelectedOption(null);
    } catch (error) {
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitQuiz = async () => {
    try {
      setIsSubmitting(true);
      const response = await axios.post(
        `/api/courses/${courseId}/chapters/${chapterId}/quiz`,
        {
          action: "submit-quiz",
          attemptId,
        }
      );

      const { score: finalScore, passed, courseCompletion: completedCourse } = response.data;
      setScore(finalScore);
      setIsCompleted(true);
      setCourseCompletion(completedCourse || null);
      setShowCompletionSurvey(Boolean(completedCourse));

      if (passed) {
        router.refresh();
        confetti.onOpen();
        toast.success(`Congratulations! You passed with ${finalScore}%`);
      } else {
        toast.error(`You scored ${finalScore}%. Passing threshold is ${initialData.passingScore}%`);
      }
    } catch (error) {
      toast.error("Failed to complete quiz");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRetake = async () => {
    try {
      setIsSubmitting(true);
      await axios.post(`/api/courses/${courseId}/chapters/${chapterId}/quiz`, {
        action: "reset",
      });

      // Reset all client state
      setAnswers({});
      setCorrectAnswers({});
      setIsCompleted(false);
      setScore(null);
      setCurrentIndex(0);
      setSelectedOption(null);
      toast.success("Quiz reset. Good luck!");

      // Refresh sidebar and page cache
      window.location.reload();
    } catch (error) {
      toast.error("Failed to reset quiz");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
    }
  };

  const onPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedOption(null);
    }
  };

  const onContinue = () => {
    if (courseCompletion) {
      window.location.assign(`/`);
    } else if (nextChapterId) {
      window.location.assign(`/courses/${courseId}/chapters/${nextChapterId}`);
    } else {
      window.location.assign(`/`);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
        <HelpCircle className="h-16 w-16 text-indigo-500 mb-4 animate-pulse" />
        <h3 className="text-xl font-semibold text-slate-800">No Questions Available</h3>
        <p className="text-slate-500 mt-2">This quiz module does not contain any questions yet.</p>
      </div>
    );
  }

  // Render Pass/Fail screen when quiz is completed
  if (isCompleted && score !== null) {
    const passed = score >= initialData.passingScore;
    const courseCompleted = Boolean(courseCompletion) || (passed && !nextChapterId && !attemptId);
    const certificateStatus = courseCompletion?.certificate.status || "pending";

    return (
      <div className="max-w-2xl mx-auto p-6 md:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 shadow-xl mt-6 transition-all duration-300">
        <div className="flex flex-col items-center text-center">
          {passed ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-full mb-6 border border-emerald-200 animate-bounce">
              <Trophy className="h-20 w-20 text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : (
            <div className="bg-rose-50 dark:bg-rose-950/30 p-4 rounded-full mb-6 border border-rose-200">
              <AlertCircle className="h-20 w-20 text-rose-600 dark:text-rose-400" />
            </div>
          )}

          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            {courseCompleted ? "Course Completed!" : passed ? "Assessment Passed!" : "Quiz Score Result"}
          </h2>

          <p className="text-slate-500 mt-2 max-w-sm">
            {courseCompleted
              ? `Congratulations! You completed ${courseTitle} and earned ${courseCompletion?.cpeEarned ?? "your"} CPE credit${courseCompletion?.cpeEarned === 1 ? "" : "s"}. Your certificate is ${certificateStatus === "delivered" ? "delivered" : certificateStatus === "failed" ? "awaiting an administrator retry" : "being prepared"}.`
              : passed
              ? "Great job! You met the passing requirement and unlocked the next module."
              : `You scored ${score}%. A passing rate of ${initialData.passingScore}% is required. Please review explanations and try again.`}
          </p>

          <div className="mt-8 mb-8 relative p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 w-full max-w-xs overflow-hidden">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Your Score</span>
            <div className={cn(
              "text-6xl font-black mt-2",
              passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {score}%
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Required: {initialData.passingScore}%
            </div>
          </div>

          {courseCompleted && courseCompletion?.certificate.pdfUrl && (
            <a
              href={courseCompletion.certificate.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-6 text-sm font-semibold text-emerald-700 underline underline-offset-4"
            >
              View certificate
            </a>
          )}

          {courseCompleted && showCompletionSurvey && (
            <div className="mb-6 w-full rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-left">
              <h3 className="font-semibold text-slate-900">Help improve this course</h3>
              <p className="mb-3 mt-1 text-sm text-slate-600">This optional survey does not affect your CPE credit or certificate.</p>
              <CourseFeedbackSurvey
                courseId={courseId}
                courseTitle={courseTitle}
                initiallyOpen
                onClosed={() => setShowCompletionSurvey(false)}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            {!passed && (
              <Button
                onClick={onRetake}
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-6 px-8 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-rose-600/20 transition-all w-full sm:w-auto"
              >
                <RefreshCw className="h-5 w-5" />
                Retake Quiz
              </Button>
            )}
            {passed && (
              <Button
                onClick={onContinue}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6 px-8 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-600/20 transition-all w-full sm:w-auto"
              >
                {courseCompleted ? "Close Course" : "Continue Course"}
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsCompleted(false)}
              className="py-6 px-8 rounded-xl text-slate-600 border-slate-300 w-full sm:w-auto"
            >
              Review Answers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const allQuestionsAnswered = questions.every((q) => q.id in answers);

  return (
    <div className="max-w-2xl mx-auto p-5 md:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 shadow-md mt-6">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Module Quiz
        </span>
        <span className="text-sm text-slate-500 font-medium">
          Question {currentIndex + 1} of {questions.length}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-8 overflow-hidden">
        <div
          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Text */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
          {currentQuestion.question_text}
        </h3>
      </div>

      {/* Options List */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = selectedOption === idx;
          const isUserSelection = userAnswer === idx;
          const isCorrectIndex = questionFeedback?.correctIndex === idx;

          // Styling options
          let optionStyle = "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300";
          let iconContainer = null;

          if (isQuestionAnswered) {
            if (isCorrectIndex) {
              optionStyle = "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-400 ring-2 ring-emerald-500";
              iconContainer = (
                <div className="bg-emerald-500 text-white rounded-full p-1 ml-auto">
                  <Check className="h-3 w-3 stroke-[3px]" />
                </div>
              );
            } else if (isUserSelection) {
              optionStyle = "border-rose-500 bg-rose-50/50 dark:bg-rose-950/10 text-rose-800 dark:text-rose-400 ring-2 ring-rose-500";
              iconContainer = (
                <div className="bg-rose-500 text-white rounded-full p-1 ml-auto">
                  <X className="h-3 w-3 stroke-[3px]" />
                </div>
              );
            } else {
              optionStyle = "border-slate-200 dark:border-slate-800 opacity-60 text-slate-500";
            }
          } else if (isSelected) {
            optionStyle = "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/10 text-indigo-900 dark:text-indigo-300 ring-2 ring-indigo-600";
          }

          return (
            <button
              key={idx}
              disabled={isQuestionAnswered || isSubmitting}
              onClick={() => onSelectOption(idx)}
              className={cn(
                "w-full flex items-center p-4 rounded-xl border text-left font-medium text-sm transition-all focus:outline-none",
                optionStyle
              )}
            >
              <span className="mr-3 shrink-0 font-bold" aria-hidden="true">
                {String.fromCharCode(65 + idx)}.
              </span>
              <span className="flex-1 pr-4">{option}</span>
              {iconContainer}
            </button>
          );
        })}
      </div>

      {/* Explanation Block */}
      {isQuestionAnswered && questionFeedback && (
        <div className="p-4 bg-indigo-50/40 dark:bg-slate-800/40 border border-indigo-100/50 dark:border-slate-700/60 rounded-xl mb-6 animate-fadeIn">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-1">
            Explanation
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {questionFeedback.explanation}
          </p>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="flex gap-3 w-full sm:w-auto mr-auto">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={currentIndex === 0 || isSubmitting}
            className="w-full sm:w-auto px-4 py-5 rounded-xl border-slate-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
        </div>

        {/* Action Button: Submit Answer / Complete Quiz / Next Question */}
        {!isQuestionAnswered ? (
          <Button
            disabled={selectedOption === null || isSubmitting}
            onClick={onSubmitAnswer}
            className="w-full sm:w-auto py-5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10"
          >
            Submit Answer
          </Button>
        ) : (
          <>
            {currentIndex < questions.length - 1 && (
              <Button
                onClick={onNext}
                className="w-full sm:w-auto px-4 py-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
              >
                {questionFeedback && questionFeedback.correctIndex !== userAnswer
                  ? "Review Explanation & Continue"
                  : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {currentIndex === questions.length - 1 && (
              <div className="flex gap-2 w-full sm:w-auto">
                {score !== null && (
                  <Button
                    onClick={() => setIsCompleted(true)}
                    className="w-full sm:w-auto py-5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    View Results
                  </Button>
                )}
                {score === null && allQuestionsAnswered && (
                  <Button
                    disabled={isSubmitting}
                    onClick={onSubmitQuiz}
                    className="w-full sm:w-auto py-5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10"
                  >
                    Submit Quiz
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
