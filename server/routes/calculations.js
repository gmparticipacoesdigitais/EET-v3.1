import { Router } from 'express'
import { z } from 'zod'
import { getAdmin, getDb } from '../firebaseAdmin.js'
import { verifyIdToken, tenantGuard, rbac } from '../middleware/auth.js'
import { requireActiveSubscription } from '../middleware/subscription.js'
import { calcProgressive, formatYYYYMM, prorata, roundCentsHalfUp, sha256Hex } from '../services/calc.js'

const inputSchema = z.object({
  employeeId: z.string().min(1),
  competencia: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  override: z.object({ aliquotas: z.any().optional(), regrasProrata: z.any().optional() }).optional(),
})

export const calculationsRouter = Router()

calculationsRouter.use(verifyIdToken, tenantGuard, requireActiveSubscription, rbac(['OWNER', 'ADMIN', 'ANALYST']))

calculationsRouter.post('/', async (req, res) => {
  try {
    const parse = inputSchema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'VALIDATION_FAILED', error: parse.error.flatten() })
    const { employeeId, competencia } = parse.data
    const tenantId = req.auth.tenantId
    const db = getDb()
    const FieldValue = getAdmin().firestore.FieldValue

    const tenantRef = db.collection('tenants').doc(tenantId)
    const employeeRef = tenantRef.collection('employees').doc(employeeId)
    const settingsRef = tenantRef.collection('settings').doc('current')

    const [employeeSnap, settingsSnap] = await Promise.all([employeeRef.get(), settingsRef.get()])
    if (!employeeSnap.exists) return res.status(404).json({ code: 'NOT_FOUND', error: 'Employee not found' })

    const employee = employeeSnap.data()
    const ano = Number(competencia.slice(0, 4))
    const settings = settingsSnap.exists ? settingsSnap.data() : {}
    const aliquotasYear = parse.data.override?.aliquotas || (settings.aliquotas?.[String(ano)] || defaultAliquotas(ano))
    const regrasProrata = parse.data.override?.regrasProrata || settings.regrasProrata || { mesComercialDias: 30, regra15Dias: true }

    const parametrosSnapshot = {
      regrasProrata,
      aliquotas: aliquotasYear,
      fuso: process.env.APP_TIMEZONE || 'America/Fortaleza',
      arredondamento: 'halfUp2',
    }

    // Idempotency key
    const calcKeySha256 = sha256Hex(`${tenantId}|${employeeId}|${competencia}|${sha256Hex(parametrosSnapshot)}`)
    const calcId = calcKeySha256.slice(0, 24)
    const calcRef = tenantRef.collection('calculations').doc(calcId)
    const existing = await calcRef.get()
    if (existing.exists) {
      return res.json({ id: existing.id, ...existing.data(), idempotent: true })
    }

    // Compute days worked in month (commercial 30 days)
    const [y, m] = competencia.split('-').map((n) => parseInt(n, 10))
    const monthStart = new Date(Date.UTC(y, m - 1, 1))
    const nextMonth = new Date(Date.UTC(y, m, 1))
    const monthEnd = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000)
    const adm = new Date(employee.admissaoISO)
    const des = employee.desligamentoISO ? new Date(employee.desligamentoISO) : null
    const start = adm > monthStart ? adm : monthStart
    const end = des && des < monthEnd ? des : monthEnd
    const daysWorked = Math.max(0, Math.min(30, Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1))

    const salaryMonthly = (employee.salarioMensalCentavos || 0) / 100
    const salarioProrata = prorata(salaryMonthly, daysWorked)

    // FGTS
    const fgtsRate = aliquotasYear.fgts ?? 0.08
    const fgtsMes = salarioProrata * fgtsRate

    // INSS (progressive)
    const inssTable = aliquotasYear.inss?.tabela || []
    const inss = calcProgressive(salarioProrata, inssTable)

    // IRPF (progressive + deductions)
    const irpfTable = aliquotasYear.irpf?.tabela || []
    let irpf = calcProgressive(Math.max(0, salarioProrata - (aliquotasYear.irpf?.deducaoPadrao || 0)), irpfTable)

    // 13º e férias proporcionais (regra dos 15 dias)
    const mesCompleto = regrasProrata.regra15Dias ? daysWorked >= 15 : (daysWorked >= 1)
    const decimoTerceiroProporcional = mesCompleto ? salaryMonthly / 12 : 0
    const feriasProporcionais = mesCompleto ? salaryMonthly / 12 : 0
    const umTercoFerias = mesCompleto ? feriasProporcionais / 3 : 0

    // Rescisão (simplificado): aviso indenizado + multa 40% FGTS
    const avisoPrevioIndenizado = 0 // não calculado neste endpoint mensal
    const multaFgts40 = fgtsMes * 0.4 // demonstrativo; normalmente sobre saldo FGTS acumulado

    // Rounding to cents (half-up)
    const results = {
      salarioProrataCentavos: roundCentsHalfUp(salarioProrata),
      fgtsMesCentavos: roundCentsHalfUp(fgtsMes),
      inssCentavos: roundCentsHalfUp(inss),
      irpfCentavos: roundCentsHalfUp(irpf),
      decimoTerceiroProporcionalCentavos: roundCentsHalfUp(decimoTerceiroProporcional),
      feriasProporcionaisCentavos: roundCentsHalfUp(feriasProporcionais),
      umTercoFeriasCentavos: roundCentsHalfUp(umTercoFerias),
      rescisao: {
        avisoPrevioIndenizadoCentavos: roundCentsHalfUp(avisoPrevioIndenizado),
        multaFgts40Centavos: roundCentsHalfUp(multaFgts40),
      },
    }

    const totais = (() => {
      const bruto = results.salarioProrataCentavos + results.decimoTerceiroProporcionalCentavos + results.feriasProporcionaisCentavos + results.umTercoFeriasCentavos
      const descontos = results.inssCentavos + results.irpfCentavos
      const liquido = Math.max(0, bruto - descontos)
      return { brutoCentavos: bruto, descontosCentavos: descontos, liquidoCentavos: liquido }
    })()

    const doc = {
      employeeId,
      competencia,
      parametrosSnapshot,
      entradas: {
        salarioMensalCentavos: employee.salarioMensalCentavos,
        admissaoISO: employee.admissaoISO,
        desligamentoISO: employee.desligamentoISO ?? null,
      },
      resultados: { ...results, totais },
      hashes: { calcKeySha256 },
      createdByUid: req.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    }

    await calcRef.set(doc)

    // Audit log
    await tenantRef.collection('auditLogs').add({
      actorUid: req.auth.uid,
      action: 'create',
      entity: 'calculation',
      entityId: calcId,
      after: doc,
      at: FieldValue.serverTimestamp(),
    })

    return res.status(201).json({ id: calcId, ...doc })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('calculations error', e)
    return res.status(500).json({ code: 'CALCULATION_FAILED', error: e.message })
  }
})

function defaultAliquotas(ano) {
  // Minimal placeholder tables; should be set via tenant settings in Firestore
  // INSS: progressive brackets example (values per month BRL)
  const inss = {
    tabela: [
      { upTo: 1412, rate: 0.075 },
      { upTo: 2666.68, rate: 0.09 },
      { upTo: 4000.03, rate: 0.12 },
      { upTo: 7786.02, rate: 0.14 },
    ],
  }
  // IRPF: example; real tables must be maintained in settings
  const irpf = {
    deducaoPadrao: 0, // depends on regime
    tabela: [
      { upTo: 2259.20, rate: 0 },
      { upTo: 2826.65, rate: 0.075 },
      { upTo: 3751.05, rate: 0.15 },
      { upTo: 4664.68, rate: 0.225 },
      { upTo: Infinity, rate: 0.275 },
    ],
  }
  return { ano, fgts: 0.08, inss, irpf }
}
