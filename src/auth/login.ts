// Login Utilities (Xano-based)

import xanoClient from '../lib/xano';

/**
 * Complete redirect-based login (not needed for Xano)
 * Kept for backward compatibility
 */
export async function finalizeRedirectIfNeeded(): Promise<void> {
  // Not needed for Xano - Google login is disabled
  // This function is kept for backward compatibility with existing code
}

/**
 * Ensure session persistence (handled by Xano client automatically)
 * Kept for backward compatibility
 */
export async function ensureAuthPersistence(): Promise<void> {
  // Xano uses localStorage for token persistence by default
  // This is handled automatically in the XanoClient constructor
}

/**
 * Utility for debugging env mistakes (not needed for Xano)
 * Kept for backward compatibility
 */
export function assertEnv(): void {
  // No environment variables required for Xano
  // Authentication is handled via API endpoints
}

/**
 * Login with Google (disabled for Xano)
 */
export async function loginWithGoogle(): Promise<never> {
  throw new Error('Login com Google não está disponível com Xano');
}

/**
 * Logout and redirect to login page
 */
export async function logoutToLogin(): Promise<void> {
  try {
    xanoClient.clearAuthToken();

    // Clear any other session data if needed
    sessionStorage.clear();

    // Redirect to login page
    window.location.assign('/login.html');
  } catch (error) {
    console.error('Error during logout:', error);
    // Still redirect even if there was an error
    window.location.assign('/login.html');
  }
}

/**
 * Simple logout without redirect
 */
export function logout(): void {
  xanoClient.clearAuthToken();
  sessionStorage.clear();
}
