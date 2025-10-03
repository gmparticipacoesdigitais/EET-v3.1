// Subscription Success Page

import { mountAuthGate } from '../auth/gate';
import xanoClient from '../lib/xano';

class SubscriptionSuccessPage {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    mountAuthGate(async (uid) => {
      await this.handleSuccess();
    });
  }

  private async handleSuccess(): Promise<void> {
    const app = document.getElementById('app');
    if (!app) return;

    // Get session_id from URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    app.innerHTML = `
      <div class="success-page">
        <div class="success-container">
          <div class="success-icon">
            <svg width="80" height="80" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
          </div>

          <h1>Assinatura Confirmada!</h1>
          <p class="success-message">
            Parabéns! Sua assinatura foi ativada com sucesso.
            Agora você tem acesso a todos os recursos premium.
          </p>

          <div id="processing-status" class="processing-status">
            <div class="spinner"></div>
            <p>Processando sua assinatura...</p>
          </div>

          <div class="success-actions" style="display: none;">
            <a href="/" class="btn btn-primary">Ir para o Dashboard</a>
            <a href="/subscription" class="btn btn-secondary">Ver Assinatura</a>
          </div>
        </div>
      </div>
    `;

    if (sessionId) {
      await this.confirmSubscription(sessionId);
    } else {
      this.showComplete();
    }
  }

  private async confirmSubscription(sessionId: string): Promise<void> {
    try {
      await xanoClient.confirmSubscription(sessionId);
      this.showComplete();
    } catch (error: any) {
      console.error('Error confirming subscription:', error);
      this.showError(error.message || 'Erro ao confirmar assinatura');
    }
  }

  private showComplete(): void {
    const processing = document.getElementById('processing-status');
    const actions = document.querySelector('.success-actions') as HTMLElement;

    if (processing) processing.style.display = 'none';
    if (actions) actions.style.display = 'flex';
  }

  private showError(message: string): void {
    const processing = document.getElementById('processing-status');
    if (processing) {
      processing.innerHTML = `
        <div class="error-icon">
          <svg width="40" height="40" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
        </div>
        <p class="error-text">${message}</p>
        <button onclick="window.location.href='/subscription'" class="btn btn-primary">
          Voltar para Assinaturas
        </button>
      `;
    }
  }
}

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SubscriptionSuccessPage();
});

export { SubscriptionSuccessPage };
