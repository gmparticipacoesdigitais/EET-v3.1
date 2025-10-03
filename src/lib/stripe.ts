// Stripe Configuration and Integration

export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  priceId: import.meta.env.VITE_STRIPE_PRICE_ID,
  productId: import.meta.env.VITE_STRIPE_PRODUCT_ID
} as const;

if (!STRIPE_CONFIG.publishableKey || !STRIPE_CONFIG.priceId || !STRIPE_CONFIG.productId) {
  console.warn('Stripe configuration is missing from environment variables. Some features may not work.');
}

/**
 * Stripe service for client-side operations.
 */
class StripeService {
  private publishableKey: string;

  constructor(publishableKey: string) {
    this.publishableKey = publishableKey;
  }

  /**
   * Load Stripe.js dynamically.
   */
  private async loadStripeJS(): Promise<any> {
    if ((window as any).Stripe) {
      return (window as any).Stripe;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        resolve((window as any).Stripe);
      };
      script.onerror = () => reject(new Error('Failed to load Stripe.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Redirects to Stripe Checkout.
   */
  async redirectToCheckout(sessionId: string): Promise<void> {
    if (!this.publishableKey) {
      throw new Error('Stripe publishable key is not configured.');
    }

    try {
      const stripe = await this.loadStripeJS();
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error('Stripe redirectToCheckout error:', error);
        throw new Error(error.message || 'Failed to redirect to Stripe Checkout.');
      }
    } catch (error) {
      console.error('Error redirecting to checkout:', error);
      throw error;
    }
  }
}

export const stripeService = new StripeService(STRIPE_CONFIG.publishableKey);
export default stripeService;

