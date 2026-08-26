import { ExternalLink, ShieldCheck } from "lucide-react";

interface CourseCpeTrustPanelProps {
  heading?: string | null;
  description?: string | null;
  cpeHours?: number | null;
  providerNumber?: string | null;
  providerListingUrl?: string | null;
}

const formatCreditHeading = (hours?: number | null) => {
  if (!hours) return "Earn Texas CPE Credit";

  const formattedHours = hours.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `Earn ${formattedHours} Texas CPE ${hours === 1 ? "Hour" : "Hours"}`;
};

const getSafeListingUrl = (value?: string | null) => {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export const CourseCpeTrustPanel = ({
  heading,
  description,
  cpeHours,
  providerNumber,
  providerListingUrl,
}: CourseCpeTrustPanelProps) => {
  const panelHeading = heading?.trim() || formatCreditHeading(cpeHours);
  const panelDescription = description?.trim()
    || "Guiding Diversity is a TEA/SBEC-approved Continuing Professional Education provider. Complete the course and required knowledge check to receive a downloadable CPE certificate.";
  const listingUrl = getSafeListingUrl(providerListingUrl);

  return (
    <aside className="px-5 py-6 md:px-10" aria-labelledby="cpe-trust-title">
      <div className="mx-auto flex max-w-6xl gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm md:p-6">
        <ShieldCheck className="mt-0.5 h-7 w-7 shrink-0 text-emerald-700" aria-hidden="true" />
        <div>
          <h2 id="cpe-trust-title" className="text-xl font-bold text-slate-900">
            {panelHeading}
          </h2>
          <p className="mt-1 leading-7 text-slate-700">{panelDescription}</p>
          {(providerNumber?.trim() || listingUrl) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-emerald-800">
              {providerNumber?.trim() && <span>Provider number: {providerNumber.trim()}</span>}
              {listingUrl && (
                <a
                  href={listingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline decoration-emerald-400 underline-offset-4 hover:text-emerald-950"
                >
                  View the official TEA listing
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
