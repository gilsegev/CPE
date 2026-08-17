import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readItems, createItem, updateItem } from "@directus/sdk";

async function completeCourseWithoutEssay({
  userId,
  courseId,
  quizScore,
}: {
  userId: string;
  courseId: string;
  quizScore: number;
}) {
  const modules = await db.request(
    readItems("Modules", {
      filter: { course_id: { _eq: courseId } },
      fields: ["id", "type"],
    })
  );

  // Essay-based courses keep using instructor approval as their certificate gate.
  if (modules.some((module) => module.type === "essay")) {
    return false;
  }

  const requiredModuleIds = modules
    .filter((module) => module.type === "video" || module.type === "quiz" || !module.type)
    .map((module) => module.id);

  const completedProgress = await db.request(
    readItems("UserProgress", {
      filter: {
        user_id: { _eq: userId },
        module_id: { _in: requiredModuleIds },
        is_completed: { _eq: true },
      },
      fields: ["module_id"],
    })
  );
  const completedModuleIds = new Set(completedProgress.map((item) => item.module_id));

  if (!requiredModuleIds.every((moduleId) => completedModuleIds.has(moduleId))) {
    return false;
  }

  const existingCertificates = await db.request(
    readItems("Certificates", {
      filter: {
        user_id: { _eq: userId },
        course_id: { _eq: courseId },
      },
      limit: 1,
      fields: ["id"],
    })
  );
  if (existingCertificates.length > 0) {
    return true;
  }

  // The existing Directus webhook issues certificates when a Submission becomes
  // Approved. For courses without essays, this record is the completion adapter.
  const existingCompletions = await db.request(
    readItems("Submissions", {
      filter: {
        user_id: { _eq: userId },
        course_id: { _eq: courseId },
      },
      limit: 1,
      fields: ["id", "status"],
    })
  );

  const completion = existingCompletions[0] || await db.request(
    createItem("Submissions", {
      user_id: userId,
      course_id: courseId,
      quiz_score: quizScore,
      essay_text: "Course completed without an essay assessment.",
      status: "Pending",
    })
  );

  await db.request(
    updateItem("Submissions", completion.id, {
      quiz_score: quizScore,
      status: "Approved",
    })
  );

  return true;
}

