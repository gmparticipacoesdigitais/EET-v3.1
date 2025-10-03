import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { getAdmin, getDb } from '../firebaseAdmin.js'
import { verifyIdToken, tenantGuard, rbac } from '../middleware/auth.js'
import { requireActiveSubscription } from '../middleware/subscription.js'

const employeeSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1),
  salarioMensalCentavos: z.number().int().nonnegative(),
  admissaoISO: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'admissaoISO inválida'),
  desligamentoISO: z.string().nullable().optional().refine((v) => v == null || !Number.isNaN(Date.parse(v)), 'desligamentoISO inválida'),
  ativo: z.boolean().optional(),
})

export const employeesRouter = Router()

// All /api/employees routes require auth + tenant
employeesRouter.use(verifyIdToken, tenantGuard, requireActiveSubscription)

// GET /api/employees
employeesRouter.get('/', async (req, res) => {
  try {
    const tenantId = req.auth.tenantId
    const db = getDb()
    const qs = await db.collection('tenants').doc(tenantId).collection('employees').orderBy('nome', 'asc').get()
    const items = []
    qs.forEach((doc) => items.push({ id: doc.id, ...doc.data() }))
    return res.json({ items })
  } catch (e) {
    return res.status(500).json({ code: 'EMPLOYEES_LIST_FAILED', error: e.message })
  }
})

// POST /api/employees - create or update with dedupe
employeesRouter.post('/', rbac(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const tenantId = req.auth.tenantId
    const db = getDb()
    const parse = employeeSchema.safeParse(req.body)
    if (!parse.success) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', error: parse.error.flatten() })
    }
    const { nome, salarioMensalCentavos, admissaoISO } = parse.data
    const desligamentoISO = parse.data.desligamentoISO ?? null
    const adm = new Date(admissaoISO)
    const des = desligamentoISO ? new Date(desligamentoISO) : null
    const now = new Date()
    if (adm > now) return res.status(400).json({ code: 'VALIDATION_FAILED', error: 'Data de admissão no futuro' })
    if (des && des < adm) return res.status(400).json({ code: 'VALIDATION_FAILED', error: 'Desligamento anterior à admissão' })

    const key = `${tenantId}::${nome.trim().toLowerCase()}::${admissaoISO}::${desligamentoISO || ''}`
    const dedupeId = crypto.createHash('sha256').update(key).digest('hex').slice(0, 20)
    const tenantRef = db.collection('tenants').doc(tenantId)
    const employees = tenantRef.collection('employees')

    // dedupe by unique hash; if exists, update salary if provided
    const docRef = employees.doc(dedupeId)
    const snap = await docRef.get()
    const FieldValue = getAdmin().firestore.FieldValue
    const base = {
      nome: nome.trim(),
      salarioMensalCentavos,
      admissaoISO,
      desligamentoISO,
      ativo: !desligamentoISO,
      updatedAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    }
    if (!snap.exists) {
      await docRef.set({ ...base, createdAt: FieldValue.serverTimestamp() })
      return res.status(201).json({ id: docRef.id, ...base })
    }
    await docRef.update(base)
    return res.json({ id: docRef.id, ...base })
  } catch (e) {
    return res.status(500).json({ code: 'EMPLOYEE_CREATE_FAILED', error: e.message })
  }
})
