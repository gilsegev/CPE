import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public/unauthenticated paths
  const isPublicRoute =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/auth/callback") ||
    pathname.startsWith("/api/webhook") ||
    pathname.startsWith("/api/observability") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/courses") ||
    pathname === "/"; // Home landing page is public

  let accessToken = request.cookies.get("directus_access_token")?.value;
  let refreshToken = request.cookies.get("directus_refresh_token")?.value;

  let response = NextResponse.next();

  // If access token is missing but refresh token exists, refresh it in the middleware!
  if (!accessToken && refreshToken) {
    try {
      const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app';
      const refreshResponse = await fetch(`${directusUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken, mode: "json" }),
      });

      if (refreshResponse.ok) {
        const { data } = await refreshResponse.json();
        accessToken = data.access_token;
        refreshToken = data.refresh_token;

        // Set cookies on the response so they save in the browser
        response.cookies.set("directus_access_token", data.access_token, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: data.expires / 1000,
        });

        response.cookies.set("directus_refresh_token", data.refresh_token, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60,
        });

        // Set the Cookie header on the request so Server Components see the refreshed tokens immediately
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(
          "cookie",
          `directus_access_token=${data.access_token}; directus_refresh_token=${data.refresh_token}`
        );

        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        // Copy the set-cookie headers back to the new response
        response.cookies.set("directus_access_token", data.access_token, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: data.expires / 1000,
        });

        response.cookies.set("directus_refresh_token", data.refresh_token, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60,
        });
      } else {
        // Clear invalid cookies
        response.cookies.delete("directus_access_token");
        response.cookies.delete("directus_refresh_token");
        accessToken = undefined;
        refreshToken = undefined;
      }
    } catch (error) {
      console.error("[MIDDLEWARE_REFRESH_ERROR]", error);
      response.cookies.delete("directus_access_token");
      response.cookies.delete("directus_refresh_token");
      accessToken = undefined;
      refreshToken = undefined;
    }
  }

  const hasToken = !!accessToken || !!refreshToken;

  // Redirect unauthenticated users trying to access protected paths to sign-in
  if (!isPublicRoute && !hasToken) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirectTo", pathname);
    const redirectResponse = NextResponse.redirect(signInUrl);
    
    // Clear cookies on redirect so browser cleans them up
    redirectResponse.cookies.delete("directus_access_token");
    redirectResponse.cookies.delete("directus_refresh_token");
    
    return redirectResponse;
  }

  return response;
}

// Protect all paths except static assets, internal Next.js files, and API files
export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};