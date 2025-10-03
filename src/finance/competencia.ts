import { round, sumRounded, RoundingMode } from '../utils/money'

const DAY_MS = 24 * 60 * 60 * 1000

export type BaseDias = 'calendario' | 'comercial30'
export type FeriasMetodologia = 'mensal' | 'diaria'

export interface AliquotasEncargos {
  inssPatronal: number
  rat: number
  terceiros: number
  fgts: number
}

export interface RoundingConfig {
  casas: number
  modo: RoundingMode
}

export interface CompetenciaParams {
  aliquotas: AliquotasEncargos
  provisionarMesParcial?: boolean
  feriasMetodologia?: FeriasMetodologia
  baseDias?: BaseDias
  inclusiveEnd?: boolean
  arredondamento?: RoundingConfig
  moeda?: string
}

export interface EncargosResultado {
  inss: number
  fgts: number
  terceiros: number
  rat: number
  total: number
}

export interface ProvisoesResultado {
  decimoTerceiro: number
  ferias: number
  tercoFerias: number
  fgtsProvisoes: number
  total: number
  fatorProporcional: number
}

export interface MesResultado {
  ano: number
  mes: number
  competenciaId: string
  label: string
  diasNoMes: number
  diasTrabalhados: number
  salarioCompetencia: number
  encargos: EncargosResultado
  provisoes: ProvisoesResultado
  totalMes: number
  baseFator: number
  provisionado: boolean
}

export interface PeriodoResultado {
  meses: MesResultado[]
  totais: {
    salario: number
    encargos: number
    provisoes: number
    periodo: number
  }
}

export const DEFAULT_COMPETENCIA_PARAMS: CompetenciaParams = {
  aliquotas: { inssPatronal: 0.2, rat: 0.02, terceiros: 0.058, fgts: 0.08 },
  provisionarMesParcial: true,
  feriasMetodologia: 'mensal',
  baseDias: 'calendario',
  inclusiveEnd: true,
  moeda: 'BRL',
  arredondamento: { casas: 2, modo: 'half-even' },
}

