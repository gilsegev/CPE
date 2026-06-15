import { login } from "@/lib/auth";
import { logServerEvent } from "@/lib/observability";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";

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
      await logServerEvent("login_success", "/sign-in", { email, method: "email" });
      redirect(redirectTo || "/search");
    } else {
      redirect(`/sign-in?error=Invalid email or password&redirectTo=${redirectTo || ""}`);
    }
  }

  async function handleGoogleLogin() {
    "use server";
    const cookieStore = cookies();
    if (redirectTo) {
      cookieStore.set("oauth_redirect", redirectTo, { path: "/", maxAge: 600 });
    } else {
      cookieStore.delete("oauth_redirect");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = encodeURIComponent(`${appUrl}/api/auth/callback`);

    if (!clientId) {
      console.error("[GOOGLE_LOGIN_ERROR] GOOGLE_CLIENT_ID is not configured");
      redirect(`/sign-in?error=Google login is not configured. Please contact admin.&redirectTo=${redirectTo || ""}`);
    }

    redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile`
    );
  }

  return (
    <div className="w-full max-w-[400px] bg-[#1a2333]/90 border border-[#2d3a5a] backdrop-blur-md p-8 rounded-2xl shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white font-serif">Welcome Back</h1>
        <p className="text-sm text-slate-300 mt-1">Sign in to access your professional education</p>
      </div>

      {error && (
        <div className="bg-red-950/40 text-red-200 text-sm p-3 rounded-xl border border-red-900/30 font-medium mb-4">
          {error}
        </div>
      )}

      <form action={handleGoogleLogin} className="w-full">
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-x-2 border border-[#2d3a5a] hover:bg-[#25324b] text-white font-semibold py-2.5 rounded-xl transition text-sm mb-4 cursor-pointer shadow-sm bg-[#1e293b]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </form>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#2d3a5a]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#1a2333] px-2 text-slate-400 font-medium">Or continue with email</span>
        </div>
      </div>

      <form action={handleSignIn} className="space-y-4">

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#e2e7f2] uppercase tracking-wider">Email Address</label>
          <input
            name="email"
            type="email"
            placeholder="name@guidingdiversity.com"
            required
            className="w-full px-3.5 py-2.5 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-slate-500 transition-all"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#e2e7f2] uppercase tracking-wider">Password</label>
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            required
            className="w-full px-3.5 py-2.5 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-slate-500 transition-all"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-white hover:bg-slate-100 text-[#18223b] font-bold py-2.5 rounded-xl transition text-sm mt-2 shadow-md uppercase tracking-wider"
        >
          Sign In
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-400">
        New to the platform?{" "}
        <Link href="/sign-up" className="text-sky-400 hover:text-sky-300 font-medium hover:underline">
          Create an account
        </Link>
      </div>
    </div>
  );
}
