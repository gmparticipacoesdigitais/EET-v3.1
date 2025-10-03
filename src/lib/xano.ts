// Xano API Client Configuration

const XANO_BASE_URL = import.meta.env.VITE_XANO_BASE_URL;

if (!XANO_BASE_URL) {
  throw new Error('VITE_XANO_BASE_URL is not defined in your environment variables');
}


// Types
export interface XanoUser {
  id: number;
  email: string;
  name?: string;
  created_at?: number;
  stripe_customer_id?: string;
  subscription_status?: string;
}

export interface XanoAuthResponse {
  authToken: string;
  user: XanoUser;
}

export interface XanoSubscription {
  id: number;
  user_id: number;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  created_at: number;
  updated_at: number;
}

export interface CheckoutSessionResponse {
  url: string;
  sessionId: string;
}

export interface CustomerPortalResponse {
  url: string;
}

// Error types
export class XanoError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'XanoError';
  }
}

export class XanoAuthError extends XanoError {
  constructor(message: string) {
    super(message);
    this.name = 'XanoAuthError';
  }
}

export class XanoNetworkError extends XanoError {
  constructor(message: string, originalError?: unknown) {
    super(message, undefined, originalError);
    this.name = 'XanoNetworkError';
  }
}

// Xano Client
class XanoClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private readonly tokenKey = 'xano_auth_token';

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.restoreToken();
  }

  /**
   * Restore auth token from localStorage
   */
  private restoreToken(): void {
    if (typeof window === 'undefined') return;

    try {
      this.authToken = localStorage.getItem(this.tokenKey);
    } catch (error) {
      console.warn('Failed to restore auth token:', error);
    }
  }

  /**
   * Generic request method with proper error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use statusText
          errorMessage = response.statusText || errorMessage;
        }

        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          this.clearAuthToken();
          throw new XanoAuthError(errorMessage);
        }

        throw new XanoError(errorMessage, response.status);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      // Handle network errors
      if (error instanceof XanoError) {
        throw error;
      }

      throw new XanoNetworkError(
        'Network request failed. Please check your connection.',
        error
      );
    }
  }

  // Auth Methods
  async signup(email: string, password: string, name?: string): Promise<XanoAuthResponse> {
    if (!email || !password) {
      throw new XanoError('Email and password are required');
    }

    const data = await this.request<XanoAuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });

    this.setAuthToken(data.authToken);
    return data;
  }

  async login(email: string, password: string): Promise<XanoAuthResponse> {
    if (!email || !password) {
      throw new XanoError('Email and password are required');
    }

    const data = await this.request<XanoAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setAuthToken(data.authToken);
    return data;
  }

  async getMe(): Promise<XanoUser> {
    if (!this.authToken) {
      throw new XanoAuthError('Not authenticated');
    }

    return this.request<XanoUser>('/auth/me');
  }

  // User Methods
  async getUser(userId: number): Promise<XanoUser> {
    if (!userId || userId <= 0) {
      throw new XanoError('Invalid user ID');
    }

    return this.request<XanoUser>(`/user/${userId}`);
  }

  async updateUser(userId: number, data: Partial<XanoUser>): Promise<XanoUser> {
    if (!userId || userId <= 0) {
      throw new XanoError('Invalid user ID');
    }

    return this.request<XanoUser>(`/user/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Subscription Methods
  async getSubscription(): Promise<XanoSubscription | null> {
    if (!this.authToken) {
      throw new XanoAuthError('Not authenticated');
    }

    try {
      return await this.request<XanoSubscription>('/subscription/current');
    } catch (error) {
      // Return null for 404 errors (no subscription)
      if (error instanceof XanoError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async createCheckoutSession(priceId: string): Promise<CheckoutSessionResponse> {
    if (!this.authToken) {
      throw new XanoAuthError('Not authenticated');
    }

    if (!priceId) {
      throw new XanoError('Price ID is required');
    }

    const successUrl = `${window.location.origin}/subscription-success.html`;
    const cancelUrl = `${window.location.origin}/subscription-cancel.html`;

    return this.request<CheckoutSessionResponse>('/subscription/create-checkout', {
      method: 'POST',
      body: JSON.stringify({
        priceId,
        successUrl,
        cancelUrl
      }),
    });
  }

  async cancelSubscription(): Promise<void> {
    if (!this.authToken) {
      throw new XanoAuthError('Not authenticated');
    }

    await this.request<void>('/subscription/cancel', {
      method: 'POST',
    });
  }

  async resumeSubscription(): Promise<void> {
    if (!this.authToken) {
      throw new XanoAuthError('Not authenticated');
    }

    await this.request<void>('/subscription/resume', {
      method: 'POST',
    });
  }

  async getCustomerPortalUrl(): Promise<CustomerPortalResponse> {
    if (!this.authToken) {
      throw new XanoAuthError('Not authenticated');
    }

    return this.request<CustomerPortalResponse>('/subscription/portal', {
      method: 'POST',
      body: JSON.stringify({
        returnUrl: window.location.origin
      }),
    });
  }

  async confirmSubscription(sessionId: string): Promise<void> {
    if (!this.authToken) {
      throw new XanoAuthError('Not authenticated');
    }

    if (!sessionId) {
      throw new XanoError('Session ID is required');
    }

    await this.request<void>('/subscription/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  // Token Management
  setAuthToken(token: string): void {
    if (!token) {
      throw new XanoError('Invalid token');
    }

    this.authToken = token;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.tokenKey, token);
      } catch (error) {
        console.warn('Failed to save auth token:', error);
      }
    }
  }

  clearAuthToken(): void {
    this.authToken = null;

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.tokenKey);
      } catch (error) {
        console.warn('Failed to clear auth token:', error);
      }
    }
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Export singleton instance
export const xanoClient = new XanoClient(XANO_BASE_URL);
export default xanoClient;
