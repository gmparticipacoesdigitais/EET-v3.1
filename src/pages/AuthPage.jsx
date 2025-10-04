import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import Button from '../components/Button'
import ToastStack from '../components/Toast.jsx'
import '../styles/auth-enhanced.css'

export default function AuthPage() {
  const { login, register, user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' })
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
        if (!form.phone.trim()) throw new Error('Informe seu telefone')
        if (form.password.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres')
        await register({ email: form.email, password: form.password, name: form.name.trim(), phone: form.phone })
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Não foi possível autenticar. Tente novamente.')
    } finally {
      setLoading(false)
    }
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
            <div>
              <h2 id="authTitle">{mode === 'login' ? 'Entrar na sua conta' : 'Criar uma nova conta'}</h2>
              <p className="auth-card__subtitle">Use suas credenciais para acessar seus cálculos.</p>
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
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'signup' && (
              <fieldset className="auth-form__group" aria-label="Dados pessoais">
                <Input
                  label="Nome completo"
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="Digite seu nome completo"
                  autoComplete="name"
                  required
                />
                <Input
                  label="Telefone"
                  name="phone"
                  value={form.phone}
                  onChange={onChange}
                  placeholder="DDD + número"
                  autoComplete="tel"
                  required
                />
              </fieldset>
            )}

            <fieldset className="auth-form__group" aria-label="Credenciais de acesso">
              <Input
                label="E-mail"
                name="email"
                value={form.email}
                onChange={onChange}
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
              <Input
                label="Senha"
                name="password"
                value={form.password}
                onChange={onChange}
                type="password"
                placeholder="No mínimo 6 caracteres"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </fieldset>

            <div className="auth-actions">
              <Button type="submit" variant="primary" disabled={loading} aria-live="polite">
                {loading ? 'Aguarde...' : (mode === 'login' ? 'Entrar' : 'Criar conta')}
              </Button>
            </div>
          </form>
        </main>
      </div>
      <ToastStack />
    </div>
  )
}

