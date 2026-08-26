import { Clock } from "lucide-react";

import type { CourseContentItem } from "@/lib/db";

interface CourseContentsProps {
  items?: CourseContentItem[];
  cpeHours?: number | null;
}

export const CourseContents = ({ items = [], cpeHours }: CourseContentsProps) => {
  if (items.length === 0) return null;

  const totalMinutes = items.reduce((total, item) => total + item.duration_minutes, 0);
  const creditLabel = cpeHours === 1 ? "one CPE hour" : cpeHours ? `${cpeHours} CPE hours` : "CPE credit";

  return (
    <section className="bg-slate-50 px-5 py-10 md:px-10 md:py-12" aria-labelledby="course-contents-title">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="course-contents-title" className="text-3xl font-bold tracking-tight text-slate-900">
              Course contents
            </h2>
            <p className="mt-2 text-slate-600">
              Complete all {totalMinutes} minutes of required activities to earn {creditLabel}.
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm font-semibold text-sky-700">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {totalMinutes} minutes total
          </p>
        </div>

        <ol className="mt-6 grid gap-3">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <span className="shrink-0 text-sm font-medium text-slate-500">{item.duration_minutes} minutes</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
