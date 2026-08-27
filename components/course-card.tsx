import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";

import { IconBadge } from "@/components/icon-badge";
import { formatPrice } from "@/lib/format";
import { CourseProgress } from "@/components/course-progress";
import { CourseFeedbackSurvey } from "@/components/course-feedback-survey";
import { CheckCircle } from "lucide-react";

interface CourseCardProps {
  id: string;
  title: string;
  imageUrl: string;
  chaptersLength: number;
  price: number;
  progress: number | null;
  category: string;
  cpeValue?: number;
  certificateStatus?: string;
  completionId?: string | null;
  feedbackSubmitted?: boolean;
};

export const CourseCard = ({
  id,
  title,
  imageUrl,
  chaptersLength,
  price,
  progress,
  category,
  cpeValue,
  certificateStatus,
  completionId,
  feedbackSubmitted = false,
}: CourseCardProps) => {
  return (
    <div className="group hover:shadow-md transition overflow-hidden border border-slate-100 rounded-[var(--radius)] p-3 h-full bg-white">
      <Link href={`/courses/${id}`} className="block">
        <div className="relative w-full aspect-video rounded-md overflow-hidden bg-slate-100">
          {imageUrl ? (
            <Image
              fill
              className="object-contain"
              alt={title}
              src={imageUrl}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/95 to-primary flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-white/70 animate-pulse" />
            </div>
          )}
        </div>
        <div className="flex flex-col pt-2">
          <div className="text-lg md:text-base font-semibold group-hover:text-primary/85 transition line-clamp-2">
            {title}
          </div>
          <p className="text-xs text-muted-foreground">
            {category}
          </p>
          <div className="my-3 flex items-center gap-x-2 text-sm md:text-xs">
            <div className="flex items-center gap-x-1 text-slate-500">
              <IconBadge size="sm" icon={BookOpen} />
              <span>
                {chaptersLength} {chaptersLength === 1 ? "Module" : "Modules"}
              </span>
            </div>
          </div>
          {progress !== null ? (
            <div className="space-y-2">
              <CourseProgress
                variant={progress === 100 ? "success" : "default"}
                size="sm"
                value={progress}
              />
              {certificateStatus && (
                <p className="text-xs font-medium text-slate-600">
                  {cpeValue} CPE · Certificate {certificateStatus}
                </p>
              )}
            </div>
          ) : (
            <p className="text-md md:text-sm font-medium text-slate-700">
              {formatPrice(price)}
            </p>
          )}
        </div>
      </Link>
      {completionId && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {feedbackSubmitted ? (
            <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
              <CheckCircle className="h-4 w-4" /> Thank you for your feedback
            </p>
          ) : (
            <CourseFeedbackSurvey courseId={id} courseTitle={title} compact />
          )}
        </div>
      )}
    </div>
  )
}
