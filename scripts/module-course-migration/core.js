const MANIFEST_VERSION = 1;
const V2_STRUCTURE_VERSION = "module_quiz_v2";

function asId(value) {
  if (value && typeof value === "object") return value.id;
  return value;
}

function byOrder(left, right) {
  const order = Number(left.order_index ?? 0) - Number(right.order_index ?? 0);
  return order || String(left.id).localeCompare(String(right.id));
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = key(item);
    (groups[value] ||= []).push(item);
    return groups;
  }, {});
}

function countBy(items, key) {
  return Object.fromEntries(
    Object.entries(groupBy(items, key)).map(([value, rows]) => [value, rows.length]),
  );
}

function generateManifest(inventory, generatedAt = new Date().toISOString()) {
  const modulesByCourse = groupBy(inventory.modules, (module) => asId(module.course_id));
  const quizzesByModule = groupBy(inventory.quizzes, (quiz) => asId(quiz.module_id));
  const questionsByQuiz = groupBy(inventory.questions, (question) => asId(question.quiz_id));
  const progressByModule = groupBy(inventory.userProgress, (progress) => asId(progress.module_id));
  const quizProgressByModule = groupBy(inventory.quizProgress, (progress) => asId(progress.module_id));
  const submissionsByCourse = groupBy(inventory.submissions, (submission) => asId(submission.course_id));
  const certificatesByCourse = groupBy(inventory.certificates, (certificate) => asId(certificate.course_id));

  const courses = inventory.courses.map((course) => {
    const orderedModules = [...(modulesByCourse[course.id] || [])].sort(byOrder);
    const contentModules = orderedModules.filter((module) => (module.type || "video") === "video");
    const quizShells = orderedModules.filter((module) => module.type === "quiz");
    const essays = orderedModules.filter((module) => module.type === "essay");
    const courseCertificates = certificatesByCourse[course.id] || [];
    const certificateGroups = Object.entries(groupBy(courseCertificates, (certificate) => asId(certificate.user_id)))
      .map(([userId, certificates]) => ({
        userId,
        certificateIds: certificates.map((certificate) => certificate.id),
        canonicalCertificateId: certificates.length === 1 ? certificates[0].id : null,
      }));

    const quizMappings = quizShells.flatMap((quizModule) => {
      const quizzes = quizzesByModule[quizModule.id] || [];
      const precedingContent = [...contentModules]
        .filter((module) => Number(module.order_index) < Number(quizModule.order_index))
        .sort(byOrder)
        .at(-1);

      return quizzes.map((quiz) => ({
        quizId: quiz.id,
        legacyQuizModuleId: quizModule.id,
        legacyQuizModuleTitle: quizModule.title,
        suggestedContentModuleId: precedingContent?.id || null,
        approvedContentModuleId: null,
        passingScore: Number(quiz.passing_score),
        questionCount: (questionsByQuiz[quiz.id] || []).length,
      }));
    });

    const blockers = [];
    const legacyCpe = course.cpe_hours == null ? null : Number(course.cpe_hours);
    if (!Number.isInteger(legacyCpe) || legacyCpe <= 0) blockers.push("course_cpe_missing_or_invalid");
    if (contentModules.length === 0) blockers.push("content_module_missing");
    if (quizShells.length === 0) blockers.push("final_module_quiz_missing");
    if (quizMappings.some((mapping) => !mapping.suggestedContentModuleId)) blockers.push("quiz_mapping_ambiguous");
    if (quizMappings.some((mapping) => mapping.questionCount === 0)) blockers.push("quiz_questions_missing");
    if (certificateGroups.some((group) => group.certificateIds.length > 1)) blockers.push("duplicate_legacy_certificates");
    if (courseCertificates.length > 0 && (!Number.isInteger(legacyCpe) || legacyCpe <= 0)) {
      blockers.push("certificate_cpe_missing");
    }
    blockers.push("module_cpe_allocation_unapproved");
    if (quizMappings.length > 0) blockers.push("quiz_mapping_unapproved");

    return {
      courseId: course.id,
      title: course.title,
      currentStructureVersion: course.structure_version || "legacy",
      published: Boolean(course.is_published),
      legacyCourseCpe: legacyCpe,
      action: "defer",
      approval: { approved: false, approvedBy: null, approvedAt: null },
      contentModules: contentModules.map((module) => ({
        moduleId: module.id,
        title: module.title,
        legacyOrderIndex: Number(module.order_index),
        cpeValue: null,
      })),
      quizMappings,
      excludedLegacyModules: [
        ...quizShells.map((module) => ({ moduleId: module.id, title: module.title, type: "quiz" })),
        ...essays.map((module) => ({ moduleId: module.id, title: module.title, type: "essay" })),
      ],
      learnerEvidence: {
        userProgress: orderedModules.reduce((total, module) => total + (progressByModule[module.id] || []).length, 0),
        completedContentProgress: contentModules.reduce(
          (total, module) => total + (progressByModule[module.id] || []).filter((row) => row.is_completed).length,
          0,
        ),
        completedQuizModuleProgress: quizShells.reduce(
          (total, module) => total + (progressByModule[module.id] || []).filter((row) => row.is_completed).length,
          0,
        ),
        quizProgress: quizShells.reduce((total, module) => total + (quizProgressByModule[module.id] || []).length, 0),
        approvedSubmissions: (submissionsByCourse[course.id] || []).filter((row) => row.status === "Approved").length,
        legacyCertificates: courseCertificates.length,
        uniqueCertificateLearnerCourses: certificateGroups.length,
      },
      certificateSelections: certificateGroups,
      blockers: [...new Set(blockers)],
    };
  });

  return {
    manifestVersion: MANIFEST_VERSION,
    generatedAt,
    source: "Directus legacy course inventory",
    instructions: [
      "Set action to migrate only after the course owner approves every mapping and CPE value.",
      "Copy each suggestedContentModuleId to approvedContentModuleId only after confirming quiz ownership.",
      "Set non-negative integer cpeValue values whose sum equals legacyCourseCpe.",
      "For duplicate certificate groups, select exactly one existing certificate ID as canonical; historical duplicates remain unlinked.",
      "Set approval.approved, approvedBy, and approvedAt only after resolving all blockers.",
    ],
    courses,
    summary: {
      courses: courses.length,
      publishedCourses: courses.filter((course) => course.published).length,
      immediatelyMigratableCourses: courses.filter((course) => course.blockers.length === 0).length,
      blockerCounts: countBy(courses.flatMap((course) => course.blockers), (blocker) => blocker),
    },
  };
}

