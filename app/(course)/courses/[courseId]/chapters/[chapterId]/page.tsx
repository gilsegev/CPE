import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { File, Lock } from "lucide-react";

import { getChapter } from "@/actions/get-chapter";
import { Banner } from "@/components/banner";
import { Separator } from "@/components/ui/separator";
import { Preview } from "@/components/preview";
import { db } from "@/lib/db";
import { readItems } from "@directus/sdk";

import { VideoPlayer } from "./_components/video-player";
import { CourseEnrollButton } from "./_components/course-enroll-button";
import { CourseProgressButton } from "./_components/course-progress-button";
import { QuizAssessment } from "./_components/quiz-assessment";
import { EssayAssessment } from "./_components/essay-assessment";
import { PaymentVerificationPoller } from "./_components/payment-verification-poller";

const ChapterIdPage = async ({
  params,
  searchParams,
}: {
  params: { courseId: string; chapterId: string };
  searchParams: { success?: string };
}) => {
  const user = await getCurrentUser();
  const userId = user?.id;

  const {
    chapter,
    course,
    muxData,
    attachments,
    nextChapter,
    userProgress,
    purchase,
    isLocked,
  } = await getChapter({
    userId: userId || null,
    chapterId: params.chapterId,
    courseId: params.courseId,
  });

  if (!chapter || !course) {
    return redirect("/")
  }

  // Fetch initial Quiz Data if chapter is a quiz and unlocked
  let quizData = null;
  if (chapter.type === "quiz" && userId && !isLocked) {
    try {
      const quizzes = await db.request(
        readItems("Quizzes", {
          filter: { module_id: { _eq: params.chapterId } },
          limit: 1,
        })
      );
      const quizRecord = quizzes[0];
      if (quizRecord) {
        const questions = await db.request(
          readItems("Questions", {
            filter: { quiz_id: { _eq: quizRecord.id } },
            sort: ["id"],
          })
        );

        const progresses = await db.request(
          readItems("QuizProgress", {
            filter: {
              user_id: { _eq: userId },
              module_id: { _eq: params.chapterId },
            },
            limit: 1,
          })
        );
        const progress = progresses[0] || null;

        const isCompleted = progress?.is_completed || false;
        const userAnswers = (progress?.answers as Record<string, number>) || {};

        const correctAnswers: Record<string, { correctIndex: number; explanation: string }> = {};
        const sanitizedQuestions = questions.map((q) => {
          const isAnswered = q.id in userAnswers;
          const shouldReveal = isCompleted || isAnswered;

          if (shouldReveal) {
            correctAnswers[q.id] = {
              correctIndex: q.correct_answer_index,
              explanation: q.explanation || "",
            };
          }

          return {
            id: q.id,
            question_text: q.question_text,
            options: q.options,
            explanation: shouldReveal ? q.explanation : undefined,
          };
        });

        quizData = {
          isCompleted,
          answers: userAnswers,
          questions: sanitizedQuestions,
          correctAnswers,
          passingScore: quizRecord.passing_score,
        };
      }
    } catch (err) {
      console.error("[QUIZ_SERVER_FETCH_ERROR]", err);
    }
  }

  // Fetch initial Essay Data if chapter is an essay and unlocked
  let essayData = null;
  if (chapter.type === "essay" && userId && !isLocked) {
    try {
      const submissions = await db.request(
        readItems("Submissions", {
          filter: {
            user_id: { _eq: userId },
            course_id: { _eq: params.courseId },
          },
          limit: 1,
        })
      );
      essayData = submissions[0] || null;
    } catch (err) {
      console.error("[ESSAY_SERVER_FETCH_ERROR]", err);
    }
  }

  const completeOnEnd = !!purchase && !userProgress?.isCompleted;

  return ( 
    <div>
      {userProgress?.isCompleted && chapter.type === "video" && (
        <Banner
          variant="success"
          label="You already completed this chapter."
        />
      )}
      {isLocked && (
        <Banner
          variant="warning"
          label={purchase ? "This module is locked. Please complete all preceding modules first." : "You need to purchase this course to access this chapter."}
        />
      )}
      {searchParams.success === "1" && !purchase && (
        <PaymentVerificationPoller courseId={params.courseId} />
      )}
      <div className="flex flex-col max-w-7xl mx-auto pb-20">
        {isLocked && (chapter.type === "quiz" || chapter.type === "essay") ? (
          <div className="p-4 flex flex-col items-center justify-center min-h-[400px] text-center bg-slate-50 border border-slate-200 rounded-xl mt-6 mx-4">
            <Lock className="h-12 w-12 text-slate-400 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-800">Module Locked</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md">
              {purchase 
                ? "This assessment module is locked. You must complete all preceding video modules first."
                : "You must purchase this course to unlock assessments."}
            </p>
          </div>
        ) : (
          <>
            {chapter.type === "quiz" && quizData && (
              <div className="p-4">
                <QuizAssessment
                  courseId={params.courseId}
                  chapterId={params.chapterId}
                  nextChapterId={nextChapter?.id}
                  initialData={quizData}
                />
              </div>
            )}

            {chapter.type === "essay" && (
              <div className="p-4">
                <EssayAssessment
                  courseId={params.courseId}
                  chapterId={params.chapterId}
                  initialData={essayData}
                />
              </div>
            )}

            {(chapter.type === "video" || !chapter.type) && (
              <>
                <div className="p-4">
                  <VideoPlayer
                    chapterId={params.chapterId}
                    title={chapter.title}
                    courseId={params.courseId}
                    nextChapterId={nextChapter?.id}
                    playbackId={muxData?.playbackId!}
                    isLocked={isLocked}
                    completeOnEnd={completeOnEnd}
                  />
                </div>
                <div>
                  <div className="p-4 flex flex-col md:flex-row items-center justify-between">
                    <h2 className="text-2xl font-semibold mb-2">
                      {chapter.title}
                    </h2>
                    {purchase ? (
                      <CourseProgressButton
                        chapterId={params.chapterId}
                        courseId={params.courseId}
                        nextChapterId={nextChapter?.id}
                        isCompleted={!!userProgress?.isCompleted}
                      />
                    ) : (
                      <CourseEnrollButton
                        courseId={params.courseId}
                        price={(course as any).price}
                        isLoggedIn={!!userId}
                        chapterId={params.chapterId}
                      />
                    )}
                  </div>
                  <Separator />
                  <div>
                    <Preview value={chapter.description!} />
                  </div>
                  {!!attachments.length && (
                    <>
                      <Separator />
                      <div className="p-4">
                        {attachments.map((attachment) => (
                          <a 
                            href={attachment.url}
                            target="_blank"
                            key={attachment.id}
                            className="flex items-center p-3 w-full bg-sky-200 border text-sky-700 rounded-md hover:underline"
                          >
                            <File />
                            <p className="line-clamp-1">
                              {attachment.name}
                            </p>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
   );
}

export default ChapterIdPage;