export function diasNoMes(ano: number, mes: number, base: BaseDias = 'calendario'): number {
  if (base === 'comercial30') return 30
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

export function toUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function intersecaoDias(
  inicioUTC: Date,
  fimExclusiveUTC: Date,
  ano: number,
  mes: number,
): number {
  const mesInicio = new Date(Date.UTC(ano, mes - 1, 1))
  const mesFimExclusive = new Date(Date.UTC(ano, mes, 1))
  const inicio = inicioUTC > mesInicio ? inicioUTC : mesInicio
  const fim = fimExclusiveUTC < mesFimExclusive ? fimExclusiveUTC : mesFimExclusive
  if (fim <= inicio) return 0
  return Math.round((fim.getTime() - inicio.getTime()) / DAY_MS)
}

function obterRounding(params?: CompetenciaParams): RoundingConfig {
  return params?.arredondamento ?? DEFAULT_COMPETENCIA_PARAMS.arredondamento!
}

function fatorMesParcial(
  diasTrabalhados: number,
  diasBase: number,
  provisionarParcial: boolean,
): { fatorSalario: number; fatorProvisoes: number; provisionado: boolean } {
  const full = diasTrabalhados >= diasBase
  const fator = full ? 1 : diasBase === 0 ? 0 : diasTrabalhados / diasBase
  if (full) return { fatorSalario: 1, fatorProvisoes: 1, provisionado: true }
  if (!provisionarParcial) return { fatorSalario: Math.min(1, fator), fatorProvisoes: 0, provisionado: false }
  return { fatorSalario: Math.min(1, fator), fatorProvisoes: fator, provisionado: true }
}

export function calcularSalarioCompetencia(
  salarioBase: number,
  fator: number,
  arredondamento: RoundingConfig,
): number {
  return round(salarioBase * fator, arredondamento.casas, arredondamento.modo)
}

export function calcularEncargos(
  salarioCompetencia: number,
  aliquotas: AliquotasEncargos,
  arredondamento: RoundingConfig,
): EncargosResultado {
  const { casas, modo } = arredondamento
  const inss = round(salarioCompetencia * aliquotas.inssPatronal, casas, modo)
  const fgts = round(salarioCompetencia * aliquotas.fgts, casas, modo)
  const terceiros = round(salarioCompetencia * aliquotas.terceiros, casas, modo)
  const rat = round(salarioCompetencia * aliquotas.rat, casas, modo)
  const total = sumRounded([inss, fgts, terceiros, rat], casas, modo)
  return { inss, fgts, terceiros, rat, total }
}

export function calcularProvisoes(
  salarioBase: number,
  fatorProvisoes: number,
  aliquotaFgts: number,
  arredondamento: RoundingConfig,
  feriasMetodologia: FeriasMetodologia = 'mensal',
  diasTrabalhados?: number,
  diasBase?: number,
): ProvisoesResultado {
  const { casas, modo } = arredondamento
  let baseProporcional = fatorProvisoes
  if (feriasMetodologia === 'diaria' && diasTrabalhados != null && diasBase && diasBase > 0) {
    baseProporcional = diasTrabalhados / diasBase
  }
  const parcelaMensal = salarioBase / 12
  const decimo = round(parcelaMensal * baseProporcional, casas, modo)
  const ferias = round(parcelaMensal * baseProporcional, casas, modo)
  const terco = round(ferias / 3, casas, modo)
  const fgtsProvisoes = round((decimo + ferias + terco) * aliquotaFgts, casas, modo)
  const total = sumRounded([decimo, ferias, terco, fgtsProvisoes], casas, modo)
  return { decimoTerceiro: decimo, ferias, tercoFerias: terco, fgtsProvisoes, total, fatorProporcional: baseProporcional }
}

export function calcularMes(
  inicio: Date,
  fimExclusive: Date,
  ano: number,
  mes: number,
  salarioBase: number,
  params: CompetenciaParams = DEFAULT_COMPETENCIA_PARAMS,
): MesResultado | null {
  const rounding = obterRounding(params)
  const baseDias = params.baseDias ?? DEFAULT_COMPETENCIA_PARAMS.baseDias!
  const diasBase = diasNoMes(ano, mes, baseDias)
  const diasTrabalhados = intersecaoDias(inicio, fimExclusive, ano, mes)
  if (diasTrabalhados <= 0) return null

  const provisionar = params.provisionarMesParcial ?? DEFAULT_COMPETENCIA_PARAMS.provisionarMesParcial!
  const feriasMet = params.feriasMetodologia ?? DEFAULT_COMPETENCIA_PARAMS.feriasMetodologia!

  const fatores = fatorMesParcial(diasTrabalhados, diasBase, provisionar)
  const salarioCompetencia = calcularSalarioCompetencia(salarioBase, fatores.fatorSalario, rounding)
  const encargos = calcularEncargos(salarioCompetencia, params.aliquotas, rounding)
  const provisoes = fatores.fatorProvisoes > 0
    ? calcularProvisoes(salarioBase, fatores.fatorProvisoes, params.aliquotas.fgts, rounding, feriasMet, diasTrabalhados, diasBase)
    : { decimoTerceiro: 0, ferias: 0, tercoFerias: 0, fgtsProvisoes: 0, total: 0, fatorProporcional: fatores.fatorProvisoes }

  const totalMes = round(encargos.total + provisoes.total, rounding.casas, rounding.modo)
  const competenciaId = `${ano}-${String(mes).padStart(2, '0')}`
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(ano, mes - 1, 1)),
  )

  return {
    ano,
    mes,
    competenciaId,
    label,
    diasNoMes: diasBase,
    diasTrabalhados,
    salarioCompetencia,
    encargos,
    provisoes,
    totalMes,
    baseFator: fatores.fatorSalario,
    provisionado: fatores.provisionado,
  }
}

export function calcularPeriodo(
  entrada: Date,
  saida?: Date,
  salarioBase?: number,
  params: CompetenciaParams = DEFAULT_COMPETENCIA_PARAMS,
): PeriodoResultado {
  const rounding = obterRounding(params)
  const salario = salarioBase ?? 0
  const inicioUTC = toUTC(entrada)
  const inclusive = params.inclusiveEnd ?? DEFAULT_COMPETENCIA_PARAMS.inclusiveEnd!
  const fimReferencia = saida ? toUTC(saida) : toUTC(new Date())
  const fimExclusiveUTC = inclusive ? addDays(fimReferencia, 1) : fimReferencia

  const meses: MesResultado[] = []
  let cursor = new Date(Date.UTC(inicioUTC.getUTCFullYear(), inicioUTC.getUTCMonth(), 1))

  while (cursor < fimExclusiveUTC) {
    const ano = cursor.getUTCFullYear()
    const mes = cursor.getUTCMonth() + 1
    const resultadoMes = calcularMes(inicioUTC, fimExclusiveUTC, ano, mes, salario, params)
    if (resultadoMes) meses.push(resultadoMes)
    cursor = new Date(Date.UTC(ano, mes, 1))
  }

  const totalSalario = sumRounded(meses.map((m) => m.salarioCompetencia), rounding.casas, rounding.modo)
  const totalEncargos = sumRounded(meses.map((m) => m.encargos.total), rounding.casas, rounding.modo)
  const totalProvisoes = sumRounded(meses.map((m) => m.provisoes.total), rounding.casas, rounding.modo)
  const totalPeriodo = round(totalEncargos + totalProvisoes, rounding.casas, rounding.modo)

  return {
    meses,
    totais: { salario: totalSalario, encargos: totalEncargos, provisoes: totalProvisoes, periodo: totalPeriodo },
  }
}
