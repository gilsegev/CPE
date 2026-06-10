import { login } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

interface SignInPageProps {
  searchParams: {
    redirectTo?: string;
    error?: string;
  };
}

export default function SignInPage({ searchParams }: SignInPageProps) {
  const { redirectTo, error } = searchParams;

  async function handleSignIn(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      redirect(`/sign-in?error=Please fill in all fields&redirectTo=${redirectTo || ""}`);
    }

    const success = await login(email, password);
    if (success) {
      redirect(redirectTo || "/search");
    } else {
      redirect(`/sign-in?error=Invalid email or password&redirectTo=${redirectTo || ""}`);
    }
  }

  return (
    <div className="w-[400px] bg-white p-8 rounded-xl shadow-md border border-slate-100">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in to access your professional education</p>
      </div>

      <form action={handleSignIn} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700">Email Address</label>
          <input
            name="email"
            type="email"
            placeholder="name@guidingdiversity.com"
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700">Password</label>
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg transition text-sm mt-2"
        >
          Sign In
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        New to the platform?{" "}
        <Link href="/sign-up" className="text-sky-600 hover:underline font-medium">
          Create an account
        </Link>
      </div>
    </div>
  );
}