export async function GET(
  req: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 1. Fetch Quiz record linked to this module
    const quizzes = await db.request(
      readItems("Quizzes", {
        filter: { module_id: { _eq: params.chapterId } },
        limit: 1,
      })
    );
    const quiz = quizzes[0];
    if (!quiz) {
      return new NextResponse("Quiz not found", { status: 404 });
    }

    // 2. Fetch all questions for this quiz, ordered by ID for deterministic display
    const questions = await db.request(
      readItems("Questions", {
        filter: { quiz_id: { _eq: quiz.id } },
        sort: ["id"],
      })
    );

    // 3. Load or create user's QuizProgress record
    const progresses = await db.request(
      readItems("QuizProgress", {
        filter: {
          user_id: { _eq: user.id },
          module_id: { _eq: params.chapterId },
        },
        limit: 1,
      })
    );

    let progress = progresses[0];
    if (!progress) {
      progress = await db.request(
        createItem("QuizProgress", {
          user_id: user.id,
          module_id: params.chapterId,
          answers: {},
          is_completed: false,
        })
      );
    }

    const isCompleted = progress.is_completed;
    const userAnswers = (progress.answers as Record<string, number>) || {};

    // 4. Build response questions list, hiding correct answers for unanswered ones
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

    return NextResponse.json({
      isCompleted,
      progressId: progress.id,
      answers: userAnswers,
      questions: sanitizedQuestions,
      correctAnswers,
      passingScore: quiz.passing_score,
    });
  } catch (error) {
    console.error("[QUIZ_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { courseId: string; chapterId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { action, questionId, answerIndex } = await req.json();

    // Fetch existing QuizProgress, creating it on demand if missing
    const progresses = await db.request(
      readItems("QuizProgress", {
        filter: {
          user_id: { _eq: user.id },
          module_id: { _eq: params.chapterId },
        },
        limit: 1,
      })
    );
    let progress = progresses[0];
    if (!progress) {
      progress = await db.request(
        createItem("QuizProgress", {
          user_id: user.id,
          module_id: params.chapterId,
          answers: {},
          is_completed: false,
        })
      );
    }

    // Load Quiz & Questions
    const quizzes = await db.request(
      readItems("Quizzes", {
        filter: { module_id: { _eq: params.chapterId } },
        limit: 1,
      })
    );
    const quiz = quizzes[0];
    if (!quiz) {
      return new NextResponse("Quiz not found", { status: 404 });
    }

    const questions = await db.request(
      readItems("Questions", {
        filter: { quiz_id: { _eq: quiz.id } },
        sort: ["id"],
      })
    );

    const answers = (progress.answers as Record<string, number>) || {};

    if (action === "submit-answer") {
      if (progress.is_completed) {
        return new NextResponse("Quiz already completed", { status: 400 });
      }

      const question = questions.find((q) => q.id === questionId);
      if (!question) {
        return new NextResponse("Question not found", { status: 404 });
      }

      // Update answers map
      answers[questionId] = answerIndex;

      await db.request(
        updateItem("QuizProgress", progress.id, {
          answers,
        })
      );

      const isCorrect = question.correct_answer_index === answerIndex;

      return NextResponse.json({
        correct: isCorrect,
        correctIndex: question.correct_answer_index,
        explanation: question.explanation || "",
      });
    }

    if (action === "submit-quiz") {
      // Verify that all questions are answered
      const unanswered = questions.some((q) => !(q.id in answers));
      if (unanswered) {
        return new NextResponse("Not all questions answered", { status: 400 });
      }

      // Calculate score
      let correctCount = 0;
      const correctAnswersMap: Record<string, number> = {};

      questions.forEach((q) => {
        correctAnswersMap[q.id] = q.correct_answer_index;
        if (answers[q.id] === q.correct_answer_index) {
          correctCount++;
        }
      });

      const totalCount = questions.length;
      const score = Math.round((correctCount / totalCount) * 100);
      const passed = score >= quiz.passing_score;

      // Update QuizProgress completion state
      await db.request(
        updateItem("QuizProgress", progress.id, {
          is_completed: true,
        })
      );

      // If passed, create/update UserProgress for this chapter/module
      if (passed) {
        const existingUserProgress = await db.request(
          readItems("UserProgress", {
            filter: {
              user_id: { _eq: user.id },
              module_id: { _eq: params.chapterId },
            },
            limit: 1,
          })
        );

        if (existingUserProgress[0]) {
          await db.request(
            updateItem("UserProgress", existingUserProgress[0].id, {
              is_completed: true,
            })
          );
        } else {
          await db.request(
            createItem("UserProgress", {
              user_id: user.id,
              module_id: params.chapterId,
              is_completed: true,
            })
          );
        }

        await completeCourseWithoutEssay({
          userId: user.id,
          courseId: params.courseId,
          quizScore: score,
        });
      }

      return NextResponse.json({
        score,
        passed,
        correctAnswers: correctAnswersMap,
      });
    }

    if (action === "reset") {
      // Clear QuizProgress answers and set is_completed to false
      await db.request(
        updateItem("QuizProgress", progress.id, {
          answers: {},
          is_completed: false,
        })
      );

      // Also reset UserProgress for this chapter to false
      const existingUserProgress = await db.request(
        readItems("UserProgress", {
          filter: {
            user_id: { _eq: user.id },
            module_id: { _eq: params.chapterId },
          },
          limit: 1,
        })
      );

      if (existingUserProgress[0]) {
        await db.request(
          updateItem("UserProgress", existingUserProgress[0].id, {
            is_completed: false,
          })
        );
      }

      return NextResponse.json({ success: true });
    }

    return new NextResponse("Bad Request", { status: 400 });
  } catch (error) {
    console.error("[QUIZ_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
