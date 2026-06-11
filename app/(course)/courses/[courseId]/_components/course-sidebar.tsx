import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readItems } from "@directus/sdk";
import { CourseProgress } from "@/components/course-progress";

import { CourseSidebarItem } from "./course-sidebar-item";

interface CourseSidebarProps {
  course: any;
  progressCount: number;
}

export const CourseSidebar = async ({
  course,
  progressCount,
}: CourseSidebarProps) => {
  const user = await getCurrentUser();
  const userId = user?.id;

  // Fetch active purchase for current user and course (if logged in)
  const purchases = userId ? await db.request(
    readItems("Purchases", {
      filter: {
        user_id: { _eq: userId },
        course_id: { _eq: course.id },
        status: { _eq: "active" },
      },
      limit: 1,
    })
  ) : [];
  const purchase = purchases[0] || null;

  return (
    <div className="h-full border-r flex flex-col overflow-y-auto shadow-sm">
      <div className="p-8 flex flex-col border-b">
        <Link 
          href="/" 
          className="flex items-center text-sm text-slate-500 hover:text-slate-800 mb-6 transition"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>
        <h1 className="font-semibold">
          {course.title}
        </h1>
        {purchase && (
          <div className="mt-10">
            <CourseProgress
              variant="success"
              value={progressCount}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col w-full">
        {course.chapters.map((chapter: any) => (
          <CourseSidebarItem
            key={chapter.id}
            id={chapter.id}
            label={chapter.title}
            isCompleted={!!chapter.userProgress?.[0]?.isCompleted}
            courseId={course.id}
            isLocked={chapter.isLocked}
            type={chapter.type}
          />
        ))}
      </div>
    </div>
  )
}