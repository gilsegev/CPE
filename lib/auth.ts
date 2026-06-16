import { cookies } from "next/headers";
import { createDirectus, rest, readMe, staticToken, readUser, readRole } from "@directus/sdk";
import { CPESchema, DirectusUser, db } from "./db";

const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app';

const customFetch = (input: any, init?: any) => {
  return fetch(input, {
    ...init,
    cache: "no-store",
  });
};

// Helper to create a clean guest client
export function getGuestClient() {
  return createDirectus<CPESchema>(directusUrl, {
    globals: {
      fetch: customFetch,
    },
  }).with(rest());
}

// Helper to get an authenticated client based on current session
export async function getSessionClient() {
  const token = await getValidAccessToken();
  if (!token) return null;

  return createDirectus<CPESchema>(directusUrl, {
    globals: {
      fetch: customFetch,
    },
  })
    .with(rest())
    .with(staticToken(token));
}

// Retrieve a valid access token, refreshing it if expired but a refresh token is present
export async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get("directus_access_token")?.value;

  if (accessToken) {
    return accessToken;
  }

  // If access token is expired, check for refresh token
  const refreshToken = cookieStore.get("directus_refresh_token")?.value;
  if (!refreshToken) {
    return null;
  }

  try {
    // Attempt to refresh the tokens via the Directus API
    const response = await fetch(`${directusUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken, mode: "json" }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const { data } = await response.json();

    // Set the new access and refresh tokens in cookies
    try {
      cookieStore.set("directus_access_token", data.access_token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: data.expires / 1000, // Directus returns expires in milliseconds
      });

      cookieStore.set("directus_refresh_token", data.refresh_token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60, // Keep refresh token for 7 days
      });
    } catch (cookieError) {
      console.warn("[AUTH_COOKIE_SET_SKIPPED] Skip setting cookies during read-only render context.");
    }

    return data.access_token;
  } catch (error) {
    console.error("[AUTH_REFRESH_ERROR]", error);
    // Clear cookies on failure
    try {
      cookieStore.delete("directus_access_token");
      cookieStore.delete("directus_refresh_token");
    } catch (cookieError) {
      console.warn("[AUTH_COOKIE_DELETE_SKIPPED] Skip deleting cookies during read-only render context.");
    }
    return null;
  }
}

// Login function
export async function login(email: string, password: string): Promise<boolean> {
  const cookieStore = cookies();

  try {
    const response = await fetch(`${directusUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, mode: "json" }),
    });

    if (!response.ok) {
      return false;
    }

    const { data } = await response.json();

    // Store tokens in cookies
    cookieStore.set("directus_access_token", data.access_token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: data.expires / 1000,
    });

    cookieStore.set("directus_refresh_token", data.refresh_token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Rotate session ID on successful login to isolate guest vs user sessions
    try {
      cookieStore.delete("cpe_session_id");
    } catch (err) {}

    return true;
  } catch (error) {
    console.error("[AUTH_LOGIN_ERROR]", error);
    return false;
  }
}

// Logout function
export async function logout(): Promise<void> {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get("directus_refresh_token")?.value;

  if (refreshToken) {
    try {
      await fetch(`${directusUrl}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (error) {
      console.error("[AUTH_LOGOUT_ERROR]", error);
    }
  }

  // Always delete local cookies
  cookieStore.delete("directus_access_token");
  cookieStore.delete("directus_refresh_token");
  
  // Rotate session ID on logout to isolate guest vs user sessions
  try {
    cookieStore.delete("cpe_session_id");
  } catch (err) {}
}

// Get currently logged-in user profile
export async function getCurrentUser(): Promise<DirectusUser | null> {
  const client = await getSessionClient();
  if (!client) return null;

  try {
    const user = await client.request(
      readMe({
        fields: ["id", "email", "first_name", "last_name", "legal_name", "tea_id", "role"] as any,
      })
    );
    return user as unknown as DirectusUser;
  } catch (error) {
    console.error("[AUTH_GET_USER_ERROR]", error);
    return null;
  }
}

// Check if a user is an administrator
export async function isAdmin(userId?: string): Promise<boolean> {
  let targetUserId = userId;
  if (!targetUserId) {
    const user = await getCurrentUser();
    if (!user) return false;
    targetUserId = user.id;
  }

  try {
    const user = await db.request(
      readUser(targetUserId, {
        fields: ["role.*", "role"] as any,
      })
    );
    if (!user || !user.role) return false;

    let roleName = "";
    if (typeof user.role === "object" && user.role !== null) {
      roleName = (user.role as any).name || "";
    } else if (typeof user.role === "string") {
      const role = await db.request(readRole(user.role));
      roleName = (role && role.name) || "";
    }

    return roleName.toLowerCase() === "administrator";
  } catch (error) {
    console.error("[IS_ADMIN_ERROR]", error);
    return false;
  }
}
