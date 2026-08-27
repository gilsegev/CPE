const { asId, byOrder, groupBy, validateManifest, V2_STRUCTURE_VERSION } = require("./core");
const { readInventory } = require("./directus");

function isConflict(error) {
  return /409|RECORD_NOT_UNIQUE|duplicate key/i.test(error.message);
}

function migrationSource(snapshot) {
  return snapshot && typeof snapshot === "object" ? snapshot.migration : null;
}

async function createOrRead(client, collection, payload, reread) {
  try {
    return await client.request(`/items/${collection}`, "POST", payload);
  } catch (error) {
    if (!isConflict(error)) throw error;
    const existing = await reread();
    if (!existing) throw error;
    return existing;
  }
}

async function ensureProgress(client, existingByUserModule, userId, moduleId) {
  const key = `${userId}:${moduleId}`;
  if (existingByUserModule.has(key)) return existingByUserModule.get(key);
  const created = await createOrRead(
    client,
    "UserProgress",
    { user_id: userId, module_id: moduleId, is_completed: false },
    async () => {
      const query = new URLSearchParams({
        "filter[user_id][_eq]": userId,
        "filter[module_id][_eq]": moduleId,
        limit: "1",
      });
      return (await client.request(`/items/UserProgress?${query}`))[0];
    },
  );
  existingByUserModule.set(key, created);
  return created;
}

function calculateLegacyScore(answers, questions) {
  if (!answers || questions.length === 0) return null;
  const answered = questions.filter((question) => Object.prototype.hasOwnProperty.call(answers, question.id));
  if (answered.length !== questions.length) return null;
  const correct = answered.filter((question) => Number(answers[question.id]) === Number(question.correct_answer_index)).length;
  return Math.round((correct / questions.length) * 100);
}

async function createMigratedAttempt({
  client,
  attempts,
  userId,
  quiz,
  questions,
  answers,
  passed,
  status,
  migratedAt,
  sourceCollection,
  sourceId,
}) {
  const existing = attempts.find((attempt) => {
    const source = migrationSource(attempt.result_snapshot);
    return source?.sourceCollection === sourceCollection && source?.sourceId === sourceId;
  });
  if (existing) return existing;

  const learnerAttempts = attempts.filter((attempt) => asId(attempt.user_id) === userId && asId(attempt.quiz_id) === quiz.id);
  const attemptNumber = Math.max(0, ...learnerAttempts.map((attempt) => Number(attempt.attempt_number))) + 1;
  const score = status === "submitted" ? calculateLegacyScore(answers, questions) : null;
  const resultSnapshot = {
    migration: { sourceCollection, sourceId, migratedAt, passEvidence: passed ? "completed_legacy_quiz_module_progress" : null },
    ...(status === "submitted"
      ? { questions: questions.map((question) => ({
          question_id: question.id,
          question_text: question.question_text,
          options: question.options,
          selected_answer_index: answers?.[question.id] ?? null,
          correct_answer_index: question.correct_answer_index,
          explanation: question.explanation || null,
        })) }
      : {}),
  };

  const created = await createOrRead(
    client,
    "QuizAttempts",
    {
      user_id: userId,
      quiz_id: quiz.id,
      attempt_number: attemptNumber,
      status,
      answers: answers || {},
      result_snapshot: resultSnapshot,
      score,
      passed: status === "submitted" ? Boolean(passed) : null,
      started_at: migratedAt,
      submitted_at: status === "submitted" ? migratedAt : null,
    },
    async () => {
      const rows = await client.listAll(
        "QuizAttempts",
        "id,user_id,quiz_id,attempt_number,status,answers,result_snapshot,score,passed,started_at,submitted_at",
      );
      return rows.find((attempt) => {
        const source = migrationSource(attempt.result_snapshot);
        return source?.sourceCollection === sourceCollection && source?.sourceId === sourceId;
      });
    },
  );
  attempts.push(created);
  return created;
}

