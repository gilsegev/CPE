import { db } from "@/lib/db";
import { createUser, readRoles } from "@directus/sdk";
import { login } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

interface SignUpPageProps {
  searchParams: {
    error?: string;
  };
}

export default function SignUpPage({ searchParams }: SignUpPageProps) {
  const { error } = searchParams;

  async function handleSignUp(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const legalName = formData.get("legalName") as string;
    const teaId = formData.get("teaId") as string;

    if (!email || !password || !firstName || !lastName || !legalName) {
      redirect("/sign-up?error=Please fill in all required fields");
    }

    try {
      // 1. Fetch Student role ID dynamically
      const roles = await db.request(
        readRoles({
          filter: { name: { _eq: "Student" } },
        })
      );
      const studentRole = roles[0];
      if (!studentRole) {
        throw new Error("Student configuration error. Please contact admin.");
      }

      // 2. Create the user in Directus with the Student role
      await db.request(
        createUser({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          role: studentRole.id,
          legal_name: legalName,
          tea_id: teaId || undefined,
        } as any)
      );

      // 3. Log the user in automatically
      const success = await login(email, password);
      if (success) {
        redirect("/search");
      } else {
        redirect("/sign-in?error=Account created. Please log in.");
      }
    } catch (err: any) {
      console.error("[SIGNUP_ERROR]", err);
      const msg = err.message || "An error occurred during sign up";
      redirect(`/sign-up?error=${encodeURIComponent(msg)}`);
    }
  }

  return (
    <div className="w-[450px] bg-white p-8 rounded-xl shadow-md border border-slate-100">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Create Account</h1>
        <p className="text-sm text-slate-500 mt-1">Register for CPE course certification</p>
      </div>

      <form action={handleSignUp} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">First Name *</label>
            <input
              name="firstName"
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Last Name *</label>
            <input
              name="lastName"
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700">Email Address *</label>
          <input
            name="email"
            type="email"
            placeholder="name@guidingdiversity.com"
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 font-bold text-slate-800">
            Legal Name for Certificate *
          </label>
          <input
            name="legalName"
            type="text"
            placeholder="Exactly as it should appear on certificate"
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm bg-sky-50/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">TEA ID (Optional)</label>
            <input
              name="teaId"
              type="text"
              placeholder="Texas Ed. ID"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Password *</label>
            <input
              name="password"
              type="password"
              placeholder="Min. 8 chars"
              required
              minLength={8}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg transition text-sm mt-4"
        >
          Register
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-sky-600 hover:underline font-medium">
          Sign in
        </Link>
      </div>
    </div>
  );
}
