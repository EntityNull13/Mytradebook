/**
 * Client-Side Authentication Service
 * 
 * HARDENED IMPLEMENTATION:
 * - Purely cookie-based authentication using HttpOnly, SameSite=Lax session cookies.
 * - Zero client-side session token storage (no sessionStorage, localStorage, or memory tokens).
 * - Zero Authorization: Bearer headers (raw tokens are never exposed to browser JS).
 * - All requests use credentials: 'include'.
 */

export async function checkAuthStatus(retries = 1, delayMs = 300): Promise<{ authenticated: boolean; role?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { authenticated: false };
      }

      const data = await res.json();
      return {
        authenticated: Boolean(data.authenticated),
        role: data.role,
      };
    } catch (err) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      console.warn('Unable to verify admin authentication (server starting or offline):', err);
      return { authenticated: false };
    }
  }
  return { authenticated: false };
}

export async function loginAdmin(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Invalid admin credentials',
      };
    }

    return { success: true };
  } catch (err) {
    console.error('Login request failed:', err);
    return {
      success: false,
      error: 'Cannot connect to server. Please check your network connection.',
    };
  }
}

export async function logoutAdmin(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error('Logout error:', err);
  }
}