async function migrateCourse(client, manifestCourse, inventory, migratedAt) {
  const course = inventory.courses.find((row) => row.id === manifestCourse.courseId);
  if (course.structure_version === V2_STRUCTURE_VERSION) {
    return { courseId: course.id, title: course.title, result: "already_migrated" };
  }

  const courseModules = inventory.modules.filter((module) => asId(module.course_id) === course.id);
  const moduleById = new Map(courseModules.map((module) => [module.id, module]));
  const quizById = new Map(inventory.quizzes.map((quiz) => [quiz.id, quiz]));
  const questionsByQuiz = groupBy(inventory.questions, (question) => asId(question.quiz_id));
  const mappingByShell = new Map(manifestCourse.quizMappings.map((mapping) => [mapping.legacyQuizModuleId, mapping]));
  const mappingByContent = new Map(manifestCourse.quizMappings.map((mapping) => [mapping.approvedContentModuleId, mapping]));

  for (const allocation of manifestCourse.contentModules) {
    await client.request(`/items/Modules/${allocation.moduleId}`, "PATCH", {
      cpe_value: allocation.cpeValue,
      migration_status: "v2_content",
    });
  }
  for (const mapping of manifestCourse.quizMappings) {
    await client.request(`/items/Quizzes/${mapping.quizId}`, "PATCH", {
      module_id: mapping.approvedContentModuleId,
      is_enabled: true,
    });
    await client.request(`/items/Modules/${mapping.legacyQuizModuleId}`, "PATCH", {
      migration_status: "migrated_quiz_shell",
    });
  }
  for (const legacyModule of manifestCourse.excludedLegacyModules.filter((module) => module.type === "essay")) {
    await client.request(`/items/Modules/${legacyModule.moduleId}`, "PATCH", {
      migration_status: "legacy_essay_history",
    });
  }

  const existingByUserModule = new Map(
    inventory.userProgress.map((progress) => [`${asId(progress.user_id)}:${asId(progress.module_id)}`, progress]),
  );
  const quizPasses = new Set(
    inventory.userProgress
      .filter((progress) => progress.is_completed && mappingByShell.has(asId(progress.module_id)))
      .map((progress) => `${asId(progress.user_id)}:${asId(progress.module_id)}`),
  );

  for (const allocation of manifestCourse.contentModules) {
    const contentProgressRows = inventory.userProgress.filter(
      (progress) => asId(progress.module_id) === allocation.moduleId && progress.is_completed,
    );
    for (const progress of contentProgressRows) {
      const userId = asId(progress.user_id);
      const quizMapping = mappingByContent.get(allocation.moduleId);
      const quizPassed = !quizMapping || quizPasses.has(`${userId}:${quizMapping.legacyQuizModuleId}`);
      const update = {
        content_completed_at: progress.content_completed_at || migratedAt,
        is_completed: quizPassed,
      };
      if (quizPassed) update.completed_at = progress.completed_at || migratedAt;
      await client.request(`/items/UserProgress/${progress.id}`, "PATCH", update);
      Object.assign(progress, update);
    }
  }

  for (const progress of inventory.userProgress.filter(
    (row) => row.is_completed && mappingByShell.has(asId(row.module_id)),
  )) {
    const userId = asId(progress.user_id);
    const mapping = mappingByShell.get(asId(progress.module_id));
    const target = await ensureProgress(client, existingByUserModule, userId, mapping.approvedContentModuleId);
    const contentComplete = Boolean(target.content_completed_at || target.is_completed);
    const update = {
      quiz_passed_at: target.quiz_passed_at || migratedAt,
      is_completed: contentComplete,
      completed_at: contentComplete ? target.completed_at || migratedAt : null,
    };
    await client.request(`/items/UserProgress/${target.id}`, "PATCH", update);
    Object.assign(target, update);
  }

  const attempts = await client.listAll(
    "QuizAttempts",
    "id,user_id,quiz_id,attempt_number,status,answers,result_snapshot,score,passed,started_at,submitted_at",
  );
  for (const mapping of manifestCourse.quizMappings) {
    const quiz = quizById.get(mapping.quizId);
    const questions = [...(questionsByQuiz[quiz.id] || [])].sort(byOrder);
    const legacyRows = inventory.quizProgress.filter((progress) => asId(progress.module_id) === mapping.legacyQuizModuleId);
    for (const progress of legacyRows) {
      const userId = asId(progress.user_id);
      const passed = quizPasses.has(`${userId}:${mapping.legacyQuizModuleId}`);
      await createMigratedAttempt({
        client,
        attempts,
        userId,
        quiz,
        questions,
        answers: progress.answers || {},
        passed,
        status: progress.is_completed ? "submitted" : "in_progress",
        migratedAt,
        sourceCollection: "QuizProgress",
        sourceId: progress.id,
      });
    }

    const passedProgressWithoutAttempt = inventory.userProgress.filter(
      (progress) => progress.is_completed
        && asId(progress.module_id) === mapping.legacyQuizModuleId
        && !legacyRows.some((legacy) => asId(legacy.user_id) === asId(progress.user_id)),
    );
    for (const progress of passedProgressWithoutAttempt) {
      await createMigratedAttempt({
        client,
        attempts,
        userId: asId(progress.user_id),
        quiz,
        questions,
        answers: {},
        passed: true,
        status: "submitted",
        migratedAt,
        sourceCollection: "UserProgress",
        sourceId: progress.id,
      });
    }
  }

  const finalContent = [...manifestCourse.contentModules].sort(
    (left, right) => Number(left.legacyOrderIndex) - Number(right.legacyOrderIndex),
  ).at(-1);
  const finalMapping = manifestCourse.quizMappings.find((mapping) => mapping.approvedContentModuleId === finalContent.moduleId);
  const finalQuiz = quizById.get(finalMapping.quizId);
  const finalQuestions = [...(questionsByQuiz[finalQuiz.id] || [])].sort(byOrder);
  const courseCertificateIds = new Set(manifestCourse.certificateSelections.flatMap((selection) => selection.certificateIds));
  const certificates = inventory.certificates.filter((certificate) => courseCertificateIds.has(certificate.id));

  for (const selection of manifestCourse.certificateSelections) {
    const certificate = certificates.find((row) => row.id === selection.canonicalCertificateId);
    const userId = selection.userId;
    let finalAttempt = attempts
      .filter((attempt) => asId(attempt.user_id) === userId && asId(attempt.quiz_id) === finalQuiz.id && attempt.passed)
      .sort((left, right) => Number(right.attempt_number) - Number(left.attempt_number))[0];
    if (!finalAttempt) {
      finalAttempt = await createMigratedAttempt({
        client,
        attempts,
        userId,
        quiz: finalQuiz,
        questions: finalQuestions,
        answers: {},
        passed: true,
        status: "submitted",
        migratedAt,
        sourceCollection: "Certificates",
        sourceId: certificate.id,
      });
      finalAttempt.result_snapshot.migration.passEvidence = "existing_issued_certificate";
      await client.request(`/items/QuizAttempts/${finalAttempt.id}`, "PATCH", { result_snapshot: finalAttempt.result_snapshot });
    }

    const completedAt = certificate.issued_date || migratedAt;
    const progressRows = await client.listAll(
      "UserProgress",
      "id,user_id,module_id,content_completed_at,quiz_passed_at,completed_at,is_completed",
    );
    const userProgressByModule = new Map(
      progressRows.filter((row) => asId(row.user_id) === userId).map((row) => [asId(row.module_id), row]),
    );
    const moduleSnapshot = [...manifestCourse.contentModules]
      .sort((left, right) => Number(left.legacyOrderIndex) - Number(right.legacyOrderIndex))
      .map((allocation) => {
        const progress = userProgressByModule.get(allocation.moduleId);
        const mapping = mappingByContent.get(allocation.moduleId);
        const passingAttempt = mapping
          ? attempts.find((attempt) => asId(attempt.user_id) === userId && asId(attempt.quiz_id) === mapping.quizId && attempt.passed)
          : null;
        return {
          module_id: allocation.moduleId,
          title: moduleById.get(allocation.moduleId).title,
          cpe_value: allocation.cpeValue,
          completed_at: progress?.completed_at || completedAt,
          passing_attempt_id: passingAttempt?.id || (allocation.moduleId === finalContent.moduleId ? finalAttempt.id : null),
          migration_provenance: progress?.completed_at ? "legacy_progress" : "existing_issued_certificate",
        };
      });
    const cpeEarned = manifestCourse.contentModules.reduce((total, module) => total + module.cpeValue, 0);
    const completion = await createOrRead(
      client,
      "CourseCompletions",
      {
        user_id: userId,
        course_id: course.id,
        completed_at: completedAt,
        cpe_earned: cpeEarned,
        module_snapshot: moduleSnapshot,
        final_quiz_attempt_id: finalAttempt.id,
      },
      async () => {
        const query = new URLSearchParams({
          "filter[user_id][_eq]": userId,
          "filter[course_id][_eq]": course.id,
          limit: "1",
        });
        return (await client.request(`/items/CourseCompletions?${query}`))[0];
      },
    );
    const user = await client.request(`/users/${userId}?fields=id,legal_name,first_name,last_name`);
    const legalName = user.legal_name || [user.first_name, user.last_name].filter(Boolean).join(" ");
    await client.request(`/items/Certificates/${certificate.id}`, "PATCH", {
      completion_id: completion.id,
      status: certificate.status === "delivered" ? "delivered" : "issued",
      legal_name_snapshot: legalName,
      course_title_snapshot: course.title,
      cpe_earned: cpeEarned,
    });
  }

  const refreshed = await readInventory(client);
  const refreshedCourse = refreshed.courses.find((row) => row.id === course.id);
  const refreshedModules = refreshed.modules.filter((module) => asId(module.course_id) === course.id && (module.type || "video") === "video");
  const refreshedQuizByModule = groupBy(refreshed.quizzes.filter((quiz) => quiz.is_enabled), (quiz) => asId(quiz.module_id));
  const finalModule = [...refreshedModules].sort(byOrder).at(-1);
  const validationErrors = [];
  if (refreshedModules.length === 0) validationErrors.push("no content modules remain");
  if (refreshedModules.some((module) => !Number.isInteger(module.cpe_value) || module.cpe_value < 0)) validationErrors.push("module CPE is invalid");
  if (refreshedModules.reduce((total, module) => total + module.cpe_value, 0) !== Number(refreshedCourse.cpe_hours)) {
    validationErrors.push("module CPE does not reconcile to legacy course CPE");
  }
  if ((refreshedQuizByModule[finalModule?.id] || []).length !== 1) validationErrors.push("final content module does not have exactly one enabled quiz");
  for (const selection of manifestCourse.certificateSelections) {
    const canonical = refreshed.certificates.find((certificate) => certificate.id === selection.canonicalCertificateId);
    if (!canonical?.completion_id) validationErrors.push(`canonical certificate ${selection.canonicalCertificateId} is not linked to a completion`);
  }
  if (validationErrors.length > 0) {
    throw new Error(`${course.title} activation failed: ${validationErrors.join("; ")}`);
  }

  await client.request(`/items/Courses/${course.id}`, "PATCH", { structure_version: V2_STRUCTURE_VERSION });
  return { courseId: course.id, title: course.title, result: "migrated_and_activated" };
}

async function applyContentMigration(client, manifest) {
  const inventory = await readInventory(client);
  const errors = validateManifest(manifest, inventory);
  if (errors.length > 0) {
    const error = new Error(`Migration manifest is not executable:\n- ${errors.join("\n- ")}`);
    error.validationErrors = errors;
    throw error;
  }
  const migratedAt = new Date().toISOString();
  const results = [];
  for (const course of manifest.courses.filter((row) => row.action === "migrate")) {
    results.push(await migrateCourse(client, course, inventory, migratedAt));
  }
  return { migratedAt, results };
}

module.exports = { applyContentMigration, calculateLegacyScore, createMigratedAttempt, migrateCourse };
