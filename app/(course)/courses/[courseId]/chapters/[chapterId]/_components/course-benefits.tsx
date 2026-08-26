import { Check } from "lucide-react";

interface CourseBenefitsProps {
  heading?: string | null;
  description?: string | null;
  benefits?: string[];
}

export const CourseBenefits = ({ heading, description, benefits = [] }: CourseBenefitsProps) => {
  const displayedBenefits = benefits.slice(0, 3);

  if (!heading && !description && displayedBenefits.length === 0) {
    return null;
  }

  return (
    <section
      className="bg-slate-50 px-5 py-12 md:px-10 md:py-16"
      aria-labelledby={heading ? "course-benefits-title" : undefined}
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          {heading && (
            <h2 id="course-benefits-title" className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {heading}
            </h2>
          )}
          {description && <p className="mt-4 text-lg leading-8 text-slate-600">{description}</p>}
        </div>
        {displayedBenefits.length > 0 && (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {displayedBenefits.map((benefit, index) => (
              <div key={`${benefit}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="font-semibold leading-6 text-slate-800">{benefit}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
