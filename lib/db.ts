import { createDirectus, rest, staticToken } from "@directus/sdk";

export interface Course {
  id: string;
  title: string;
  description?: string;
  subtitle?: string;
  cpe_hours?: number;
  estimated_duration?: string;
  delivery_format?: string;
  instructor?: string;
  instructor_heading?: string;
  instructor_bio?: string;
  instructor_photo?: string;
  cta_label?: string;
  benefit_heading?: string;
  benefit_description?: string;
  benefits?: string[];
  learning_objectives?: string[];
  course_contents?: CourseContentItem[];
  cpe_trust_heading?: string;
  cpe_trust_description?: string;
  cpe_provider_number?: string;
  cpe_provider_listing_url?: string;
  price: number;
  is_published: boolean;
  thumbnail_url?: string;
  structure_version?: 'legacy' | 'module_quiz_v2';
}

export interface CourseContentItem {
  title: string;
  duration_minutes: number;
  description: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  mux_asset_id?: string;
  is_free_preview: boolean;
  type?: 'video' | 'quiz' | 'essay';
  cpe_value?: number | null;
  migration_status?: 'legacy' | 'v2_content' | 'migrated_quiz_shell' | 'legacy_essay_history';
}

export interface Purchase {
  id: string;
  user_id: string;
  course_id: string;
  stripe_payment_id?: string;
  status: string;
}

export interface Quiz {
  id: string;
  module_id: string;
  passing_score: number;
  is_enabled?: boolean;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation?: string;
  order_index?: number;
}

export interface Submission {
  id: string;
  user_id: string;
  course_id: string;
  quiz_score: number;
  essay_text: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
}

export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  pdf_url: string | null;
  issued_date: string | null;
  completion_id?: string | null;
  status?: 'pending' | 'processing' | 'issued' | 'delivered' | 'failed';
  legal_name_snapshot?: string | null;
  course_title_snapshot?: string | null;
  cpe_earned?: number | null;
  emailed_at?: string | null;
  attempt_count?: number;
  last_attempt_at?: string | null;
  failure_code?: string | null;
  failure_detail?: string | null;
}

export interface DirectusUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  legal_name: string;
  tea_id?: string;
  role?: string;
}

export interface UserActivityLog {
  id: string;
  user_id?: any;
  session_id: string;
  event_type: string;
  pathname: string;
  referrer?: string;
  duration_ms?: number;
  ip_address?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  metadata?: any;
  timestamp: string;
}

export interface UserProgress {
  id: string;
  is_completed: boolean;
  user_id: string;
  module_id: string;
  content_completed_at?: string | null;
  quiz_passed_at?: string | null;
  completed_at?: string | null;
}

export interface QuizProgress {
  id: string;
  answers: Record<string, number>;
  is_completed: boolean;
  user_id: string;
  module_id: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  attempt_number: number;
  status: 'in_progress' | 'submitted' | 'abandoned';
  answers: Record<string, number>;
  result_snapshot?: unknown;
  score?: number | null;
  passed?: boolean | null;
  started_at: string;
  submitted_at?: string | null;
}

export interface CourseCompletion {
  id: string;
  user_id: string;
  course_id: string;
  completed_at: string;
  cpe_earned: number;
  module_snapshot: Array<Record<string, unknown>>;
  final_quiz_attempt_id: string;
}

export interface FeedbackResponse {
  id: string;
  completion_id: string;
  user_id: string;
  course_id: string;
  knowledge_before: number;
  knowledge_after: number;
  relevance: number;
  instructional_effectiveness: number;
  intent_to_apply?: number | null;
  intent_not_applicable: boolean;
  planned_application?: string | null;
  most_helpful?: string | null;
  improvement?: string | null;
  technical_issues: string[];
  technical_issue_detail?: string | null;
  submitted_at: string;
}

export type CPESchema = {
  Courses: Course[];
  Modules: Module[];
  Purchases: Purchase[];
  Quizzes: Quiz[];
  Questions: Question[];
  Submissions: Submission[];
  Certificates: Certificate[];
  UserProgress: UserProgress[];
  QuizProgress: QuizProgress[];
  QuizAttempts: QuizAttempt[];
  CourseCompletions: CourseCompletion[];
  FeedbackResponses: FeedbackResponse[];
  UserActivityLogs: UserActivityLog[];
};

const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app';
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

const customFetch = (input: any, init?: any) => {
  return fetch(input, {
    ...init,
    cache: "no-store",
  });
};

const directus = createDirectus<CPESchema>(directusUrl, {
  globals: {
    fetch: customFetch,
  },
})
  .with(rest());

export const publicDb = createDirectus<CPESchema>(directusUrl, {
  globals: {
    fetch: customFetch,
  },
}).with(rest());

export const db = adminToken
  ? directus.with(staticToken(adminToken))
  : directus;
