import { Router } from 'express'
import { getAdmin, getAuthAdmin, getDb } from '../firebaseAdmin.js'
import { verifyIdToken } from '../middleware/auth.js'

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || 'defaultTenant'

export const sessionRouter = Router()

// Ensures user profile exists and syncs claims (tenantId + default roles if missing)
sessionRouter.post('/ensure', verifyIdToken, async (req, res) => {
  try {
    const { uid, email, tenantId: tokenTenantId } = req.auth
    const tenantId = tokenTenantId || DEFAULT_TENANT
    const rolesDefault = { VIEWER: true }
    const db = getDb()

    // Create tenant container docs if not exists
    const tenantRef = db.collection('tenants').doc(tenantId)
    const usersRef = tenantRef.collection('users').doc(uid)

    const userSnap = await usersRef.get()
    const now = getAdmin().firestore.FieldValue.serverTimestamp()
    let userDoc
    if (!userSnap.exists) {
      userDoc = {
        email: email || null,
        displayName: req.body?.displayName || null,
        photoURL: req.body?.photoURL || null,
        roles: rolesDefault,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      }
      await usersRef.set(userDoc)
    } else {
      userDoc = userSnap.data() || {}
      await usersRef.update({ updatedAt: now })
    }

    // Ensure custom claims have tenantId and roles
    const auth = getAuthAdmin()
    const userRecord = await auth.getUser(uid)
    const claims = userRecord.customClaims || {}
    let updateClaims = false
    if (!claims.tenantId) { claims.tenantId = tenantId; updateClaims = true }
    if (!claims.roles) { claims.roles = userDoc.roles || rolesDefault; updateClaims = true }
    if (updateClaims) {
      await auth.setCustomUserClaims(uid, claims)
    }

    return res.json({ ok: true, tenantId: claims.tenantId, roles: claims.roles })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('session/ensure failed', e)
    return res.status(500).json({ code: 'SESSION_ENSURE_FAILED', error: e.message || 'Failed to ensure session' })
  }
})

