import { db } from "@/lib/db";
import { createUser, readRoles } from "@directus/sdk";
import { login, getCurrentUser } from "@/lib/auth";
import { logServerEvent } from "@/lib/observability";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";

interface SignUpPageProps {
  searchParams: {
    error?: string;
    redirectTo?: string;
  };
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { error, redirectTo } = searchParams;

  const user = await getCurrentUser();
  if (user) {
    redirect(redirectTo || "/search");
  }

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

    let success = false;
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
      success = await login(email, password);
      if (success) {
        await logServerEvent("signup_success", "/sign-up", { email, method: "email" });
      }
    } catch (err: any) {
      console.error("[SIGNUP_ERROR]", err);
      
      let msg = "An error occurred during sign up. Please try again.";
      const firstError = err.errors?.[0];
      const errMsg = firstError?.message || err.message || "";
      const errCode = firstError?.extensions?.code || "";
      
      if (errCode === "RECORD_NOT_UNIQUE" || errMsg.toLowerCase().includes("unique")) {
        if (errMsg.toLowerCase().includes("email")) {
          msg = "An account with this email address already exists. Please sign in or use a different email.";
        } else {
          msg = "This account information is already registered.";
        }
      } else if (errMsg) {
        msg = errMsg;
      }

      redirect(`/sign-up?error=${encodeURIComponent(msg)}`);
    }

    if (success) {
      redirect("/search");
    } else {
      redirect("/sign-in?error=Account created. Please log in.");
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
      redirect(`/sign-up?error=Google login is not configured. Please contact admin.`);
    }

    redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile`
    );
  }

  return (
    <div className="w-full max-w-[450px] bg-[#1a2333]/90 border border-[#2d3a5a] backdrop-blur-md p-8 rounded-2xl shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white font-serif">Create Account</h1>
        <p className="text-sm text-slate-300 mt-1">Register for CPE course certification</p>
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

      <form action={handleSignUp} className="space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#e2e7f2] uppercase tracking-wider">First Name *</label>
            <input
              name="firstName"
              type="text"
              required
              className="w-full px-3.5 py-2.5 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-slate-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#e2e7f2] uppercase tracking-wider">Last Name *</label>
            <input
              name="lastName"
              type="text"
              required
              className="w-full px-3.5 py-2.5 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-slate-500 transition-all"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#e2e7f2] uppercase tracking-wider">Email Address *</label>
          <input
            name="email"
            type="email"
            placeholder="name@guidingdiversity.com"
            required
            className="w-full px-3.5 py-2.5 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-slate-500 transition-all"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-sky-300 uppercase tracking-widest">
            Legal Name for Certificate *
          </label>
          <input
            name="legalName"
            type="text"
            placeholder="Exactly as it should appear on certificate"
            required
            className="w-full px-3.5 py-2.5 bg-[#0e1524] border border-sky-500/40 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-sky-500/30 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#e2e7f2] uppercase tracking-wider">TEA ID (Optional)</label>
            <input
              name="teaId"
              type="text"
              placeholder="Texas Ed. ID"
              className="w-full px-3.5 py-2.5 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-slate-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#e2e7f2] uppercase tracking-wider">Password *</label>
            <input
              name="password"
              type="password"
              placeholder="Min. 8 chars"
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 bg-[#0e1524] border border-[#2d3a5a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder:text-slate-500 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-white hover:bg-slate-100 text-[#18223b] font-bold py-2.5 rounded-xl transition text-sm mt-4 shadow-md uppercase tracking-wider"
        >
          Register
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-sky-400 hover:text-sky-300 font-medium hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
