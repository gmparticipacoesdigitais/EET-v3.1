import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export default function SubscribeSuccess() {
  const { user } = useAuth()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        const idToken = await user.getIdToken()
        const base = import.meta.env.VITE_PUBLIC_BASE_URL || ''
        const res = await fetch(`${base}/api/bootstrap`, { headers: { Authorization: `Bearer ${idToken}` } })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Falha ao validar assinatura')
        if (data.subscription?.active) {
          window.location.assign('/dashboard')
          return
        }
        setError('Assinatura ainda não confirmada. Aguarde alguns segundos e tente novamente.')
      } catch (e) {
        setError(e.message || 'Erro ao validar assinatura')
      } finally {
        setChecking(false)
      }
    }
    run()
  }, [user])

  return (
    <div className="auth-page">
      <div className="auth-container">
        <main className="auth-card" role="status" aria-label="Validando assinatura">
          {checking ? (
            <div className="caption text-soft">Validando assinatura…</div>
          ) : (
            <>
              <h1 style={{ marginTop: 0 }}>Obrigado!</h1>
              <p className="text-soft">Estamos confirmando sua assinatura. {error ? error : 'Você será redirecionado em instantes.'}</p>
              <div style={{ marginTop: 12 }}>
                <a href="/dashboard" className="btn btn-primary">Ir para o dashboard</a>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
