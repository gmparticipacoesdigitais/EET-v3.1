// Authentication Gate - Route Protection

import xanoClient, { XanoAuthError } from '../lib/xano';

export type AuthReadyCallback = (uid: string) => void;

/**
 * Route guard that ensures user is authenticated before rendering protected content
 * Redirects to login if user is not authenticated
 */
export function mountAuthGate(onReady: AuthReadyCallback): void {
  if (!onReady || typeof onReady !== 'function') {
    throw new Error('onReady callback is required');
  }

  checkAuthentication(onReady);
}

/**
 * Check authentication status and handle redirect logic
 */
async function checkAuthentication(onReady: AuthReadyCallback): Promise<void> {
  // Check if user has a token
  if (!xanoClient.isAuthenticated()) {
    redirectToLogin();
    return;
  }

  try {
    // Verify token is still valid by fetching user data
    const user = await xanoClient.getMe();

    if (!user || !user.id) {
      throw new XanoAuthError('Invalid user data');
    }

    // User is authenticated, call ready callback
    onReady(String(user.id));
  } catch (error) {
    // Token is invalid or expired, clear it and redirect to login
    console.warn('Authentication verification failed:', error);
    xanoClient.clearAuthToken();
    redirectToLogin();
  }
}

/**
 * Redirect to login page if not already there
 */
function redirectToLogin(): void {
  // Avoid redirect loop if already on login page
  const currentPath = window.location.pathname;
  const isOnLoginPage =
    currentPath.endsWith('/login.html') ||
    currentPath === '/login.html' ||
    currentPath === '/login';

  if (!isOnLoginPage) {
    window.location.assign('/login.html');
  }
}

/**
 * Check if current user is authenticated (sync check only)
 * Does not verify token validity with server
 */
export function isAuthenticatedSync(): boolean {
  return xanoClient.isAuthenticated();
}

/**
 * Async authentication check that verifies with server
 */
export async function isAuthenticatedAsync(): Promise<boolean> {
  if (!xanoClient.isAuthenticated()) {
    return false;
  }

  try {
    await xanoClient.getMe();
    return true;
  } catch (error) {
    xanoClient.clearAuthToken();
    return false;
  }
}
