import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { readUsers, createUser, updateUser, readRoles, readRole } from "@directus/sdk";
import { db, DirectusUser } from "@/lib/db";
import { login } from "@/lib/auth";
import { logServerEvent } from "@/lib/observability";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // Optional, for CSRF protection if needed
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!code) {
    console.error("[OAUTH_CALLBACK_ERROR] Missing authorization code from Google");
    return NextResponse.redirect(
      new URL(`/sign-in?error=Google authentication failed. Please try again.`, appUrl)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    console.error("[OAUTH_CALLBACK_ERROR] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set in environment");
    return NextResponse.redirect(
      new URL(`/sign-in?error=Server configuration error. Please contact support.`, appUrl)
    );
  }

  const cookieStore = cookies();
  const redirectTo = cookieStore.get("oauth_redirect")?.value || "/search";

  // Clean up temporary cookie
  try {
    cookieStore.delete("oauth_redirect");
  } catch (err) {
    // Ignore cookie deletion errors in server environment
  }

  try {
    // 1. Exchange authorization code for Google access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Failed to exchange code: ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const googleAccessToken = tokenData.access_token;

    // 2. Fetch user profile from Google UserInfo endpoint
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const errText = await profileResponse.text();
      throw new Error(`Failed to fetch user profile from Google: ${errText}`);
    }

    const profile = await profileResponse.json();
    const email = profile.email;
    const firstName = profile.given_name || "";
    const lastName = profile.family_name || "";

    if (!email) {
      throw new Error("No email returned from Google OAuth profile");
    }

    // 3. Look up user in Directus by email using the Admin Client
    const users = await db.request(
      readUsers({
        filter: { email: { _eq: email } },
      })
    );

    let user = users[0] as unknown as DirectusUser;

    // Check if the user is an Administrator to avoid wiping their password via Google OAuth login
    if (user && (user as any).role) {
      const role = await db.request(readRole((user as any).role));
      if (role && role.name && role.name.toLowerCase() === "administrator") {
        console.error(`[OAUTH_CALLBACK_ERROR] Administrator ${email} attempted to sign in via Google OAuth`);
        return NextResponse.redirect(
          new URL(`/sign-in?error=Google sign-in is not allowed for administrator accounts. Please sign in using your email and password.`, appUrl)
        );
      }
    }

    // 4. If user doesn't exist, register them as a Student with empty legal_name
    const isNewUser = !user;
    if (!user) {
      // Fetch Student role ID dynamically
      const roles = await db.request(
        readRoles({
          filter: { name: { _eq: "Student" } },
        })
      );
      const studentRole = roles[0];
      if (!studentRole) {
        throw new Error("Student role is not configured in Directus");
      }

      // Create new user in Directus
      user = (await db.request(
        createUser({
          email,
          first_name: firstName,
          last_name: lastName,
          role: studentRole.id,
          legal_name: "", // Leave blank to trigger profile confirmation gate
        } as any)
      )) as unknown as DirectusUser;
    }

    // 5. Generate a secure random temporary password
    const tempPassword =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      "!";

    // Update user password in Directus
    await db.request(
      updateUser(user.id, {
        password: tempPassword,
      } as any)
    );

    // 6. Log the user into Directus via standard password credentials
    // This calls the login helper, which automatically sets directus_access_token & directus_refresh_token cookies!
    const success = await login(email, tempPassword);

    // 7. Clear user password in Directus to enforce passwordless Google logins
    await db.request(
      updateUser(user.id, {
        password: null,
      } as any)
    );

    if (!success) {
      throw new Error("Failed to authenticate session with Directus");
    }

    // 8. Log the OAuth login/signup event
    await logServerEvent(
      isNewUser ? "signup_success" : "login_success",
      "/api/auth/callback",
      { email, method: "google" },
      user.id
    );

    // 8. Gate profile confirmation
    // If legal_name is missing or empty, redirect to confirm-profile onboarding
    if (!user.legal_name || user.legal_name.trim() === "") {
      const confirmUrl = new URL("/confirm-profile", appUrl);
      confirmUrl.searchParams.set("redirectTo", redirectTo);
      return NextResponse.redirect(confirmUrl);
    }

    // Otherwise, redirect to original destination
    return NextResponse.redirect(new URL(redirectTo, appUrl));
  } catch (error: any) {
    console.error("[OAUTH_CALLBACK_PROCESS_ERROR]", error);
    const msg = error.message || "Authentication failed. Please try again.";
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(msg)}`, appUrl)
    );
  }
}
