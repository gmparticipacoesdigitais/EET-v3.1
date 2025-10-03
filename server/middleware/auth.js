import { getAuthAdmin } from '../firebaseAdmin.js'

// Verify Firebase ID token passed via Authorization: Bearer <token>
export async function verifyIdToken(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const [, token] = header.split(' ')
    if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Missing bearer token' })
    const decoded = await getAuthAdmin().verifyIdToken(token)
    const tenantId = decoded.tenantId || decoded.tenant || decoded.tenant_id || decoded.tenant_id || decoded.tid || decoded.claims?.tenantId || decoded?.tenantId
    const roles = decoded.roles || decoded.claims?.roles || decoded['https://roles'] || null
    req.auth = {
      uid: decoded.uid,
      email: decoded.email || null,
      tenantId: tenantId || null,
      roles: roles || null,
      raw: decoded,
    }
    return next()
  } catch (e) {
    return res.status(401).json({ code: 'AUTH_INVALID', error: 'Invalid or expired token' })
  }
}

export function tenantGuard(req, res, next) {
  const t = req.auth?.tenantId
  if (!t) return res.status(403).json({ code: 'TENANT_REQUIRED', error: 'Tenant not set in claims' })
  return next()
}

export function rbac(requiredAnyRole = []) {
  return function (req, res, next) {
    const roles = req.auth?.roles || {}
    if (!roles || typeof roles !== 'object') return res.status(403).json({ code: 'RBAC_DENIED', error: 'Missing roles' })
    if (requiredAnyRole.length === 0) return next()
    const ok = requiredAnyRole.some((r) => roles[r] === true)
    if (!ok) return res.status(403).json({ code: 'RBAC_DENIED', error: 'Insufficient role' })
    return next()
  }
}

export function errorHandler(err, req, res, _next) {
  // Generic error serializer
  const status = err.status || 500
  const code = err.code || 'INTERNAL'
  const message = err.message || 'Unexpected error'
  return res.status(status).json({ code, error: message })
}

