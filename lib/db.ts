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
}

export interface Submission {
  id: string;
  user_id: string;
  course_id: string;
  quiz_score: number;
  essay_text: string;
  status: 'Pending' | 'Approved' | 'Rejected';
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
}

export type CPESchema = {
  Courses: Course[];
  Modules: Module[];
  Purchases: Purchase[];
  Quizzes: Quiz[];
  Questions: Question[];
  Submissions: Submission[];
  Certificates: Certificate[];
};

// Initialize server-side admin client
const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app';
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'Qurc2emXjz6L4zz9lLZ99gKWbjPng4MM';

export const db = createDirectus<CPESchema>(directusUrl)
  .with(rest())
  .with(staticToken(adminToken));
