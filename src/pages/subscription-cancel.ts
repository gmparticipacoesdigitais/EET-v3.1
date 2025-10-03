// Subscription Cancel Page

import { mountAuthGate } from '../auth/gate';

class SubscriptionCancelPage {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    mountAuthGate((uid) => {
      this.render();
    });
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div class="cancel-page">
        <div class="cancel-container">
          <div class="cancel-icon">
            <svg width="80" height="80" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
          </div>

          <h1>Assinatura Cancelada</h1>
          <p class="cancel-message">
            Você cancelou o processo de assinatura.
            Não se preocupe, você pode tentar novamente quando quiser!
          </p>

          <div class="cancel-info">
            <h3>Por que assinar?</h3>
            <ul>
              <li>✓ Acesso ilimitado a todas funcionalidades</li>
              <li>✓ Suporte prioritário</li>
              <li>✓ Relatórios avançados</li>
              <li>✓ Integração com APIs</li>
              <li>✓ Backup automático</li>
            </ul>
          </div>

          <div class="cancel-actions">
            <a href="/subscription" class="btn btn-primary">Ver Planos</a>
            <a href="/" class="btn btn-secondary">Voltar ao Dashboard</a>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SubscriptionCancelPage();
});

export { SubscriptionCancelPage };
