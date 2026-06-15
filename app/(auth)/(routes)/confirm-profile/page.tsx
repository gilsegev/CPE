import { getCurrentUser, getSessionClient } from "@/lib/auth";
import { updateMe } from "@directus/sdk";
import { redirect } from "next/navigation";

interface ConfirmProfilePageProps {
  searchParams: {
    redirectTo?: string;
    error?: string;
  };
}

export default async function ConfirmProfilePage({ searchParams }: ConfirmProfilePageProps) {
  const { redirectTo, error } = searchParams;
  
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/sign-in?redirectTo=${redirectTo || ""}`);
  }

  // Pre-fill fields
  const defaultFirstName = user.first_name || "";
  const defaultLastName = user.last_name || "";
  const defaultLegalName = user.legal_name || `${defaultFirstName} ${defaultLastName}`.trim();
  const defaultTeaId = user.tea_id || "";

  async function handleConfirmProfile(formData: FormData) {
    "use server";
    
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const legalName = formData.get("legalName") as string;
    const teaId = formData.get("teaId") as string;
    const confirmed = formData.get("confirmed") as string;

    if (!firstName || !lastName || !legalName) {
      redirect(`/confirm-profile?error=Please fill in all required fields&redirectTo=${redirectTo || ""}`);
    }

    if (confirmed !== "on") {
      redirect(`/confirm-profile?error=You must check the confirmation checkbox&redirectTo=${redirectTo || ""}`);
    }

    let success = false;
    try {
      const client = await getSessionClient();
      if (!client) {
        throw new Error("Session expired. Please sign in again.");
      }

      // Update user in Directus
      await client.request(
        updateMe({
          first_name: firstName,
          last_name: lastName,
          legal_name: legalName,
          tea_id: teaId || null,
        } as any)
      );
      success = true;
    } catch (err: any) {
      console.error("[CONFIRM_PROFILE_UPDATE_ERROR]", err);
      const msg = err.message || "Failed to update profile. Please try again.";
      redirect(`/confirm-profile?error=${encodeURIComponent(msg)}&redirectTo=${redirectTo || ""}`);
    }

    if (success) {
      // Redirect to catalog or search page
      redirect(redirectTo || "/search");
    }
  }

  return (
    <div className="w-full max-w-[480px] bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-100">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Confirm Your Information</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verify your details to ensure your certificates are legally valid
        </p>
      </div>

      <form action={handleConfirmProfile} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700">Email Address (Verified)</label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">First Name *</label>
            <input
              name="firstName"
              type="text"
              defaultValue={defaultFirstName}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Last Name *</label>
            <input
              name="lastName"
              type="text"
              defaultValue={defaultLastName}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 font-bold text-slate-800">
            Official Legal Name for Certificates *
          </label>
          <input
            name="legalName"
            type="text"
            defaultValue={defaultLegalName}
            placeholder="Exactly as it should appear on certificates"
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm bg-sky-50/20"
          />
          <p className="text-xs text-slate-400 mt-1">
            This name will be printed on all your earned PDF certificates.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700">TEA ID (Optional)</label>
          <input
            name="teaId"
            type="text"
            defaultValue={defaultTeaId}
            placeholder="Texas Education ID (if applicable)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <div className="flex items-start gap-x-2 pt-2">
          <input
            type="checkbox"
            name="confirmed"
            id="confirmed"
            required
            className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
          />
          <label htmlFor="confirmed" className="text-xs text-slate-500 leading-snug cursor-pointer select-none">
            I verify that the spelling of my Legal Name above is correct and matches my government-issued ID. I understand this name will be printed on all earned certificates and cannot be changed online.
          </label>
        </div>

        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition text-sm mt-4 shadow-sm"
        >
          Confirm and Complete Registration
        </button>
      </form>
    </div>
  );
}
