import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readItems, createItem, updateItem } from "@directus/sdk";

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
      if (progress.is_completed) {
        return NextResponse.json({
          alreadyCompleted: true,
          isCompleted: true,
        });
      }

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
