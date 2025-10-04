import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from './AuthPage';
import { vi } from 'vitest';

// Mock the AuthContext to provide a default value for testing
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    isDeveloper: false,
    isSubscriber: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
    loginAsDeveloper: vi.fn(),
  }),
}));

describe('AuthPage', () => {
  it('renders the login form by default', () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    // Check if the "Entrar na sua conta" heading is present
    expect(screen.getByRole('heading', { name: /Entrar na sua conta/i })).toBeInTheDocument();
  });

  it('switches to the signup form when the "Criar conta" tab is clicked', () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    // Click the "Criar conta" tab
    fireEvent.click(screen.getByRole('tab', { name: /Criar conta/i }));

    // Check if the heading changes to "Criar uma nova conta"
    expect(screen.getByRole('heading', { name: /Criar uma nova conta/i })).toBeInTheDocument();

    // Check if the "Nome completo" and "Telefone" fields are present
    expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefone/i)).toBeInTheDocument();
  });
});