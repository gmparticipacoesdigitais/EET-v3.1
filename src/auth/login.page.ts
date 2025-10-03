import { finalizeRedirectIfNeeded, loginWithGoogle } from './login';
import xanoClient from '../lib/xano';
import { loginEmailSenha, registrarEmailSenha } from './service';
import { validateLoginForm, validateRegisterForm } from '../utils/validation';
import { 
  MessageManager, 
  LoadingManager, 
  FormUtils, 
  PasswordToggle, 
  TabManager,
  RedirectManager 
} from '../utils/ui';

/**
 * Enhanced login page with improved architecture and utilities
 */
class LoginPageManager {
  private messageManager: MessageManager;
  private loadingManager: LoadingManager;
  private tabManager: TabManager;
  
  // DOM Elements
  private loginForm: HTMLFormElement;
  private registerForm: HTMLFormElement;
  private googleBtn: HTMLButtonElement;
  private devBtn: HTMLButtonElement;

  constructor() {
    this.messageManager = new MessageManager();
    this.loadingManager = new LoadingManager();
    this.tabManager = new TabManager('login', () => this.messageManager.hide());
    
    this.initializeElements();
    this.setupEventListeners();
    this.checkAuthState();
    this.handleRedirectResult();
  }

  /**
   * Initialize DOM elements
   */
  private initializeElements(): void {
    this.loginForm = document.getElementById('login-form') as HTMLFormElement;
    this.registerForm = document.getElementById('register-form') as HTMLFormElement;
    this.googleBtn = document.getElementById('btn-google') as HTMLButtonElement;
    this.devBtn = document.getElementById('btn-dev-login') as HTMLButtonElement;

    if (!this.loginForm || !this.registerForm || !this.googleBtn || !this.devBtn) {
      console.error('Required elements not found');
      this.messageManager.error('Erro ao carregar a página. Recarregue e tente novamente.');
    }
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Form submissions
    this.loginForm?.addEventListener('submit', (e) => this.handleLoginSubmit(e));
    this.registerForm?.addEventListener('submit', (e) => this.handleRegisterSubmit(e));

    // Authentication buttons
    this.googleBtn?.addEventListener('click', () => this.handleGoogleLogin());
    this.devBtn?.addEventListener('click', () => this.handleDevLogin());

    // Password toggle functionality
    PasswordToggle.setupAll();

    // Real-time password confirmation validation
    this.setupPasswordConfirmationValidation();

    // Form input validation
    this.setupRealTimeValidation();
  }

  /**
   * Check authentication state
   */
  private checkAuthState(): void {
    if (xanoClient.isAuthenticated()) {
      RedirectManager.redirect('/', 'Usuário já autenticado. Redirecionando...', 500);
    }
  }

  /**
   * Handle redirect result from Google OAuth
   */
  private async handleRedirectResult(): Promise<void> {
    try {
      await finalizeRedirectIfNeeded();
    } catch (error) {
      console.error('Redirect finalization error:', error);
      this.messageManager.error('Erro ao processar login. Tente novamente.');
    }
  }

