// Subscription Card Component

import { SubscriptionPlan } from '../services/subscription';

export interface SubscriptionCardOptions {
  plan: SubscriptionPlan;
  onSubscribe: (priceId: string) => void;
  isCurrentPlan?: boolean;
  isLoading?: boolean;
}

export class SubscriptionCard {
  private container: HTMLElement;
  private options: SubscriptionCardOptions;

  constructor(options: SubscriptionCardOptions) {
    this.options = options;
    this.container = this.createCard();
  }

  private createCard(): HTMLElement {
    const { plan, isCurrentPlan, isLoading } = this.options;

    const card = document.createElement('div');
    card.className = `subscription-card ${isCurrentPlan ? 'current-plan' : ''}`;
    card.innerHTML = `
      <div class="subscription-card-header">
        <h3 class="subscription-card-title">${plan.name}</h3>
        ${isCurrentPlan ? '<span class="badge badge-success">Plano Atual</span>' : ''}
      </div>

      <div class="subscription-card-price">
        <span class="currency">R$</span>
        <span class="amount">${plan.price.toFixed(2)}</span>
        <span class="interval">/${plan.interval === 'month' ? 'mês' : 'ano'}</span>
      </div>

      <ul class="subscription-card-features">
        ${plan.features.map(feature => `
          <li class="feature-item">
            <svg class="feature-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            <span>${feature}</span>
          </li>
        `).join('')}
      </ul>

      <button
        class="subscription-card-button ${isCurrentPlan ? 'disabled' : ''}"
        ${isCurrentPlan || isLoading ? 'disabled' : ''}
        data-price-id="${plan.stripePriceId}"
      >
        ${isCurrentPlan ? 'Plano Ativo' : isLoading ? 'Carregando...' : 'Assinar Agora'}
      </button>
    `;

    // Add event listener to button
    const button = card.querySelector('.subscription-card-button') as HTMLButtonElement;
    if (button && !isCurrentPlan && !isLoading) {
      button.addEventListener('click', () => {
        this.options.onSubscribe(plan.stripePriceId);
      });
    }

    return card;
  }

  public render(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  public setLoading(loading: boolean): void {
    const button = this.container.querySelector('.subscription-card-button') as HTMLButtonElement;
    if (button) {
      button.disabled = loading;
      button.textContent = loading ? 'Carregando...' : 'Assinar Agora';
    }
  }

  public destroy(): void {
    this.container.remove();
  }
}
