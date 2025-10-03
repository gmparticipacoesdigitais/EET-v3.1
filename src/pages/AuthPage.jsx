import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import Button from '../components/Button'
import ToastStack from '../components/Toast.jsx'
import '../styles/auth-enhanced.css'

const DEV_EMAIL = (import.meta && import.meta.env && import.meta.env.VITE_DEV_EMAIL) || 'gmparticipacoes@gmail.com'
const DEV_PASSWORD = (import.meta && import.meta.env && import.meta.env.VITE_DEV_PASSWORD) || 'gmparticipacoes1234!'

export default function AuthPage() {
  const { login, register, user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', cpfCnpj: '', phone: '' })
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const errRef = useRef(null)

  useEffect(() => {
    if (error && errRef.current) {
      try { errRef.current.focus() } catch {}
    }
  }, [error])

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        if (!form.name.trim()) throw new Error('Informe seu nome completo')
        if (form.password.length < 8) throw new Error('A senha deve ter no mínimo 8 caracteres')
        await register({ email: form.email, password: form.password, name: form.name.trim(), cpfCnpj: form.cpfCnpj, phone: form.phone })
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Não foi possível autenticar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleDevLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await login(DEV_EMAIL, DEV_PASSWORD)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Falha no login de desenvolvedor.')
    } finally {
      setLoading(false)
    }
  }

  const handleWhatsAppReset = () => {
    const txt = encodeURIComponent(`Olá! Quero recuperar minha senha no app. Meu e-mail: ${form.email || ''}`)
    window.open(`https://api.whatsapp.com/send?text=${txt}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-hero" aria-hidden="true">
          <span className="auth-hero__badge">Calculadora trabalhista</span>
          <h1>Organize encargos com confiança</h1>
          <p>Acompanhe provisões e encargos em tempo real, com estimativas precisas e colaboração segura.</p>
        </section>

        <main className="auth-card" role="main" aria-labelledby="authTitle">
          <header className="auth-card__header">
            <span className="auth-card__icon" aria-hidden="true" />
            <div>
              <h2 id="authTitle">{mode === 'login' ? 'Entrar na sua conta' : 'Criar uma nova conta'}</h2>
              <p className="auth-card__subtitle">Use suas credenciais corporativas para acessar seus cálculos.</p>
            </div>
          </header>

          {error && (
            <div ref={errRef} role="alert" className="auth-alert auth-alert--danger" tabIndex={-1}>
              {error}
            </div>
          )}

          <div className="auth-tabs" role="tablist" aria-label="Selecione o modo de acesso">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab ${mode === 'login' ? 'is-active' : ''}`}
              onClick={() => setMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-tab ${mode === 'signup' ? 'is-active' : ''}`}
              onClick={() => setMode('signup')}
            >
              Criar conta
            </button>
            <button type="button" className="auth-tab auth-tab--ghost" onClick={handleDevLogin}>
              Entrar Dev
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'signup' && (
              <fieldset className="auth-form__group" aria-label="Dados pessoais">
                <Input
                  label="Nome completo"
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="Digite como consta nos documentos"
                  autoComplete="name"
                  required
                />
                <Input
                  label="CPF ou CNPJ"
                  name="cpfCnpj"
                  value={form.cpfCnpj}
                  onChange={onChange}
                  placeholder="Somente números"
                  autoComplete="off"
                />
                <Input
                  label="Telefone"
                  name="phone"
                  value={form.phone}
                  onChange={onChange}
                  placeholder="DDD + número"
                  autoComplete="tel"
                />
              </fieldset>
            )}

            <fieldset className="auth-form__group" aria-label="Credenciais de acesso">
              <Input
                label="E-mail corporativo"
                name="email"
                value={form.email}
                onChange={onChange}
                type="email"
                placeholder="nome@empresa.com"
                autoComplete="email"
                required
              />
              <Input
                label="Senha"
                name="password"
                value={form.password}
                onChange={onChange}
                type="password"
                placeholder="No mínimo 8 caracteres"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Manter sessão ativa neste dispositivo</span>
              </label>
            </fieldset>

            <div className="auth-actions">
              <Button type="submit" variant="primary" disabled={loading} aria-live="polite">
                {loading ? 'Aguarde...' : 'Continuar'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleWhatsAppReset}>
                Recuperar via WhatsApp
              </Button>
            </div>
          </form>

          <div className="auth-divider" role="separator" aria-label="ou" />

          <div className="auth-alt">
            <Button type="button" variant="secondary" className="btn-google" onClick={() => setError('Login com Google ainda não está disponível.')}>Entrar com Google</Button>
            <button type="button" className="auth-link" onClick={() => setError('Link mágico por e-mail disponível em breve.')}>Usar link mágico por e-mail</button>
          </div>

          <footer className="auth-footer">
            <div className="auth-footer__links">
              <button type="button" className="auth-link" onClick={() => setError('Função em desenvolvimento.')}>Esqueci minha senha</button>
              <span aria-hidden="true">·</span>
              <a href="#" className="auth-link">Política de privacidade</a>
              <span aria-hidden="true">·</span>
              <a href="#" className="auth-link">Termos de uso</a>
            </div>
          </footer>
        </main>
      </div>
      <ToastStack />
    </div>
  )
}

