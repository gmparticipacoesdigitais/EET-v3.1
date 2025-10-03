import { getDb } from '../firebaseAdmin.js'

export async function requireActiveSubscription(req, res, next) {
  try {
    const uid = req.auth?.uid
    const tenantId = req.auth?.tenantId || process.env.DEFAULT_TENANT_ID || 'defaultTenant'
    if (!uid) return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Missing user' })
    const db = getDb()
    const userRef = db.collection('tenants').doc(String(tenantId)).collection('users').doc(String(uid))
    const snap = await userRef.get()
    const status = snap.exists ? (snap.data()?.subscriptionStatus || 'none') : 'none'
    const active = status === 'active' || status === 'trialing'
    if (!active) return res.status(402).json({ code: 'SUBSCRIPTION_REQUIRED', error: 'Assinatura ativa necessária' })
    return next()
  } catch (e) {
    return res.status(500).json({ code: 'SUBSCRIPTION_CHECK_FAILED', error: e.message || 'Failed to verify subscription' })
  }
}

