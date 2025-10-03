// Authentication Service

import xanoClient, { XanoAuthError, XanoError } from '../lib/xano';

// Types
export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends AuthCredentials {
  name?: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface AuthResult {
  uid: string;
  email: string;
}

// Dev credentials from environment
const DEV_EMAIL = import.meta.env?.VITE_DEV_EMAIL;
const DEV_PASSWORD = import.meta.env?.VITE_DEV_PASSWORD;

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Register new user with email and password
 */
export async function registrarEmailSenha(
  email: string,
  password: string,
  data?: { name?: string; cpfCnpj?: string; phone?: string }
): Promise<AuthResult> {
  // Validate inputs
  if (!email || !password) {
    throw new Error('Email e senha são obrigatórios');
  }

  if (!isValidEmail(email)) {
    throw new Error('Email inválido');
  }

  if (!isValidPassword(password)) {
    throw new Error('A senha deve ter no mínimo 6 caracteres');
  }

  try {
    const result = await xanoClient.signup(email, password, data?.name);
    return {
      uid: String(result.user.id),
      email: result.user.email
    };
  } catch (error) {
    if (error instanceof XanoAuthError) {
      throw new Error('Falha na autenticação. Verifique suas credenciais.');
    }

    if (error instanceof XanoError) {
      throw new Error(error.message);
    }

    throw new Error('Erro ao criar conta. Tente novamente.');
  }
}

/**
 * Login with email and password
 */
export async function loginEmailSenha(
  email: string,
  password: string
): Promise<AuthResult> {
  // Validate inputs
  if (!email || !password) {
    throw new Error('Email e senha são obrigatórios');
  }

  if (!isValidEmail(email)) {
    throw new Error('Email inválido');
  }

  // Check for dev credentials
  if (DEV_EMAIL && DEV_PASSWORD && email === DEV_EMAIL && password === DEV_PASSWORD) {
    return {
      uid: 'dev',
      email: DEV_EMAIL
    };
  }

  try {
    const result = await xanoClient.login(email, password);
    return {
      uid: String(result.user.id),
      email: result.user.email
    };
  } catch (error) {
    if (error instanceof XanoAuthError) {
      throw new Error('Email ou senha incorretos');
    }

    if (error instanceof XanoError) {
      throw new Error(error.message);
    }

    throw new Error('Erro ao fazer login. Tente novamente.');
  }
}

/**
 * Logout current user
 */
export function logout(): void {
  try {
    xanoClient.clearAuthToken();
  } catch (error) {
    console.error('Error during logout:', error);
  }
}

/**
 * Request password reset email
 */
export async function resetPasswordByEmail(
  email: string,
  redirectTo?: string
): Promise<void> {
  if (!email) {
    throw new Error('Email é obrigatório');
  }

  if (!isValidEmail(email)) {
    throw new Error('Email inválido');
  }

  // TODO: Implement password reset with Xano
  throw new Error('Reset de senha não implementado com Xano. Entre em contato com o suporte.');
}

/**
 * Login with Google popup (disabled)
 */
export async function loginGooglePopup(): Promise<never> {
  throw new Error('Login com Google não está disponível');
}

/**
 * Login with Google One Tap (disabled)
 */
export async function loginGoogleOneTap(): Promise<null> {
  return null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return xanoClient.isAuthenticated();
}

/**
 * Get current user data
 */
export async function getCurrentUser(): Promise<AuthResult | null> {
  if (!xanoClient.isAuthenticated()) {
    return null;
  }

  try {
    const user = await xanoClient.getMe();
    return {
      uid: String(user.id),
      email: user.email
    };
  } catch (error) {
    if (error instanceof XanoAuthError) {
      xanoClient.clearAuthToken();
      return null;
    }

    throw error;
  }
}
