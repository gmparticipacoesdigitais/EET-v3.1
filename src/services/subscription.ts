// Subscription Service - Handles Stripe + Xano integration

import xanoClient, { XanoSubscription, XanoError, XanoAuthError } from '../lib/xano';
import { STRIPE_CONFIG } from '../lib/stripe';

// Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
  stripeProductId: string;
}

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'none';

export interface UserSubscription {
  id: number;
  userId: number;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  createdAt: number;
  updatedAt: number;
}

// Subscription plans configuration
const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_premium',
    name: 'Premium',
    price: 29.90,
    currency: 'BRL',
    interval: 'month',
    features: [
      'Acesso ilimitado a todas funcionalidades',
      'Suporte prioritário 24/7',
      'Relatórios avançados e analytics',
      'Integração com APIs externas',
      'Backup automático diário',
      'Exportação de dados em múltiplos formatos'
    ],
    stripePriceId: STRIPE_CONFIG.priceId,
    stripeProductId: STRIPE_CONFIG.productId
  }
];

/**
 * Subscription service for managing user subscriptions
 */
class SubscriptionService {
  /**
   * Get all available subscription plans
   */
  getPlans(): SubscriptionPlan[] {
    return [...SUBSCRIPTION_PLANS];
  }

  /**
   * Get a specific plan by ID
   */
  getPlanById(planId: string): SubscriptionPlan | null {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === planId) || null;
  }

  /**
   * Get a plan by Stripe price ID
   */
  getPlanByPriceId(priceId: string): SubscriptionPlan | null {
    return SUBSCRIPTION_PLANS.find(plan => plan.stripePriceId === priceId) || null;
  }

  /**
   * Create a Stripe checkout session via Xano backend
   */
  async createCheckoutSession(priceId: string): Promise<string> {
    if (!priceId) {
      throw new Error('Price ID é obrigatório');
    }

    // Validate that the price ID is valid
    const plan = this.getPlanByPriceId(priceId);
    if (!plan) {
      throw new Error('Plano de assinatura inválido');
    }

    try {
      const { sessionId } = await xanoClient.createCheckoutSession(priceId);
      return sessionId;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(): Promise<UserSubscription | null> {
    try {
      const subscription = await xanoClient.getSubscription();

      if (!subscription) {
        return null;
      }

      return this.mapXanoSubscription(subscription);
    } catch (error) {
        if (error instanceof XanoError && error.statusCode === 404) {
          return null;
        }
        throw error;
    }
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(): Promise<void> {
    try {
      await xanoClient.cancelSubscription();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(): Promise<void> {
    try {
      await xanoClient.resumeSubscription();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription();
      return subscription !== null && subscription.status === 'active';
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get Stripe Customer Portal URL
   */
  async getCustomerPortalUrl(): Promise<string> {
    try {
      const response = await xanoClient.getCustomerPortalUrl();
      return response.url;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle successful subscription (called from success page)
   */
  async confirmSubscription(sessionId: string): Promise<void> {
    if (!sessionId) {
      throw new Error('Session ID é obrigatório');
    }

    try {
      await xanoClient.confirmSubscription(sessionId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subscription status label in Portuguese
   */
  getStatusLabel(status: SubscriptionStatus): string {
    const statusMap: Record<SubscriptionStatus, string> = {
      active: 'Ativa',
      canceled: 'Cancelada',
      past_due: 'Vencida',
      trialing: 'Período de Teste',
      incomplete: 'Incompleta',
      none: 'Sem assinatura'
    };

    return statusMap[status] || status;
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  /**
   * Format price for display
   */
  formatPrice(price: number, currency: string = 'BRL'): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency
    }).format(price);
  }

  /**
   * Map Xano subscription to UserSubscription
   */
  private mapXanoSubscription(subscription: XanoSubscription): UserSubscription {
    return {
      id: subscription.id,
      userId: subscription.user_id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      stripePriceId: subscription.stripe_price_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at
    };
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
export default subscriptionService;