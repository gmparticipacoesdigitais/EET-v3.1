import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, signInWithCredential, GoogleAuthProvider } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { googleSignInWithIdToken } from '../lib/google'

type KnownCode =
  | 'auth/operation-not-allowed'
  | 'auth/popup-blocked'
  | 'auth/popup-closed-by-user'
  | 'auth/invalid-email'
  | 'auth/wrong-password'
  | 'auth/user-not-found'
  | 'auth/too-many-requests'
  | 'auth/network-request-failed'
  | 'auth/internal-error'

function mapFirebaseError(code?: string, fallback?: string) {
  const c = code || ''
  const msgs: Record<string, string> = {
    'auth/operation-not-allowed':
      'Provedor desabilitado. Ative Email/Senha e/ou Google no Firebase Console > Authentication > Método de login.',
    'auth/popup-blocked':
      'Popup bloqueado pelo navegador. Permita pop-ups para este site nas configurações do navegador e tente novamente.',
    'auth/popup-closed-by-user':
      'Popup fechado antes da conclusão. Permita pop-ups e conclua o fluxo de login.',
    'auth/invalid-email': 'E-mail inválido. Verifique o endereço informado.',
    'auth/wrong-password': 'Senha incorreta. Verifique suas credenciais.',
    'auth/user-not-found': 'Usuário não encontrado. Verifique o e-mail ou crie uma conta.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed': 'Falha de rede. Verifique sua conexão com a internet.',
    'auth/internal-error': 'Erro interno. Tente novamente em instantes.',
  }
  return msgs[c] || fallback || 'Falha na autenticação. Tente novamente.'
}

function enrichAndThrow(err: any, defaultMsg?: string) {
  const friendly = mapFirebaseError(err?.code, defaultMsg || err?.message)
  // eslint-disable-next-line no-console
  console.debug('[auth]', { code: err?.code, message: err?.message })
  const e = new Error(friendly) as Error & { code?: string }
  if (err?.code) e.code = err.code
  throw e
}

export async function loginEmailSenha(email: string, senha: string) {
  try {
    try {
      await setPersistence(auth, browserLocalPersistence)
    } catch {
      await setPersistence(auth, browserSessionPersistence)
    }
    const res = await signInWithEmailAndPassword(auth, email, senha)
    return res.user
  } catch (err) {
    enrichAndThrow(err, 'Não foi possível entrar com e-mail/senha.')
  }
}

export async function loginGooglePopup() {
  try {
    try {
      await setPersistence(auth, browserLocalPersistence)
    } catch {
      await setPersistence(auth, browserSessionPersistence)
    }
    const res = await signInWithPopup(auth, googleProvider)
    return res.user
  } catch (err) {
    enrichAndThrow(err, 'Não foi possível entrar com o Google.')
  }
}

export async function loginGoogleOneTap(clientId?: string) {
  if (!clientId) throw new Error('Cliente One Tap não configurado')
  try {
    try {
      await setPersistence(auth, browserLocalPersistence)
    } catch {
      await setPersistence(auth, browserSessionPersistence)
    }
    const res = await googleSignInWithIdToken(clientId)
    const cred = GoogleAuthProvider.credential(res.idToken)
    const userCred = await signInWithCredential(auth, cred)
    return userCred.user
  } catch (err) {
    enrichAndThrow(err as any, 'Não foi possível autenticar com One Tap')
  }
}

export async function registrarEmailSenha(email: string, senha: string) {
  try {
    try {
      await setPersistence(auth, browserLocalPersistence)
    } catch {
      await setPersistence(auth, browserSessionPersistence)
    }
    const res = await createUserWithEmailAndPassword(auth, email, senha)
    return res.user
  } catch (err) {
    enrichAndThrow(err, 'Não foi possível criar a sua conta.')
  }
}

export async function logout() {
  try {
    await signOut(auth)
  } catch (err) {
    enrichAndThrow(err, 'Não foi possível encerrar a sessão.')
  }
}
