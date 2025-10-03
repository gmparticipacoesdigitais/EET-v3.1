import { finalizeRedirectIfNeeded, loginWithGoogle } from './login';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { loginEmailSenha, registrarEmailSenha } from './service';

// Types
interface FormData {
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
}

// DOM Elements
let loginForm: HTMLFormElement;
let registerForm: HTMLFormElement;
let loginTab: HTMLButtonElement;
let registerTab: HTMLButtonElement;
let googleBtn: HTMLButtonElement;
let devBtn: HTMLButtonElement;
let messageEl: HTMLElement;

// State
let currentTab: 'login' | 'register' = 'login';
let isLoading = false;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  
  // Check if already logged in
  onAuthStateChanged(auth, (user) => {
    if (user) {
      showMessage('Redirecionando...', 'info');
      setTimeout(() => location.assign('/'), 500);
    }
  });

  // Handle redirect result if needed
  try {
    await finalizeRedirectIfNeeded();
  } catch (error) {
    console.error('Redirect finalization error:', error);
  }
});

function initializeElements(): void {
  loginForm = document.getElementById('login-form') as HTMLFormElement;
  registerForm = document.getElementById('register-form') as HTMLFormElement;
  loginTab = document.querySelector('[data-tab="login"]') as HTMLButtonElement;
  registerTab = document.querySelector('[data-tab="register"]') as HTMLButtonElement;
  googleBtn = document.getElementById('btn-google') as HTMLButtonElement;
  devBtn = document.getElementById('btn-dev-login') as HTMLButtonElement;
  messageEl = document.getElementById('message') as HTMLElement;

  if (!loginForm || !registerForm || !loginTab || !registerTab || !googleBtn || !devBtn || !messageEl) {
    console.error('Required elements not found');
    return;
  }
}

function setupEventListeners(): void {
  // Tab switching
  loginTab?.addEventListener('click', () => switchTab('login'));
  registerTab?.addEventListener('click', () => switchTab('register'));

  // Form submissions
  loginForm?.addEventListener('submit', handleLoginSubmit);
  registerForm?.addEventListener('submit', handleRegisterSubmit);

  // Google login
  googleBtn?.addEventListener('click', handleGoogleLogin);

  // Developer login
  devBtn?.addEventListener('click', handleDevLogin);

  // Password toggle buttons
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', togglePasswordVisibility);
  });

  // Real-time password confirmation validation
  const confirmPasswordInput = document.getElementById('register-confirm-password') as HTMLInputElement;
  const passwordInput = document.getElementById('register-password') as HTMLInputElement;
  
  if (confirmPasswordInput && passwordInput) {
    confirmPasswordInput.addEventListener('input', () => {
      validatePasswordConfirmation(passwordInput.value, confirmPasswordInput.value);
    });
  }
}

function switchTab(tab: 'login' | 'register'): void {
  currentTab = tab;
  
  // Update tab buttons
  loginTab.classList.toggle('active', tab === 'login');
  registerTab.classList.toggle('active', tab === 'register');
  
  // Update forms
  loginForm.classList.toggle('active', tab === 'login');
  registerForm.classList.toggle('active', tab === 'register');
  
  // Clear any messages
  hideMessage();
}

