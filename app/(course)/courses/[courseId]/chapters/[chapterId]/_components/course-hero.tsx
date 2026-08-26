import Image from "next/image";

import { formatPrice } from "@/lib/format";

import { CourseEnrollButton } from "./course-enroll-button";

interface CourseHeroProps {
  course: {
    title: string;
    subtitle?: string | null;
    cpeHours?: number | null;
    estimatedDuration?: string | null;
    deliveryFormat?: string | null;
    instructor?: string | null;
    ctaLabel?: string | null;
    price: number;
    imageUrl?: string | null;
  };
  courseId: string;
  chapterId: string;
  isLoggedIn: boolean;
}

const formatCpeHours = (hours: number) =>
  `${hours.toLocaleString("en-US", { maximumFractionDigits: 2 })} Texas CPE ${hours === 1 ? "Hour" : "Hours"}`;

export const CourseHero = ({ course, courseId, chapterId, isLoggedIn }: CourseHeroProps) => {
  const details = [
    course.cpeHours != null ? formatCpeHours(course.cpeHours) : null,
    course.deliveryFormat,
    course.estimatedDuration,
  ].filter(Boolean);

  return (
    <section className="px-5 py-10 md:px-10 md:py-16" aria-labelledby="course-title">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div>
          <h1 id="course-title" className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {course.title}
          </h1>
          {course.subtitle && (
            <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-600">{course.subtitle}</p>
          )}
          {details.length > 0 && (
            <p className="mt-6 font-semibold text-slate-700">{details.join(" \u00B7 ")}</p>
          )}
          {course.instructor && (
            <p className="mt-4 text-slate-600">Created by {course.instructor}</p>
          )}
          <p className="mt-7 text-3xl font-bold text-slate-900">{formatPrice(course.price)}</p>
          <div className="mt-5 flex justify-start">
            <CourseEnrollButton
              courseId={courseId}
              price={course.price}
              isLoggedIn={isLoggedIn}
              chapterId={chapterId}
              label={course.ctaLabel || undefined}
            />
          </div>
        </div>
        {course.imageUrl && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 shadow-xl">
            <Image
              src={course.imageUrl}
              alt={`${course.title} course cover`}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 40vw, 90vw"
            />
          </div>
        )}
      </div>
    </section>
  );
};
