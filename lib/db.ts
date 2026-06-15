import { createDirectus, rest, staticToken } from "@directus/sdk";

export interface Course {
  id: string;
  title: string;
  description?: string;
  price: number;
  is_published: boolean;
  thumbnail_url?: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  mux_asset_id?: string;
  is_free_preview: boolean;
  type?: 'video' | 'quiz' | 'essay';
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
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation?: string;
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
  pdf_url: string;
  issued_date: string;
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
}

export interface QuizProgress {
  id: string;
  answers: Record<string, number>;
  is_completed: boolean;
  user_id: string;
  module_id: string;
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
  UserActivityLogs: UserActivityLog[];
};

const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app';
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'Qurc2emXjz6L4zz9lLZ99gKWbjPng4MM';

const customFetch = (input: any, init?: any) => {
  return fetch(input, {
    ...init,
    cache: "no-store",
  });
};

export const db = createDirectus<CPESchema>(directusUrl, {
  globals: {
    fetch: customFetch,
  },
})
  .with(rest())
  .with(staticToken(adminToken));
