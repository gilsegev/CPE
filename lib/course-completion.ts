import {
  createItem,
  readItem,
  readItems,
  readUser,
  updateItem,
} from "@directus/sdk";

import { db, type Certificate, type CourseCompletion, type DirectusUser, type Module, type QuizAttempt, type UserProgress } from "@/lib/db";
import {
  buildModuleSnapshot,
  calculateCpeTotal,
  createOrReadUnique,
  isModuleComplete,
  isV2ContentModule,
  relationId,
} from "@/lib/course-completion-rules";

export class CourseWorkflowError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CourseWorkflowError";
  }
}

type WorkflowCourse = {
  id: string;
  title: string;
  is_published: boolean;
  structure_version?: "legacy" | "module_quiz_v2";
};

type WorkflowModule = Module & { course_id: string };

type CompletionState = {
  completion: CourseCompletion;
  certificate: Certificate | null;
} | null;

type ModuleContext = {
  course: WorkflowCourse;
  modules: WorkflowModule[];
  module: WorkflowModule;
  progressByModule: Map<string, UserProgress>;
};

const nowIso = () => new Date().toISOString();

async function dispatchCertificateWork(certificateId: string) {
  const workerUrl = process.env.N8N_CERTIFICATE_WEBHOOK_URL;
  if (!workerUrl) {
    console.error(
      `[CERTIFICATE_DISPATCH] N8N_CERTIFICATE_WEBHOOK_URL is not configured; certificate ${certificateId} remains pending for reconciliation.`,
    );
    return;
  }
  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ certificateId }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Certificate worker returned HTTP ${response.status}`);
  } catch (error) {
    console.error("[CERTIFICATE_DISPATCH] Pending work will be recovered by reconciliation.", error);
  }
}

const isUniqueConflict = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  return /RECORD_NOT_UNIQUE|duplicate key|unique constraint|already exists|has to be unique/i.test(message);
};

async function requireV2ModuleAccess(userId: string, courseId: string, moduleId: string): Promise<ModuleContext> {
  const course = await db.request(
    readItem("Courses", courseId, {
      fields: ["id", "title", "is_published", "structure_version"],
    }),
  ) as WorkflowCourse;

  if (!course?.is_published) {
    throw new CourseWorkflowError("Course not found.", 404, "course_not_found");
  }
  if (course.structure_version !== "module_quiz_v2") {
    throw new CourseWorkflowError("This command is only available for module-based courses.", 409, "legacy_course");
  }

  const purchases = await db.request(
    readItems("Purchases", {
      filter: {
        user_id: { _eq: userId },
        course_id: { _eq: courseId },
        status: { _eq: "active" },
      },
      fields: ["id"],
      limit: 1,
    }),
  );
  if (!purchases[0]) {
    throw new CourseWorkflowError("An active purchase is required.", 403, "purchase_required");
  }

  const allModules = await db.request(
    readItems("Modules", {
      filter: { course_id: { _eq: courseId } },
      sort: ["order_index"],
      fields: ["id", "course_id", "title", "order_index", "mux_asset_id", "is_free_preview", "type", "cpe_value", "migration_status"],
    }),
  ) as WorkflowModule[];
  const modules = allModules.filter(isV2ContentModule);
  const selectedModule = modules.find((candidate) => candidate.id === moduleId);
  if (!selectedModule || relationId(selectedModule.course_id) !== courseId) {
    throw new CourseWorkflowError("Module does not belong to this course.", 404, "module_not_found");
  }

  const progressRows = modules.length > 0 ? await db.request(
    readItems("UserProgress", {
      filter: {
        user_id: { _eq: userId },
        module_id: { _in: modules.map((candidate) => candidate.id) },
      },
      fields: ["id", "user_id", "module_id", "is_completed", "content_completed_at", "quiz_passed_at", "completed_at"],
    }),
  ) : [];
  const progressByModule = new Map(progressRows.map((progress) => [relationId(progress.module_id), progress]));

  const moduleIndex = modules.findIndex((candidate) => candidate.id === moduleId);
  const incompletePrerequisite = modules
    .slice(0, moduleIndex)
    .find((candidate) => !progressByModule.get(candidate.id)?.completed_at);
  if (incompletePrerequisite) {
    throw new CourseWorkflowError("Complete the preceding module first.", 409, "prerequisite_incomplete");
  }

  return { course, modules, module: selectedModule, progressByModule };
}

async function getEnabledQuiz(moduleId: string) {
  const quizzes = await db.request(
    readItems("Quizzes", {
      filter: { module_id: { _eq: moduleId }, is_enabled: { _eq: true } },
      fields: ["id", "module_id", "passing_score", "is_enabled"],
      limit: 1,
    }),
  );
  return quizzes[0] || null;
}

async function readProgress(userId: string, moduleId: string) {
  const rows = await db.request(
    readItems("UserProgress", {
      filter: { user_id: { _eq: userId }, module_id: { _eq: moduleId } },
      fields: ["id", "user_id", "module_id", "is_completed", "content_completed_at", "quiz_passed_at", "completed_at"],
      limit: 1,
    }),
  );
  return rows[0] || null;
}

async function createOrReadProgress(userId: string, moduleId: string) {
  const existing = await readProgress(userId, moduleId);
  if (existing) return existing;
  try {
    return await db.request(
      createItem("UserProgress", {
        user_id: userId,
        module_id: moduleId,
        is_completed: false,
        content_completed_at: null,
        quiz_passed_at: null,
        completed_at: null,
      }),
    );
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const concurrent = await readProgress(userId, moduleId);
    if (!concurrent) throw error;
    return concurrent;
  }
}

async function readCompletionState(userId: string, courseId: string): Promise<CompletionState> {
  const completions = await db.request(
    readItems("CourseCompletions", {
      filter: { user_id: { _eq: userId }, course_id: { _eq: courseId } },
      fields: ["id", "user_id", "course_id", "completed_at", "cpe_earned", "module_snapshot", "final_quiz_attempt_id"],
      limit: 1,
    }),
  );
  const completion = completions[0];
  if (!completion) return null;

  const certificates = await db.request(
    readItems("Certificates", {
      filter: { completion_id: { _eq: completion.id } },
      fields: [
        "id", "user_id", "course_id", "completion_id", "status", "legal_name_snapshot",
        "course_title_snapshot", "cpe_earned", "pdf_url", "issued_date", "emailed_at",
        "attempt_count", "last_attempt_at",
      ],
      limit: 1,
    }),
  );
  return { completion, certificate: certificates[0] || null };
}

async function ensureCertificate(
  completion: CourseCompletion,
  userId: string,
  course: WorkflowCourse,
  legalName: string,
) {
  const existing = await db.request(
    readItems("Certificates", {
      filter: { completion_id: { _eq: completion.id } },
      limit: 1,
    }),
  );
  if (existing[0]) return existing[0];

  const result = await createOrReadUnique(
    () => db.request(
      createItem("Certificates", {
        user_id: userId,
        course_id: course.id,
        completion_id: completion.id,
        status: "pending",
        legal_name_snapshot: legalName,
        course_title_snapshot: course.title,
        cpe_earned: completion.cpe_earned,
        pdf_url: null,
        issued_date: null,
        emailed_at: null,
        attempt_count: 0,
        last_attempt_at: null,
        failure_code: null,
        failure_detail: null,
      }),
    ),
    async () => {
      const concurrent = await db.request(
        readItems("Certificates", {
          filter: { completion_id: { _eq: completion.id } },
          limit: 1,
        }),
      );
      return concurrent[0] || null;
    },
    isUniqueConflict,
  );
  if (result.created) await dispatchCertificateWork(result.value.id);
  return result.value;
}

async function ensureCourseCompletion(
  user: DirectusUser,
  context: ModuleContext,
  finalAttempt: QuizAttempt,
): Promise<CompletionState> {
  const existingState = await readCompletionState(user.id, context.course.id);
  if (existingState) {
    if (existingState.certificate) {
      if (existingState.certificate.status === "pending") {
        await dispatchCertificateWork(existingState.certificate.id);
      }
      return existingState;
    }
    const legalName = user.legal_name?.trim();
    if (!legalName) {
      throw new CourseWorkflowError("Confirm the learner's legal name before certificate creation.", 422, "legal_name_required");
    }
    const certificate = await ensureCertificate(existingState.completion, user.id, context.course, legalName);
    return { completion: existingState.completion, certificate };
  }

  const finalModule = context.modules[context.modules.length - 1];
  if (!finalModule || finalModule.id !== context.module.id) return null;
  if (!finalAttempt.passed || finalAttempt.status !== "submitted") return null;

  const progressRows = await db.request(
    readItems("UserProgress", {
      filter: {
        user_id: { _eq: user.id },
        module_id: { _in: context.modules.map((module) => module.id) },
      },
      fields: ["id", "user_id", "module_id", "is_completed", "content_completed_at", "quiz_passed_at", "completed_at"],
    }),
  );
  const progressByModule = new Map(progressRows.map((progress) => [relationId(progress.module_id), progress]));
  if (context.modules.some((module) => !progressByModule.get(module.id)?.completed_at)) return null;

  const quizzes = await db.request(
    readItems("Quizzes", {
      filter: {
        module_id: { _in: context.modules.map((module) => module.id) },
        is_enabled: { _eq: true },
      },
      fields: ["id", "module_id"],
    }),
  );
  const quizIds = quizzes.map((quiz) => quiz.id);
  const passedAttempts = quizIds.length > 0 ? await db.request(
    readItems("QuizAttempts", {
      filter: {
        user_id: { _eq: user.id },
        quiz_id: { _in: quizIds },
        status: { _eq: "submitted" },
        passed: { _eq: true },
      },
      sort: ["attempt_number"],
      fields: ["id", "quiz_id", "attempt_number"],
    }),
  ) : [];
  const moduleByQuiz = new Map(quizzes.map((quiz) => [quiz.id, relationId(quiz.module_id)]));
  const passingAttemptByModule = new Map<string, string>();
  for (const attempt of passedAttempts) {
    const moduleId = moduleByQuiz.get(relationId(attempt.quiz_id));
    if (moduleId && !passingAttemptByModule.has(moduleId)) passingAttemptByModule.set(moduleId, attempt.id);
  }
  passingAttemptByModule.set(finalModule.id, finalAttempt.id);

  const cpeEarned = calculateCpeTotal(context.modules);
  if (cpeEarned <= 0) {
    throw new CourseWorkflowError("Certificate-awarding courses must have a positive CPE total.", 409, "invalid_course_cpe");
  }
  const legalName = user.legal_name?.trim();
  if (!legalName) {
    throw new CourseWorkflowError("Confirm the learner's legal name before course completion.", 422, "legal_name_required");
  }
  const moduleSnapshot = buildModuleSnapshot(context.modules, progressByModule, passingAttemptByModule);
  const completedAt = nowIso();

  const completionResult = await createOrReadUnique(
    () => db.request(
      createItem("CourseCompletions", {
        user_id: user.id,
        course_id: context.course.id,
        completed_at: completedAt,
        cpe_earned: cpeEarned,
        module_snapshot: moduleSnapshot as unknown as Array<Record<string, unknown>>,
        final_quiz_attempt_id: finalAttempt.id,
      }),
    ),
    async () => {
      const concurrent = await db.request(
        readItems("CourseCompletions", {
          filter: { user_id: { _eq: user.id }, course_id: { _eq: context.course.id } },
          limit: 1,
        }),
      );
      return concurrent[0] || null;
    },
    isUniqueConflict,
  );
  const completion: CourseCompletion = completionResult.value;

  const certificate = await ensureCertificate(completion, user.id, context.course, legalName);
  return { completion, certificate };
}

export async function completeModuleContent(user: DirectusUser, courseId: string, moduleId: string) {
  const context = await requireV2ModuleAccess(user.id, courseId, moduleId);
  const progress = await createOrReadProgress(user.id, moduleId);
  const quiz = await getEnabledQuiz(moduleId);
  const timestamp = progress.content_completed_at || nowIso();
  const completionSatisfied = isModuleComplete(
    { content_completed_at: timestamp, quiz_passed_at: progress.quiz_passed_at },
    Boolean(quiz),
  );
  const completedAt = progress.completed_at || (completionSatisfied ? progress.quiz_passed_at || timestamp : null);

  const updated = await db.request(
    updateItem("UserProgress", progress.id, {
      content_completed_at: timestamp,
      completed_at: completedAt,
      is_completed: Boolean(completedAt),
    }),
  );

  const currentIndex = context.modules.findIndex((module) => module.id === moduleId);
  return {
    progress: updated,
    moduleComplete: Boolean(updated.completed_at),
    quizRequired: Boolean(quiz),
    nextModuleId: updated.completed_at ? context.modules[currentIndex + 1]?.id || null : null,
  };
}

async function getQuestions(quizId: string) {
  return db.request(
    readItems("Questions", {
      filter: { quiz_id: { _eq: quizId } },
      sort: ["order_index", "id"],
      fields: ["id", "quiz_id", "question_text", "options", "correct_answer_index", "explanation", "order_index"],
    }),
  );
}

async function createAttempt(userId: string, quizId: string) {
  const attempts = await db.request(
    readItems("QuizAttempts", {
      filter: { user_id: { _eq: userId }, quiz_id: { _eq: quizId } },
      sort: ["-attempt_number"],
      fields: ["id", "attempt_number"],
      limit: 1,
    }),
  );
  const attemptNumber = Number(attempts[0]?.attempt_number || 0) + 1;
  try {
    return await db.request(
      createItem("QuizAttempts", {
        user_id: userId,
        quiz_id: quizId,
        attempt_number: attemptNumber,
        status: "in_progress",
        answers: {},
        result_snapshot: null,
        score: null,
        passed: null,
        started_at: nowIso(),
        submitted_at: null,
      }),
    );
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const concurrent = await db.request(
      readItems("QuizAttempts", {
        filter: { user_id: { _eq: userId }, quiz_id: { _eq: quizId }, status: { _eq: "in_progress" } },
        limit: 1,
      }),
    );
    if (!concurrent[0]) throw error;
    return concurrent[0];
  }
}

async function getAttemptForQuizState(userId: string, quizId: string) {
  const attempts = await db.request(
    readItems("QuizAttempts", {
      filter: { user_id: { _eq: userId }, quiz_id: { _eq: quizId } },
      sort: ["-attempt_number"],
      fields: ["id", "user_id", "quiz_id", "attempt_number", "status", "answers", "result_snapshot", "score", "passed", "started_at", "submitted_at"],
      limit: 1,
    }),
  );
  return attempts[0] || createAttempt(userId, quizId);
}

function serializeQuizState(
  quiz: { id: string; passing_score: number },
  questions: Awaited<ReturnType<typeof getQuestions>>,
  attempt: QuizAttempt,
  completionState: CompletionState,
) {
  const answers = (attempt.answers || {}) as Record<string, number>;
  const correctAnswers: Record<string, { correctIndex: number; explanation: string }> = {};
  const sanitizedQuestions = questions.map((question) => {
    const revealed = Object.prototype.hasOwnProperty.call(answers, question.id);
    if (revealed) {
      correctAnswers[question.id] = {
        correctIndex: question.correct_answer_index,
        explanation: question.explanation || "",
      };
    }
    return {
      id: question.id,
      question_text: question.question_text,
      options: question.options,
      explanation: revealed ? question.explanation || "" : undefined,
    };
  });

  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attempt_number,
    isCompleted: attempt.status === "submitted",
    score: attempt.score ?? null,
    passed: attempt.passed ?? null,
    answers,
    questions: sanitizedQuestions,
    correctAnswers,
    passingScore: quiz.passing_score,
    courseCompletion: completionState ? {
      id: completionState.completion.id,
      completedAt: completionState.completion.completed_at,
      cpeEarned: completionState.completion.cpe_earned,
      certificate: {
        id: completionState.certificate?.id || "",
        status: completionState.certificate?.status || "pending",
        pdfUrl: completionState.certificate?.pdf_url || null,
        issuedDate: completionState.certificate?.issued_date || null,
      },
    } : null,
  };
}

export async function getOrStartQuizState(user: DirectusUser, courseId: string, moduleId: string) {
  const context = await requireV2ModuleAccess(user.id, courseId, moduleId);
  const progress = await readProgress(user.id, moduleId);
  if (!progress?.content_completed_at) {
    throw new CourseWorkflowError("Complete the module content before starting its quiz.", 409, "content_incomplete");
  }
  const quiz = await getEnabledQuiz(moduleId);
  if (!quiz) throw new CourseWorkflowError("Enabled module quiz not found.", 404, "quiz_not_found");
  const questions = await getQuestions(quiz.id);
  if (questions.length === 0) throw new CourseWorkflowError("The module quiz has no questions.", 409, "quiz_empty");
  const attempt = await getAttemptForQuizState(user.id, quiz.id);
  const completionState = await readCompletionState(user.id, courseId);
  return serializeQuizState(quiz, questions, attempt, completionState);
}

async function requireAttempt(userId: string, quizId: string, attemptId: string) {
  const attempts = await db.request(
    readItems("QuizAttempts", {
      filter: { id: { _eq: attemptId }, user_id: { _eq: userId }, quiz_id: { _eq: quizId } },
      fields: ["id", "user_id", "quiz_id", "attempt_number", "status", "answers", "result_snapshot", "score", "passed", "started_at", "submitted_at"],
      limit: 1,
    }),
  );
  if (!attempts[0]) throw new CourseWorkflowError("Quiz attempt not found.", 404, "attempt_not_found");
  return attempts[0];
}

export async function submitQuizAnswer(
  user: DirectusUser,
  courseId: string,
  moduleId: string,
  input: { attemptId: string; questionId: string; answerIndex: number },
) {
  await requireV2ModuleAccess(user.id, courseId, moduleId);
  const progress = await readProgress(user.id, moduleId);
  if (!progress?.content_completed_at) {
    throw new CourseWorkflowError("Complete the module content before answering its quiz.", 409, "content_incomplete");
  }
  const quiz = await getEnabledQuiz(moduleId);
  if (!quiz) throw new CourseWorkflowError("Enabled module quiz not found.", 404, "quiz_not_found");
  const attempt = await requireAttempt(user.id, quiz.id, input.attemptId);
  if (attempt.status !== "in_progress") {
    throw new CourseWorkflowError("Submitted quiz attempts are immutable.", 409, "attempt_submitted");
  }

  const questions = await getQuestions(quiz.id);
  const question = questions.find((candidate) => candidate.id === input.questionId);
  if (!question) throw new CourseWorkflowError("Question does not belong to this quiz.", 404, "question_not_found");
  if (!Number.isInteger(input.answerIndex) || input.answerIndex < 0 || input.answerIndex >= question.options.length) {
    throw new CourseWorkflowError("Answer index is invalid.", 400, "invalid_answer");
  }

  const answers = { ...((attempt.answers || {}) as Record<string, number>) };
  const existingAnswer = answers[question.id];
  if (existingAnswer !== undefined && existingAnswer !== input.answerIndex) {
    throw new CourseWorkflowError("A submitted answer cannot be changed during this attempt.", 409, "answer_immutable");
  }
  answers[question.id] = input.answerIndex;
  if (existingAnswer === undefined) {
    await db.request(updateItem("QuizAttempts", attempt.id, { answers }));
  }
  return {
    correct: question.correct_answer_index === input.answerIndex,
    correctIndex: question.correct_answer_index,
    explanation: question.explanation || "",
  };
}

async function advancePassedQuiz(user: DirectusUser, context: ModuleContext, attempt: QuizAttempt) {
  const progress = await createOrReadProgress(user.id, context.module.id);
  if (!progress.content_completed_at) {
    throw new CourseWorkflowError("Module content completion is required.", 409, "content_incomplete");
  }
  const passedAt = progress.quiz_passed_at || attempt.submitted_at || nowIso();
  await db.request(
    updateItem("UserProgress", progress.id, {
      quiz_passed_at: passedAt,
      completed_at: progress.completed_at || passedAt,
      is_completed: true,
    }),
  );
  return ensureCourseCompletion(user, context, attempt);
}

export async function submitQuizAttempt(
  user: DirectusUser,
  courseId: string,
  moduleId: string,
  attemptId: string,
) {
  const context = await requireV2ModuleAccess(user.id, courseId, moduleId);
  const progress = await readProgress(user.id, moduleId);
  if (!progress?.content_completed_at) {
    throw new CourseWorkflowError("Complete the module content before submitting its quiz.", 409, "content_incomplete");
  }
  const quiz = await getEnabledQuiz(moduleId);
  if (!quiz) throw new CourseWorkflowError("Enabled module quiz not found.", 404, "quiz_not_found");
  const questions = await getQuestions(quiz.id);
  if (questions.length === 0) throw new CourseWorkflowError("The module quiz has no questions.", 409, "quiz_empty");
  let attempt = await requireAttempt(user.id, quiz.id, attemptId);

  if (attempt.status === "submitted") {
    const completionState = attempt.passed ? await advancePassedQuiz(user, context, attempt) : await readCompletionState(user.id, courseId);
    return serializeQuizState(quiz, questions, attempt, completionState);
  }

  const answers = (attempt.answers || {}) as Record<string, number>;
  if (questions.some((question) => !Object.prototype.hasOwnProperty.call(answers, question.id))) {
    throw new CourseWorkflowError("Answer every question before submitting the quiz.", 400, "answers_incomplete");
  }

  const correctCount = questions.filter((question) => answers[question.id] === question.correct_answer_index).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= quiz.passing_score;
  const submittedAt = nowIso();
  const resultSnapshot = questions.map((question) => ({
    question_id: question.id,
    question_text: question.question_text,
    options: question.options,
    selected_answer_index: answers[question.id],
    correct_answer_index: question.correct_answer_index,
    correct: answers[question.id] === question.correct_answer_index,
    explanation: question.explanation || "",
  }));

  attempt = await db.request(
    updateItem("QuizAttempts", attempt.id, {
      status: "submitted",
      result_snapshot: resultSnapshot,
      score,
      passed,
      submitted_at: submittedAt,
    }),
  );

  const completionState = passed
    ? await advancePassedQuiz(user, context, attempt)
    : await readCompletionState(user.id, courseId);
  return serializeQuizState(quiz, questions, attempt, completionState);
}

export async function startQuizRetake(user: DirectusUser, courseId: string, moduleId: string) {
  await requireV2ModuleAccess(user.id, courseId, moduleId);
  const progress = await readProgress(user.id, moduleId);
  if (!progress?.content_completed_at) {
    throw new CourseWorkflowError("Complete the module content before starting a retake.", 409, "content_incomplete");
  }
  const quiz = await getEnabledQuiz(moduleId);
  if (!quiz) throw new CourseWorkflowError("Enabled module quiz not found.", 404, "quiz_not_found");
  const completionState = await readCompletionState(user.id, courseId);
  if (completionState) throw new CourseWorkflowError("A completed course cannot be reset.", 409, "course_already_completed");

  const latest = await db.request(
    readItems("QuizAttempts", {
      filter: { user_id: { _eq: user.id }, quiz_id: { _eq: quiz.id } },
      sort: ["-attempt_number"],
      fields: ["id", "status", "passed"],
      limit: 1,
    }),
  );
  if (latest[0]?.passed) throw new CourseWorkflowError("A passing attempt cannot be reset.", 409, "quiz_already_passed");
  if (latest[0]?.status === "in_progress") return getOrStartQuizState(user, courseId, moduleId);
  await createAttempt(user.id, quiz.id);
  return getOrStartQuizState(user, courseId, moduleId);
}

export async function retryCertificate(certificateId: string) {
  const certificate = await db.request(readItem("Certificates", certificateId));
  if (!certificate) throw new CourseWorkflowError("Certificate not found.", 404, "certificate_not_found");
  if (certificate.status !== "failed") {
    throw new CourseWorkflowError("Only failed certificates can be retried.", 409, "certificate_not_failed");
  }
  return db.request(
    updateItem("Certificates", certificateId, {
      status: "pending",
      failure_code: null,
      failure_detail: null,
    }),
  );
}

export async function reconcileCertificates(staleBefore: Date) {
  const completions = await db.request(
    readItems("CourseCompletions", {
      fields: ["id", "user_id", "course_id", "completed_at", "cpe_earned", "module_snapshot", "final_quiz_attempt_id"],
      limit: -1,
    }),
  );
  const certificates = await db.request(
    readItems("Certificates", {
      fields: ["id", "completion_id", "status", "last_attempt_at"],
      limit: -1,
    }),
  );
  const certificateByCompletion = new Map(
    certificates.filter((certificate) => certificate.completion_id).map((certificate) => [relationId(certificate.completion_id), certificate]),
  );
  const created: string[] = [];
  const recovered: string[] = [];

  for (const completion of completions) {
    if (certificateByCompletion.has(completion.id)) continue;
    const [course, user] = await Promise.all([
      db.request(readItem("Courses", relationId(completion.course_id), { fields: ["id", "title", "is_published", "structure_version"] })) as Promise<WorkflowCourse>,
      db.request(readUser(relationId(completion.user_id), { fields: ["id", "legal_name"] as any })) as Promise<any>,
    ]);
    const legalName = String(user?.legal_name || "").trim();
    if (!legalName) continue;
    const certificate = await ensureCertificate(completion, relationId(completion.user_id), course, legalName);
    created.push(certificate.id);
  }

  for (const certificate of certificates) {
    if (
      certificate.status === "processing" &&
      certificate.last_attempt_at &&
      new Date(certificate.last_attempt_at).getTime() < staleBefore.getTime()
    ) {
      await db.request(
        updateItem("Certificates", certificate.id, {
          status: "failed",
          failure_code: "worker_timeout",
          failure_detail: "Certificate processing exceeded the expected timeout and is ready for an administrator retry.",
        }),
      );
      recovered.push(certificate.id);
    }
  }

  const pending = await db.request(
    readItems("Certificates", {
      filter: { status: { _eq: "pending" } },
      fields: ["id"],
      limit: -1,
    }),
  );
  return { created, recovered, pendingCertificateIds: pending.map((certificate) => certificate.id) };
}
