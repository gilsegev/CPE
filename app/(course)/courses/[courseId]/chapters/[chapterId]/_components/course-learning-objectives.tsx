import { Check } from "lucide-react";

interface CourseLearningObjectivesProps {
  objectives?: string[];
}

export const CourseLearningObjectives = ({ objectives = [] }: CourseLearningObjectivesProps) => {
  const displayedObjectives = objectives.slice(0, 5);

  if (displayedObjectives.length === 0) {
    return null;
  }

  return (
    <section className="px-5 py-12 md:px-10 md:py-16" aria-labelledby="course-learning-objectives-title">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h2
            id="course-learning-objectives-title"
            className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
          >
            What you&apos;ll learn
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            By the end of this course, you will be able to:
          </p>
          <ul className="mt-8 grid gap-x-10 gap-y-5 md:grid-cols-2">
            {displayedObjectives.map((objective, index) => (
              <li key={`${objective}-${index}`} className="flex items-start gap-3 text-base leading-7 text-slate-700">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