  /**
   * Setup real-time password confirmation validation
   */
  private setupPasswordConfirmationValidation(): void {
    const confirmPasswordInput = document.getElementById('register-confirm-password') as HTMLInputElement;
    const passwordInput = document.getElementById('register-password') as HTMLInputElement;
    
    if (confirmPasswordInput && passwordInput) {
      confirmPasswordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        if (confirmPassword) {
          if (password === confirmPassword) {
            FormUtils.applySuccessStyle(confirmPasswordInput);
          } else {
            FormUtils.applyErrorStyle(confirmPasswordInput);
          }
        } else {
          FormUtils.resetInputStyle(confirmPasswordInput);
        }
      });
    }
  }

  /**
   * Setup real-time validation for form inputs
   */
  private setupRealTimeValidation(): void {
    // Email validation
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
      input.addEventListener('blur', () => {
        const emailInput = input as HTMLInputElement;
        if (emailInput.value) {
          const validation = validateLoginForm(emailInput.value, 'dummy');
          if (validation.isValid) {
            FormUtils.applySuccessStyle(emailInput);
          } else {
            FormUtils.applyErrorStyle(emailInput);
          }
        } else {
          FormUtils.resetInputStyle(emailInput);
        }
      });
    });

    // Password validation
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
      input.addEventListener('blur', () => {
        const passwordInput = input as HTMLInputElement;
        if (passwordInput.value && passwordInput.id.includes('password') && !passwordInput.id.includes('confirm')) {
          if (passwordInput.value.length >= 6) {
            FormUtils.applySuccessStyle(passwordInput);
          } else {
            FormUtils.applyErrorStyle(passwordInput);
          }
        }
      });
    });
  }

  /**
   * Handle login form submission
   */
  private async handleLoginSubmit(e: Event): Promise<void> {
    e.preventDefault();
    
    if (this.loadingManager.isLoading()) return;
    
    const formData = FormUtils.getFormData(this.loginForm);
    const { email, password } = formData;
    
    // Validate form
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
      this.messageManager.error(validation.message!);
      return;
    }
    
    this.loadingManager.setLoading('login', true);
    this.messageManager.info('Entrando...');
    
    try {
      await loginEmailSenha(email, password);
      this.messageManager.success('Login realizado com sucesso!');
      RedirectManager.redirect('/');
    } catch (error: any) {
      console.error('Login error:', error);
      this.messageManager.error(error.message || 'Erro ao fazer login. Tente novamente.');
    } finally {
      this.loadingManager.setLoading('login', false);
    }
  }

  /**
   * Handle register form submission
   */
  private async handleRegisterSubmit(e: Event): Promise<void> {
    e.preventDefault();
    
    if (this.loadingManager.isLoading()) return;
    
    const formData = FormUtils.getFormData(this.registerForm);
    const { name, email, password, confirmPassword } = formData;
    
    // Validate form
    const validation = validateRegisterForm(name, email, password, confirmPassword);
    if (!validation.isValid) {
      this.messageManager.error(validation.message!);
      return;
    }
    
    this.loadingManager.setLoading('register', true);
    this.messageManager.info('Criando conta...');
    
    try {
      await registrarEmailSenha(email, password);
      this.messageManager.success('Conta criada com sucesso!');
      RedirectManager.redirect('/');
    } catch (error: any) {
      console.error('Register error:', error);
      this.messageManager.error(error.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      this.loadingManager.setLoading('register', false);
    }
  }

  /**
   * Handle Google login
   */
  private async handleGoogleLogin(): Promise<void> {
    if (this.loadingManager.isLoading()) return;
    
    this.loadingManager.setLoading('google', true);
    this.messageManager.info('Abrindo Google...');
    
    try {
      await loginWithGoogle();
      this.messageManager.success('Login realizado com sucesso!');
      RedirectManager.redirect('/');
    } catch (error: any) {
      console.error('Google login error:', error);
      this.messageManager.error(error.message || 'Erro ao fazer login com Google. Tente novamente.');
    } finally {
      this.loadingManager.setLoading('google', false);
    }
  }

  /**
   * Handle developer login
   */
  private async handleDevLogin(): Promise<void> {
    if (this.loadingManager.isLoading()) return;
    
    const devEmail = 'gmparticipacoes@gmail.com';
    const devPassword = 'gmparticipacoes1234!';
    
    this.loadingManager.setLoading('dev', true);
    this.messageManager.info('Fazendo login como desenvolvedor...');
    
    try {
      await loginEmailSenha(devEmail, devPassword);
      this.messageManager.success('Login de desenvolvedor realizado com sucesso!');
      RedirectManager.redirect('/');
    } catch (error: any) {
      console.error('Dev login error:', error);
      
      // If dev account doesn't exist, try to create it
      if (error.code === 'auth/user-not-found') {
        try {
          this.messageManager.info('Criando conta de desenvolvedor...');
          await registrarEmailSenha(devEmail, devPassword);
          this.messageManager.success('Conta de desenvolvedor criada e login realizado!');
          RedirectManager.redirect('/');
        } catch (createError: any) {
          console.error('Dev account creation error:', createError);
          this.messageManager.error('Erro ao criar conta de desenvolvedor.');
        }
      } else {
        this.messageManager.error(error.message || 'Erro no login de desenvolvedor.');
      }
    } finally {
      this.loadingManager.setLoading('dev', false);
    }
  }

  /**
   * Cleanup method for removing event listeners
   */
  public cleanup(): void {
    this.loadingManager.clearAll();
    this.messageManager.hide();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LoginPageManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Any cleanup if needed
});

// Export for potential external use
export { LoginPageManager };

