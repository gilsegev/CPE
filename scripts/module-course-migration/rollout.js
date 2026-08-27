const { asId, byOrder, groupBy, V2_STRUCTURE_VERSION } = require("./core");

const CERTIFICATE_STATUSES = new Set(["pending", "processing", "issued", "delivered", "failed"]);

function activeContentModules(inventory, courseId) {
  return inventory.modules
    .filter((module) => asId(module.course_id) === courseId)
    .filter((module) => (module.type || "video") === "video")
    .filter((module) => !["migrated_quiz_shell", "legacy_essay_history"].includes(module.migration_status))
    .sort(byOrder);
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function inspectV2Course(course, inventory) {
  const issues = [];
  const modules = activeContentModules(inventory, course.id);
  const moduleIds = new Set(modules.map((module) => module.id));
  const quizzes = inventory.quizzes.filter((quiz) => moduleIds.has(asId(quiz.module_id)) && quiz.is_enabled !== false);
  const quizzesByModule = groupBy(quizzes, (quiz) => asId(quiz.module_id));
  const questionsByQuiz = groupBy(inventory.questions, (question) => asId(question.quiz_id));

  if (modules.length === 0) issues.push("course has no active content modules");
  const repeatedOrders = duplicates(modules.map((module) => Number(module.order_index)));
  if (repeatedOrders.length > 0) issues.push(`module order is duplicated at ${repeatedOrders.join(", ")}`);
  if (modules.some((module) => !Number.isInteger(module.cpe_value) || module.cpe_value < 0)) {
    issues.push("module CPE values must be non-negative integers");
  }
  const cpeTotal = modules.reduce(
    (total, module) => total + (Number.isInteger(module.cpe_value) ? module.cpe_value : 0),
    0,
  );
  if (cpeTotal <= 0) issues.push("certificate-awarding course CPE total must be greater than zero");
  for (const module of modules) {
    if ((quizzesByModule[module.id] || []).length > 1) issues.push(`module ${module.id} has multiple enabled quizzes`);
  }
  const finalModule = modules.at(-1);
  if (finalModule && (quizzesByModule[finalModule.id] || []).length !== 1) {
    issues.push("final content module must have exactly one enabled quiz");
  }
  for (const quiz of quizzes) {
    const passingScore = Number(quiz.passing_score);
    const questions = [...(questionsByQuiz[quiz.id] || [])].sort(byOrder);
    if (!Number.isInteger(passingScore) || passingScore < 0 || passingScore > 100) {
      issues.push(`quiz ${quiz.id} has an invalid passing score`);
    }
    if (questions.length === 0) issues.push(`quiz ${quiz.id} has no questions`);
    if (questions.some((question) => !Number.isInteger(Number(question.order_index)))) {
      issues.push(`quiz ${quiz.id} has an invalid question order`);
    }
    const repeatedQuestionOrders = duplicates(questions.map((question) => Number(question.order_index)));
    if (repeatedQuestionOrders.length > 0) issues.push(`quiz ${quiz.id} has duplicate question order`);
  }

  return {
    courseId: course.id,
    title: course.title,
    cpeTotal,
    modules: modules.length,
    enabledQuizzes: quizzes.length,
    status: issues.length === 0 ? "valid" : "invalid",
    issues,
  };
}

function buildRolloutReport(inventory, now = new Date(), processingTimeoutMinutes = 30) {
  const v2Courses = inventory.courses.filter(
    (course) => (course.structure_version || "legacy") === V2_STRUCTURE_VERSION,
  );
  const legacyCourses = inventory.courses.filter(
    (course) => (course.structure_version || "legacy") !== V2_STRUCTURE_VERSION,
  );
  const courseValidation = v2Courses.map((course) => inspectV2Course(course, inventory));
  const certificateByCompletion = groupBy(
    inventory.certificates.filter((certificate) => certificate.completion_id),
    (certificate) => asId(certificate.completion_id),
  );
  const completionIds = new Set(inventory.courseCompletions.map((completion) => completion.id));
  const courseIds = new Set(inventory.courses.map((course) => course.id));
  const reconciliationIssues = [];

  for (const completion of inventory.courseCompletions) {
    if (!courseIds.has(asId(completion.course_id))) {
      reconciliationIssues.push(`completion ${completion.id} references a missing course`);
    }
    if (!Number.isInteger(Number(completion.cpe_earned)) || Number(completion.cpe_earned) <= 0) {
      reconciliationIssues.push(`completion ${completion.id} has an invalid CPE award`);
    }
    if (!Array.isArray(completion.module_snapshot) || completion.module_snapshot.length === 0) {
      reconciliationIssues.push(`completion ${completion.id} has no module snapshot`);
    } else {
      const snapshotCpe = completion.module_snapshot.reduce(
        (total, module) => total + Number(module.cpe_value || 0),
        0,
      );
      if (snapshotCpe !== Number(completion.cpe_earned)) {
        reconciliationIssues.push(`completion ${completion.id} module snapshot CPE does not match its award`);
      }
    }
    const certificates = certificateByCompletion[completion.id] || [];
    if (certificates.length === 0) reconciliationIssues.push(`completion ${completion.id} has no certificate`);
    if (certificates.length > 1) reconciliationIssues.push(`completion ${completion.id} has multiple certificates`);
    for (const certificate of certificates) {
      if (Number(certificate.cpe_earned) !== Number(completion.cpe_earned)) {
        reconciliationIssues.push(`certificate ${certificate.id} CPE does not match completion ${completion.id}`);
      }
    }
  }
  for (const certificate of inventory.certificates) {
    if (certificate.completion_id && !completionIds.has(asId(certificate.completion_id))) {
      reconciliationIssues.push(`certificate ${certificate.id} references a missing completion`);
    }
    if (certificate.completion_id && !CERTIFICATE_STATUSES.has(certificate.status)) {
      reconciliationIssues.push(`certificate ${certificate.id} has invalid status ${certificate.status}`);
    }
    if (certificate.status === "processing") {
      const lastAttempt = Date.parse(certificate.last_attempt_at || "");
      const staleBefore = now.getTime() - processingTimeoutMinutes * 60 * 1000;
      if (!Number.isFinite(lastAttempt) || lastAttempt < staleBefore) {
        reconciliationIssues.push(`certificate ${certificate.id} is stuck in processing`);
      }
    }
  }

  const blockers = [];
  if (legacyCourses.length > 0) blockers.push(`${legacyCourses.length} course(s) still use legacy behavior`);
  if (courseValidation.some((course) => course.status === "invalid")) blockers.push("one or more v2 courses fail activation invariants");
  if (reconciliationIssues.length > 0) blockers.push("completion and certificate reconciliation is not clean");

  return {
    courseCounts: {
      total: inventory.courses.length,
      legacy: legacyCourses.length,
      moduleQuizV2: v2Courses.length,
    },
    legacyCourses: legacyCourses.map((course) => ({ courseId: course.id, title: course.title, published: Boolean(course.is_published) })),
    courseValidation,
    reconciliation: {
      status: reconciliationIssues.length === 0 ? "clean" : "attention_required",
      issues: reconciliationIssues,
      completions: inventory.courseCompletions.length,
      linkedCertificates: inventory.certificates.filter((certificate) => certificate.completion_id).length,
      retainedUnlinkedCertificates: inventory.certificates.filter((certificate) => !certificate.completion_id).length,
    },
    cleanupReadiness: {
      ready: blockers.length === 0,
      blockers,
      retainedHistoricalRowsRequireSeparateRetentionDecision: true,
    },
  };
}

module.exports = { activeContentModules, buildRolloutReport, inspectV2Course };