async function handleLoginSubmit(e: Event): Promise<void> {
  e.preventDefault();
  
  if (isLoading) return;
  
  const formData = new FormData(loginForm);
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  if (!email || !password) {
    showMessage('Por favor, preencha todos os campos.', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showMessage('Por favor, insira um e-mail válido.', 'error');
    return;
  }
  
  setLoading(true, 'login');
  showMessage('Entrando...', 'info');
  
  try {
    await loginEmailSenha(email, password);
    showMessage('Login realizado com sucesso! Redirecionando...', 'success');
    setTimeout(() => location.assign('/'), 1000);
  } catch (error: any) {
    console.error('Login error:', error);
    showMessage(error.message || 'Erro ao fazer login. Tente novamente.', 'error');
  } finally {
    setLoading(false, 'login');
  }
}

async function handleRegisterSubmit(e: Event): Promise<void> {
  e.preventDefault();
  
  if (isLoading) return;
  
  const formData = new FormData(registerForm);
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  
  if (!name || !email || !password || !confirmPassword) {
    showMessage('Por favor, preencha todos os campos.', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showMessage('Por favor, insira um e-mail válido.', 'error');
    return;
  }
  
  if (password.length < 6) {
    showMessage('A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showMessage('As senhas não coincidem.', 'error');
    return;
  }
  
  setLoading(true, 'register');
  showMessage('Criando conta...', 'info');
  
  try {
    await registrarEmailSenha(email, password);
    showMessage('Conta criada com sucesso! Redirecionando...', 'success');
    setTimeout(() => location.assign('/'), 1000);
  } catch (error: any) {
    console.error('Register error:', error);
    showMessage(error.message || 'Erro ao criar conta. Tente novamente.', 'error');
  } finally {
    setLoading(false, 'register');
  }
}

async function handleGoogleLogin(): Promise<void> {
  if (isLoading) return;
  
  setLoading(true, 'google');
  showMessage('Abrindo Google...', 'info');
  
  try {
    await loginWithGoogle();
    showMessage('Login realizado com sucesso! Redirecionando...', 'success');
    setTimeout(() => location.assign('/'), 1000);
  } catch (error: any) {
    console.error('Google login error:', error);
    showMessage(error.message || 'Erro ao fazer login com Google. Tente novamente.', 'error');
  } finally {
    setLoading(false, 'google');
  }
}

async function handleDevLogin(): Promise<void> {
  if (isLoading) return;
  
  const devEmail = 'gmparticipacoes@gmail.com';
  const devPassword = 'gmparticipacoes1234!';
  
  setLoading(true, 'dev');
  showMessage('Fazendo login como desenvolvedor...', 'info');
  
  try {
    await loginEmailSenha(devEmail, devPassword);
    showMessage('Login de desenvolvedor realizado com sucesso! Redirecionando...', 'success');
    setTimeout(() => location.assign('/'), 1000);
  } catch (error: any) {
    console.error('Dev login error:', error);
    
    // If dev account doesn't exist, try to create it
    if (error.code === 'auth/user-not-found') {
      try {
        showMessage('Criando conta de desenvolvedor...', 'info');
        await registrarEmailSenha(devEmail, devPassword);
        showMessage('Conta de desenvolvedor criada e login realizado! Redirecionando...', 'success');
        setTimeout(() => location.assign('/'), 1000);
      } catch (createError: any) {
        console.error('Dev account creation error:', createError);
        showMessage('Erro ao criar conta de desenvolvedor.', 'error');
      }
    } else {
      showMessage(error.message || 'Erro no login de desenvolvedor.', 'error');
    }
  } finally {
    setLoading(false, 'dev');
  }
}

function togglePasswordVisibility(e: Event): void {
  const button = e.target as HTMLButtonElement;
  const targetId = button.getAttribute('data-target');
  const input = document.getElementById(targetId!) as HTMLInputElement;
  const icon = button.querySelector('i') as HTMLElement;
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

function validatePasswordConfirmation(password: string, confirmPassword: string): void {
  const confirmInput = document.getElementById('register-confirm-password') as HTMLInputElement;
  
  if (confirmPassword && password !== confirmPassword) {
    confirmInput.style.borderColor = '#e53e3e';
    confirmInput.style.boxShadow = '0 0 0 3px rgba(229, 62, 62, 0.1)';
  } else {
    confirmInput.style.borderColor = '#e2e8f0';
    confirmInput.style.boxShadow = 'none';
  }
}

function setLoading(loading: boolean, context: 'login' | 'register' | 'google' | 'dev'): void {
  isLoading = loading;
  
  const buttons = {
    login: loginForm?.querySelector('.btn-primary') as HTMLButtonElement,
    register: registerForm?.querySelector('.btn-primary') as HTMLButtonElement,
    google: googleBtn,
    dev: devBtn
  };
  
  Object.entries(buttons).forEach(([key, button]) => {
    if (button) {
      button.disabled = loading;
      if (key === context) {
        button.classList.toggle('loading', loading);
      }
    }
  });
}

function showMessage(text: string, type: 'error' | 'success' | 'info'): void {
  if (!messageEl) return;
  
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;
  
  // Auto-hide success and info messages
  if (type === 'success' || type === 'info') {
    setTimeout(() => hideMessage(), 5000);
  }
}

function hideMessage(): void {
  if (!messageEl) return;
  
  messageEl.classList.remove('show');
  setTimeout(() => {
    messageEl.textContent = '';
    messageEl.className = 'message';
  }, 300);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export for potential external use
export {
  switchTab,
  handleLoginSubmit,
  handleRegisterSubmit,
  handleGoogleLogin,
  handleDevLogin
};

