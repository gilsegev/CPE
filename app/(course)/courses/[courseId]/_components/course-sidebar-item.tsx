"use client";

import { CheckCircle, Lock, PlayCircle, HelpCircle, FileText } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

interface CourseSidebarItemProps {
  label: string;
  id: string;
  isCompleted: boolean;
  courseId: string;
  isLocked: boolean;
  type?: 'video' | 'quiz' | 'essay';
};

export const CourseSidebarItem = ({
  label,
  id,
  isCompleted,
  courseId,
  isLocked,
  type,
}: CourseSidebarItemProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const Icon = isLocked
    ? Lock
    : isCompleted
    ? CheckCircle
    : type === "quiz"
    ? HelpCircle
    : type === "essay"
    ? FileText
    : PlayCircle;
  const isActive = pathname?.includes(id);

  const onClick = () => {
    if (isLocked) return;
    router.push(`/courses/${courseId}/chapters/${id}`);
  }

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      type="button"
      className={cn(
        "flex items-center gap-x-2 text-slate-500 text-sm font-[500] pl-6 transition-all hover:text-slate-600 hover:bg-slate-300/20",
        isActive && "text-slate-700 bg-slate-200/20 hover:bg-slate-200/20 hover:text-slate-700",
        isCompleted && "text-emerald-700 hover:text-emerald-700",
        isCompleted && isActive && "bg-emerald-200/20",
        isLocked && "text-slate-400 hover:text-slate-400 cursor-not-allowed hover:bg-transparent"
      )}
    >
      <div className="flex items-center gap-x-2 py-4">
        <Icon
          size={22}
          className={cn(
            "text-slate-500",
            isActive && "text-slate-700",
            isCompleted && "text-emerald-700",
            isLocked && "text-amber-500"
          )}
        />
        {label}
        {isLocked && (
          <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 whitespace-nowrap">
            Premium
          </span>
        )}
      </div>
      <div className={cn(
        "ml-auto opacity-0 border-2 border-slate-700 h-full transition-all",
        isActive && "opacity-100",
        isCompleted && "border-emerald-700"
      )} />
    </button>
  )
}