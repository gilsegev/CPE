import Image from "next/image";

interface CourseInstructorProps {
  heading?: string | null;
  biography?: string | null;
  photoUrl?: string | null;
}

export const CourseInstructor = ({ heading, biography, photoUrl }: CourseInstructorProps) => {
  if (!heading && !biography && !photoUrl) {
    return null;
  }

  return (
    <section className="px-5 py-10 md:px-10 md:py-12" aria-labelledby={heading ? "course-instructor-title" : undefined}>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start md:p-8">
        {photoUrl && (
          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:h-36 sm:w-36">
            <Image
              src={photoUrl}
              alt={heading ? `${heading} portrait` : "Course instructor portrait"}
              fill
              sizes="(min-width: 640px) 144px, 128px"
              className="object-cover"
            />
          </div>
        )}
        <div className="text-center sm:text-left">
          {heading && (
            <h2 id="course-instructor-title" className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {heading}
            </h2>
          )}
          {biography && <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">{biography}</p>}
        </div>
      </div>
    </section>
  );
};
