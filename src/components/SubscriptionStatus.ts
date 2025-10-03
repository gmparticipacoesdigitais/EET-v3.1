// Subscription Status Component

import { XanoSubscription } from '../lib/xano';

export interface SubscriptionStatusOptions {
  subscription: XanoSubscription | null;
  onManage?: () => void;
  onCancel?: () => void;
  onResume?: () => void;
}

export class SubscriptionStatus {
  private container: HTMLElement;
  private options: SubscriptionStatusOptions;

  constructor(options: SubscriptionStatusOptions) {
    this.options = options;
    this.container = this.createStatus();
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  private getStatusBadge(status: string): string {
    const statusMap: Record<string, { label: string; class: string }> = {
      active: { label: 'Ativa', class: 'badge-success' },
      canceled: { label: 'Cancelada', class: 'badge-danger' },
      past_due: { label: 'Vencida', class: 'badge-warning' },
      trialing: { label: 'Teste', class: 'badge-info' },
      incomplete: { label: 'Incompleta', class: 'badge-secondary' }
    };

    const statusInfo = statusMap[status] || { label: status, class: 'badge-secondary' };
    return `<span class="badge ${statusInfo.class}">${statusInfo.label}</span>`;
  }

  private createStatus(): HTMLElement {
    const { subscription } = this.options;

    const container = document.createElement('div');
    container.className = 'subscription-status';

    if (!subscription) {
      container.innerHTML = `
        <div class="subscription-status-empty">
          <svg class="status-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>Nenhuma assinatura ativa</h3>
          <p>Assine um plano para ter acesso a todos os recursos</p>
        </div>
      `;
      return container;
    }

    const willCancel = subscription.cancel_at_period_end;
    const periodEnd = this.formatDate(subscription.current_period_end);

    container.innerHTML = `
      <div class="subscription-status-card">
        <div class="subscription-status-header">
          <h3>Assinatura</h3>
          ${this.getStatusBadge(subscription.status)}
        </div>

        <div class="subscription-status-body">
          <div class="subscription-info">
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span class="info-value">${subscription.status === 'active' ? 'Ativa' : subscription.status}</span>
            </div>

            <div class="info-item">
              <span class="info-label">${willCancel ? 'Cancela em:' : 'Próxima cobrança:'}</span>
              <span class="info-value">${periodEnd}</span>
            </div>

            ${willCancel ? `
              <div class="info-item warning">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <span>Sua assinatura será cancelada ao final do período</span>
              </div>
            ` : ''}
          </div>

          <div class="subscription-actions">
            ${this.options.onManage ? `
              <button class="btn btn-primary" data-action="manage">
                Gerenciar Assinatura
              </button>
            ` : ''}

            ${subscription.status === 'active' && !willCancel && this.options.onCancel ? `
              <button class="btn btn-danger" data-action="cancel">
                Cancelar Assinatura
              </button>
            ` : ''}

            ${willCancel && this.options.onResume ? `
              <button class="btn btn-success" data-action="resume">
                Reativar Assinatura
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    this.attachEventListeners(container);

    return container;
  }

  private attachEventListeners(container: HTMLElement): void {
    const manageBtn = container.querySelector('[data-action="manage"]');
    const cancelBtn = container.querySelector('[data-action="cancel"]');
    const resumeBtn = container.querySelector('[data-action="resume"]');

    if (manageBtn && this.options.onManage) {
      manageBtn.addEventListener('click', () => this.options.onManage!());
    }

    if (cancelBtn && this.options.onCancel) {
      cancelBtn.addEventListener('click', () => this.options.onCancel!());
    }

    if (resumeBtn && this.options.onResume) {
      resumeBtn.addEventListener('click', () => this.options.onResume!());
    }
  }

  public render(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  public update(subscription: XanoSubscription | null): void {
    this.options.subscription = subscription;
    const newContainer = this.createStatus();
    this.container.replaceWith(newContainer);
    this.container = newContainer;
  }

  public destroy(): void {
    this.container.remove();
  }
}
