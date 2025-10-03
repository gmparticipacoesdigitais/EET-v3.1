import { Router } from 'express'
import { z } from 'zod'
import { getAuthAdmin, getDb } from '../firebaseAdmin.js'
import { verifyIdToken, tenantGuard, rbac } from '../middleware/auth.js'
import { requireActiveSubscription } from '../middleware/subscription.js'

const rolesSchema = z.object({
  uid: z.string().min(1),
  roles: z.object({ OWNER: z.boolean().optional(), ADMIN: z.boolean().optional(), ANALYST: z.boolean().optional(), VIEWER: z.boolean().optional() })
})

export const adminRouter = Router()

adminRouter.use(verifyIdToken, tenantGuard, requireActiveSubscription, rbac(['OWNER']))

// Promote/demote roles for a user in the same tenant
adminRouter.post('/roles', async (req, res) => {
  try {
    const parse = rolesSchema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'VALIDATION_FAILED', error: parse.error.flatten() })
    const { uid, roles } = parse.data
    const tenantId = req.auth.tenantId
    const auth = getAuthAdmin()
    const user = await auth.getUser(uid)
    const claims = { ...(user.customClaims || {}), roles: { VIEWER: true, ...roles }, tenantId }
    await auth.setCustomUserClaims(uid, claims)

    // Update profile doc roles as well
    const db = getDb()
    await db.collection('tenants').doc(tenantId).collection('users').doc(uid).set({ roles: claims.roles }, { merge: true })
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ code: 'ADMIN_ROLES_FAILED', error: e.message })
  }
})
