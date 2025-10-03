import { Router } from 'express'
import { getDb } from '../firebaseAdmin.js'
import { verifyIdToken } from '../middleware/auth.js'

// Helpers shared by routes
export function createBillingHelpers({ stripe }) {
  if (!stripe) throw new Error('Stripe client is required')
  const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || 'defaultTenant'

  const getOrCreateStripeCustomerId = async ({ uid, tenantId, email }) => {
    const db = getDb()
    const tId = tenantId || DEFAULT_TENANT
    const userRef = db.collection('tenants').doc(tId).collection('users').doc(uid)
    const snap = await userRef.get()
    let customerId = snap.exists ? (snap.data()?.stripeCustomerId || null) : null
    if (customerId) return customerId
    const customer = await stripe.customers.create({ email: email || undefined, metadata: { uid, tenantId } })
    customerId = customer.id
    await userRef.set({ stripeCustomerId: customerId }, { merge: true })
    // reverse mapping for webhooks
    await db.collection('stripeCustomers').doc(customerId).set({ uid, tenantId: tId, email: email || null }, { merge: true })
    return customerId
  }

  const getSubscriptionStatus = async ({ customerId }) => {
    // Prefer to match by price; fallback to product
    const targetPrice = process.env.STRIPE_PRICE_ID || null
    const targetProduct = process.env.STRIPE_PRODUCT_ID || null
    // List all subscriptions for this customer
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', expand: ['data.items'] })
    let active = false
    let status = 'none'
    for (const s of subs.data) {
      // Check any item matches configured price or product
      const items = s.items?.data || []
      const matches = items.some((it) => {
        const price = it.price
        if (!price) return false
        if (targetPrice && price.id === targetPrice) return true
        if (targetProduct && (price.product === targetProduct || price.product?.id === targetProduct)) return true
        return false
      })
      if (!matches) continue
      status = s.status
      if (status === 'active' || status === 'trialing') { active = true; break }
    }
    return { active, status }
  }

  return { getOrCreateStripeCustomerId, getSubscriptionStatus }
}

export function createBillingRouter({ stripe, appUrl }) {
  const router = Router()
  const { getOrCreateStripeCustomerId, getSubscriptionStatus } = createBillingHelpers({ stripe })

  // All routes gated by Firebase auth
  router.use(verifyIdToken)

  // POST /api/stripe/checkout -> create Checkout Session (subscription)
  router.post('/stripe/checkout', async (req, res) => {
    try {
      if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })
      const { uid, email, tenantId } = req.auth
      const stripeCustomerId = await getOrCreateStripeCustomerId({ uid, tenantId, email })

      // If already active, short-circuit
      const sub = await getSubscriptionStatus({ customerId: stripeCustomerId })
      if (sub.active) return res.status(400).json({ error: 'Subscription already active' })

      const price = process.env.STRIPE_PRICE_ID
      if (!price) return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' })
      const successBase = process.env.APP_URL || process.env.PUBLIC_BASE_URL || appUrl || ''
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price, quantity: 1 }],
        success_url: `${successBase}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${successBase}/subscribe/cancel`,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      })
      return res.json({ url: session.url })
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to create checkout session' })
    }
  })

  // POST /api/stripe/portal -> create Billing Portal session (optional)
  router.post('/stripe/portal', async (req, res) => {
    try {
      if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })
      const { uid, email, tenantId } = req.auth
      const stripeCustomerId = await getOrCreateStripeCustomerId({ uid, tenantId, email })
      const returnUrl = process.env.APP_URL || process.env.PUBLIC_BASE_URL || appUrl || '/'
      const sess = await stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: `${returnUrl}/dashboard` })
      return res.json({ url: sess.url })
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to create portal session' })
    }
  })

  // GET /api/bootstrap -> returns auth + subscription status
  router.get('/bootstrap', async (req, res) => {
    try {
      const { uid, email, tenantId } = req.auth
      const stripeCustomerId = await getOrCreateStripeCustomerId({ uid, tenantId, email })
      const subscription = await getSubscriptionStatus({ customerId: stripeCustomerId })
      return res.json({
        auth: { uid, email },
        subscription,
      })
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Bootstrap failed' })
    }
  })

  return router
}
