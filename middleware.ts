import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public/unauthenticated paths
  const isPublicRoute =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/webhook") ||
    pathname === "/"; // Home landing page is public

  const hasToken =
    request.cookies.has("directus_access_token") ||
    request.cookies.has("directus_refresh_token");

  // Redirect authenticated users trying to access login/signup to search catalog
  if (hasToken && (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up"))) {
    return NextResponse.redirect(new URL("/search", request.url));
  }

  // Redirect unauthenticated users trying to access protected paths to sign-in
  if (!isPublicRoute && !hasToken) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

// Protect all paths except static assets, internal Next.js files, and API files
export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};