// Subscription Management Page

import { mountAuthGate } from '../auth/gate';
import subscriptionService, { SubscriptionPlan } from '../services/subscription';
import stripeService from '../lib/stripe';
import { SubscriptionCard } from '../components/SubscriptionCard';
import { SubscriptionStatus } from '../components/SubscriptionStatus';

class SubscriptionPage {
  private currentUserId: string = '';
  private isLoading: boolean = false;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    mountAuthGate((uid) => {
      this.currentUserId = uid;
      this.render();
    });
  }

  private async render(): Promise<void> {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div class="subscription-page">
        <header class="page-header">
          <div class="container">
            <h1>Gerenciar Assinatura</h1>
            <p>Escolha o plano ideal para você</p>
            <a href="/" class="btn-back">← Voltar</a>
          </div>
        </header>

        <main class="page-content">
          <div class="container">
            <div id="subscription-status-container" class="status-section">
              <div class="loading-spinner">Carregando...</div>
            </div>

            <div class="plans-section">
              <h2>Planos Disponíveis</h2>
              <div id="plans-container" class="plans-grid"></div>
            </div>
          </div>
        </main>
      </div>
    `;

    await this.loadSubscriptionStatus();
    this.renderPlans();
  }

  private async loadSubscriptionStatus(): Promise<void> {
    const statusContainer = document.getElementById('subscription-status-container');
    if (!statusContainer) return;

    try {
      const subscription = await subscriptionService.getUserSubscription();

      statusContainer.innerHTML = '';
      const statusComponent = new SubscriptionStatus({
        subscription,
        onManage: () => this.openCustomerPortal(),
        onCancel: () => this.cancelSubscription(),
        onResume: () => this.resumeSubscription()
      });
      statusComponent.render(statusContainer);
    } catch (error) {
      console.error('Error loading subscription:', error);
      statusContainer.innerHTML = `
        <div class="error-message">
          Erro ao carregar informações da assinatura.
          <button onclick="window.location.reload()">Tentar novamente</button>
        </div>
      `;
    }
  }

  private renderPlans(): void {
    const plansContainer = document.getElementById('plans-container');
    if (!plansContainer) return;

    const plans = subscriptionService.getPlans();

    plansContainer.innerHTML = '';
    plans.forEach(plan => {
      const card = new SubscriptionCard({
        plan,
        onSubscribe: (priceId) => this.subscribe(priceId),
        isLoading: this.isLoading
      });
      card.render(plansContainer);
    });
  }

  private async subscribe(priceId: string): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showMessage('Criando sessão de checkout...', 'info');

    try {
      const sessionId = await subscriptionService.createCheckoutSession(priceId);
      await stripeService.redirectToCheckout(sessionId);
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      this.showMessage(
        error.message || 'Erro ao criar sessão de checkout. Tente novamente.',
        'error'
      );
      this.isLoading = false;
    }
  }

  private async openCustomerPortal(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showMessage('Abrindo portal do cliente...', 'info');

    try {
      const url = await subscriptionService.getCustomerPortalUrl();
      window.location.href = url;
    } catch (error: any) {
      console.error('Error opening customer portal:', error);
      this.showMessage(
        error.message || 'Erro ao abrir portal do cliente. Tente novamente.',
        'error'
      );
      this.isLoading = false;
    }
  }

  private async cancelSubscription(): Promise<void> {
    if (this.isLoading) return;

    const confirmed = confirm(
      'Tem certeza que deseja cancelar sua assinatura?\n\n' +
      'Você ainda terá acesso até o final do período atual.'
    );

    if (!confirmed) return;

    this.isLoading = true;
    this.showMessage('Cancelando assinatura...', 'info');

    try {
      await subscriptionService.cancelSubscription();
      this.showMessage('Assinatura cancelada com sucesso!', 'success');
      await this.loadSubscriptionStatus();
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      this.showMessage(
        error.message || 'Erro ao cancelar assinatura. Tente novamente.',
        'error'
      );
    } finally {
      this.isLoading = false;
    }
  }

  private async resumeSubscription(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showMessage('Reativando assinatura...', 'info');

    try {
      await subscriptionService.resumeSubscription();
      this.showMessage('Assinatura reativada com sucesso!', 'success');
      await this.loadSubscriptionStatus();
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      this.showMessage(
        error.message || 'Erro ao reativar assinatura. Tente novamente.',
        'error'
      );
    } finally {
      this.isLoading = false;
    }
  }

  private showMessage(message: string, type: 'info' | 'success' | 'error'): void {
    // Use existing toast/message system if available
    const event = new CustomEvent('app:toast', {
      detail: { type, text: message }
    });
    window.dispatchEvent(event);

    // Fallback to simple alert if toast not available
    setTimeout(() => {
      if (type === 'error') {
        console.error(message);
      }
    }, 100);
  }
}

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SubscriptionPage();
});

export { SubscriptionPage };
