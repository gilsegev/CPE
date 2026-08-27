import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getChapter, type CourseDetails } from "@/actions/get-chapter";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getOrStartQuizState } from "@/lib/course-completion";

import { QuizAssessment } from "../_components/quiz-assessment";

const ModuleQuizPage = async ({
  params,
}: {
  params: { courseId: string; chapterId: string };
}) => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const {
    chapter,
    course,
    nextChapter,
    userProgress,
    purchase,
    isLocked,
  } = await getChapter({
    userId: user.id,
    courseId: params.courseId,
    chapterId: params.chapterId,
  });

  const moduleUrl = `/courses/${params.courseId}/chapters/${params.chapterId}`;
  if (!chapter || !course) redirect("/");

  const courseDetails = course as CourseDetails;
  if (
    courseDetails.structureVersion !== "module_quiz_v2" ||
    !purchase ||
    isLocked ||
    !userProgress?.contentCompletedAt
  ) {
    redirect(moduleUrl);
  }

  let quizData = null;
  try {
    quizData = await getOrStartQuizState(user, params.courseId, params.chapterId);
  } catch (error) {
    console.error("[MODULE_QUIZ_PAGE_ERROR]", error);
  }

  if (!quizData) redirect(moduleUrl);

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 pb-20 pt-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link href={moduleUrl}>
          <Button variant="ghost" className="mb-2 px-0 text-slate-600 hover:bg-transparent hover:text-slate-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to module
          </Button>
        </Link>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Module assessment</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{chapter.title} Quiz</h1>
        <p className="mt-2 text-sm text-slate-500">
          Answer each question, then submit the quiz. You need {quizData.passingScore}% to continue.
        </p>
      </div>

      <QuizAssessment
        courseId={params.courseId}
        courseTitle={courseDetails.title}
        chapterId={params.chapterId}
        nextChapterId={nextChapter?.id}
        initialData={quizData}
      />
    </div>
  );
};

export default ModuleQuizPage;
