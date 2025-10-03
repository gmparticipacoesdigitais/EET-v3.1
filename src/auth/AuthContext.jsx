import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import xanoClient from '../lib/xano'
import { loginEmailSenha, registrarEmailSenha, logout as logoutSvc, getCurrentUser } from './service'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [claims] = useState({ tenantId: 'default', roles: { VIEWER: true } })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        if (!xanoClient.isAuthenticated()) {
          setLoading(false)
          return
        }

        // Verify token is still valid
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.warn('Auth check failed:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const saveProfile = async () => {
    // TODO: Implement profile saving with Xano if needed
  }

  const register = async ({ email, password, name, cpfCnpj, phone }) => {
    const u = await registrarEmailSenha(email, password, { name, cpfCnpj, phone })
    setUser({ uid: u.uid, email: u.email })
    await saveProfile(u.uid, { email, name })
    return u
  }

  const login = async (email, password) => {
    const u = await loginEmailSenha(email, password)
    setUser({ uid: u.uid, email: u.email })
    return u
  }

  const loginWithGoogle = async () => {
    throw new Error('Login com Google não está disponível')
  }

  const logout = () => {
    setUser(null)
    return logoutSvc()
  }

  const value = useMemo(
    () => ({ user, claims, loading, register, login, loginWithGoogle, logout }),
    [user, claims, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