function validateApprovedCourse(manifestCourse, inventory) {
  const errors = [];
  if (manifestCourse.action !== "migrate") return errors;
  if (!manifestCourse.approval?.approved || !manifestCourse.approval.approvedBy || !manifestCourse.approval.approvedAt) {
    errors.push("course migration is not explicitly approved");
  }

  const course = inventory.courses.find((row) => row.id === manifestCourse.courseId);
  if (!course) return ["course no longer exists"];
  if ((course.structure_version || "legacy") === V2_STRUCTURE_VERSION) return [];

  const liveModules = inventory.modules.filter((module) => asId(module.course_id) === course.id);
  const liveContentIds = new Set(liveModules.filter((module) => (module.type || "video") === "video").map((module) => module.id));
  const allocations = manifestCourse.contentModules || [];
  if (allocations.length !== liveContentIds.size || allocations.some((allocation) => !liveContentIds.has(allocation.moduleId))) {
    errors.push("content module inventory changed after the manifest was generated");
  }
  if (allocations.some((allocation) => !Number.isInteger(allocation.cpeValue) || allocation.cpeValue < 0)) {
    errors.push("every content module needs an approved non-negative integer CPE value");
  }
  const expectedCpe = course.cpe_hours == null ? null : Number(course.cpe_hours);
  const allocatedCpe = allocations.reduce((total, allocation) => total + Number(allocation.cpeValue || 0), 0);
  if (!Number.isInteger(expectedCpe) || expectedCpe <= 0) errors.push("the legacy course CPE total is missing or invalid");
  if (allocatedCpe !== expectedCpe) errors.push(`module CPE sum ${allocatedCpe} does not match legacy course CPE ${expectedCpe}`);

  const liveQuizzes = new Map(inventory.quizzes.map((quiz) => [quiz.id, quiz]));
  const liveQuestions = groupBy(inventory.questions, (question) => asId(question.quiz_id));
  for (const mapping of manifestCourse.quizMappings || []) {
    const quiz = liveQuizzes.get(mapping.quizId);
    if (!quiz) {
      errors.push(`quiz ${mapping.quizId} no longer exists`);
      continue;
    }
    if (asId(quiz.module_id) !== mapping.legacyQuizModuleId && asId(quiz.module_id) !== mapping.approvedContentModuleId) {
      errors.push(`quiz ${mapping.quizId} ownership changed after the manifest was generated`);
    }
    if (!liveContentIds.has(mapping.approvedContentModuleId)) errors.push(`quiz ${mapping.quizId} has no approved content-module owner`);
    if ((liveQuestions[mapping.quizId] || []).length === 0) errors.push(`quiz ${mapping.quizId} has no questions`);
    if (!Number.isInteger(Number(quiz.passing_score)) || Number(quiz.passing_score) < 0 || Number(quiz.passing_score) > 100) {
      errors.push(`quiz ${mapping.quizId} has an invalid passing score`);
    }
  }

  const finalContent = [...liveModules].filter((module) => liveContentIds.has(module.id)).sort(byOrder).at(-1);
  const finalQuiz = (manifestCourse.quizMappings || []).find(
    (mapping) => mapping.approvedContentModuleId === finalContent?.id,
  );
  if (!finalQuiz) errors.push("the final content module does not have an approved enabled quiz");

  for (const selection of manifestCourse.certificateSelections || []) {
    const liveCertificates = inventory.certificates.filter(
      (certificate) => certificate.id === selection.canonicalCertificateId
        && asId(certificate.user_id) === selection.userId
        && asId(certificate.course_id) === manifestCourse.courseId,
    );
    if (!selection.canonicalCertificateId) {
      errors.push(`learner ${selection.userId} needs one canonical legacy certificate selection`);
    } else if (!selection.certificateIds.includes(selection.canonicalCertificateId)) {
      errors.push(`canonical certificate ${selection.canonicalCertificateId} is not in its legacy certificate group`);
    } else if (liveCertificates.length !== 1) {
      errors.push(`canonical certificate ${selection.canonicalCertificateId} no longer matches the live learner and course`);
    }
  }

  return [...new Set(errors)];
}

function validateManifest(manifest, inventory) {
  const errors = [];
  if (manifest.manifestVersion !== MANIFEST_VERSION) errors.push(`unsupported manifest version ${manifest.manifestVersion}`);
  for (const course of manifest.courses || []) {
    for (const error of validateApprovedCourse(course, inventory)) {
      errors.push(`${course.title || course.courseId}: ${error}`);
    }
  }
  if (!(manifest.courses || []).some((course) => course.action === "migrate")) {
    errors.push("manifest does not contain any course approved for migration");
  }
  return errors;
}

module.exports = {
  MANIFEST_VERSION,
  V2_STRUCTURE_VERSION,
  asId,
  byOrder,
  generateManifest,
  groupBy,
  validateApprovedCourse,
  validateManifest,
};
