// src/finance/calculadora-simplificada.ts
import {
  CompetenciaParams,
  calcularPeriodo,
  DEFAULT_COMPETENCIA_PARAMS,
  AliquotasEncargos
} from './competencia'
import { calcularRescisao } from './rescisao'

// Tipos para interface simplificada
export interface DadosFuncionario {
  nome?: string
  cargo?: string
  salarioBase: number
  dataEntrada: Date
  dataFinal: Date
  setor?: 'comercio' | 'industria' | 'servicos' | 'construcao' | 'rural' | string
  tipoRescisao?: 'demissaoSemJusta' | 'demissaoComJusta' | 'pedidoDemissao' | 'acordoTrabalhista' | 'termino' | 'aposentadoria'
}

export interface ResultadoCalculoCompleto {
  funcionario: {
    nome?: string
    cargo?: string
    salarioBase: number
    dataEntrada: string
    dataFinal: string
    diasTrabalhados: number
    mesesCompletos: number
    setor?: string
  }

  // Detalhamento mensal
  detalhamentoMensal: {
    competencia: string
    diasTrabalhados: number
    salario: number
    encargos: {
      inssPatronal: number
      fgts: number
      rat: number
      terceiros: number
      total: number
    }
    provisoes: {
      decimoTerceiro: number
      ferias: number
      tercoFerias: number
      fgtsProvisoes: number
      total: number
    }
    custoTotal: number
  }[]

  // Resumo de encargos no período
  encargosAcumulados: {
    inssPatronal: number
    fgts: number
    rat: number
    terceiros: number
    total: number
  }

  // Provisões acumuladas
  provisoesAcumuladas: {
    decimoTerceiro: number
    ferias: number
    tercoFerias: number
    fgtsProvisoes: number
    total: number
  }

  // Verbas rescisórias
  verbasRescisorias: {
    decimoTerceiroProporcional: number
    feriasProporcionais: number
    tercoFerias: number
    fgtsSobreVerbas: number
    saldoFGTS: number
    multa40FGTS?: number
    avisoPrevio?: number
    totalRescisao: number
    mesesConsiderados13: number
    mesesConsideradosFerias: number
  }

  // Totalizadores
  totais: {
    salariosPagos: number
    encargosObrigatorios: number
    provisoesConstituidas: number
    custoRescisorio: number
    custoTotalEstimado: number
    custoMedioMensal: number
    percentualEncargos: number
  }

  avisos: string[]
}

// Alíquotas por setor (RAT variável)
export const ALIQUOTAS_POR_SETOR: Record<string, AliquotasEncargos> = {
  comercio: {
    inssPatronal: 0.20,    // 20% INSS Patronal
    rat: 0.01,              // 1% RAT (risco baixo)
    terceiros: 0.058,       // 5.8% (SESI, SENAI, etc)
    fgts: 0.08              // 8% FGTS
  },
  servicos: {
    inssPatronal: 0.20,
    rat: 0.02,              // 2% RAT (risco médio)
    terceiros: 0.058,
    fgts: 0.08
  },
  industria: {
    inssPatronal: 0.20,
    rat: 0.02,              // 2% RAT (risco médio)
    terceiros: 0.058,
    fgts: 0.08
  },
  construcao: {
    inssPatronal: 0.20,
    rat: 0.03,              // 3% RAT (risco alto)
    terceiros: 0.058,
    fgts: 0.08
  },
  rural: {
    inssPatronal: 0.20,
    rat: 0.025,             // 2.5% RAT médio rural
    terceiros: 0.025,       // 2.5% (SENAR)
    fgts: 0.08
  }
}

// Função auxiliar para calcular dias trabalhados
function calcularDiasTrabalhados(entrada: Date, saida: Date): number {
  const diffTime = Math.abs(saida.getTime() - entrada.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 pois inclui o último dia
}

// Função auxiliar para contar meses completos
function contarMesesCompletos(entrada: Date, saida: Date): number {
  let meses = 0
  const current = new Date(entrada)

  while (current <= saida) {
    const mesInicio = new Date(current.getFullYear(), current.getMonth(), 1)
    const mesFim = new Date(current.getFullYear(), current.getMonth() + 1, 0)

    // Verifica se trabalhou o mês inteiro
    if (entrada <= mesInicio && saida >= mesFim) {
      meses++
    }

    current.setMonth(current.getMonth() + 1)
  }

  return meses
}

// Função auxiliar para calcular aviso prévio
function calcularAvisoPrevio(salarioBase: number, diasTrabalhados: number): number {
  // Aviso prévio: 30 dias + 3 dias por ano trabalhado (máximo 90 dias)
  const anosTrabalhados = Math.floor(diasTrabalhados / 365)
  const diasAviso = Math.min(30 + (anosTrabalhados * 3), 90)

  // Arredonda para cima (conservador)
  return Math.ceil((salarioBase / 30) * diasAviso * 100) / 100
}

// Função principal simplificada
export function calcularEncargosCompleto(dados: DadosFuncionario): ResultadoCalculoCompleto {
  const {
    nome,
    cargo,
    salarioBase,
    dataEntrada,
    dataFinal,
    setor = 'servicos',
    tipoRescisao = 'termino'
  } = dados

  // Validações
  const avisos: string[] = []

  if (dataFinal < dataEntrada) {
    throw new Error('Data final não pode ser anterior à data de entrada')
  }

  if (salarioBase <= 0) {
    throw new Error('Salário base deve ser maior que zero')
  }

  // Obtém alíquotas do setor
  const aliquotas = ALIQUOTAS_POR_SETOR[setor] || ALIQUOTAS_POR_SETOR.servicos

  // Parâmetros de cálculo
  const params: CompetenciaParams = {
    ...DEFAULT_COMPETENCIA_PARAMS,
    aliquotas,
    provisionarMesParcial: true,
    baseDias: 'comercial30', // Usa base 30 dias como padrão para estimativas
    feriasMetodologia: 'mensal',
    arredondamento: {
      casas: 2,
      modo: 'up' // Arredonda para cima (conservador)
    }
  }

  // Calcula período (encargos mensais)
  const resultadoPeriodo = calcularPeriodo(dataEntrada, dataFinal, salarioBase, params)

  // Calcula rescisão
  const resultadoRescisao = calcularRescisao(dataEntrada, dataFinal, salarioBase, params)

  // Calcula métricas adicionais
  const diasTrabalhados = calcularDiasTrabalhados(dataEntrada, dataFinal)
  const mesesCompletos = contarMesesCompletos(dataEntrada, dataFinal)

  // Acumula encargos por tipo
  const encargosAcumulados = resultadoPeriodo.meses.reduce((acc, mes) => ({
    inssPatronal: acc.inssPatronal + mes.encargos.inss,
    fgts: acc.fgts + mes.encargos.fgts,
    rat: acc.rat + mes.encargos.rat,
    terceiros: acc.terceiros + mes.encargos.terceiros,
    total: acc.total + mes.encargos.total
  }), { inssPatronal: 0, fgts: 0, rat: 0, terceiros: 0, total: 0 })

  // Acumula provisões
  const provisoesAcumuladas = resultadoPeriodo.meses.reduce((acc, mes) => ({
    decimoTerceiro: acc.decimoTerceiro + mes.provisoes.decimoTerceiro,
    ferias: acc.ferias + mes.provisoes.ferias,
    tercoFerias: acc.tercoFerias + mes.provisoes.tercoFerias,
    fgtsProvisoes: acc.fgtsProvisoes + mes.provisoes.fgtsProvisoes,
    total: acc.total + mes.provisoes.total
  }), { decimoTerceiro: 0, ferias: 0, tercoFerias: 0, fgtsProvisoes: 0, total: 0 })

  // Calcula saldo FGTS (8% sobre todos os salários)
  const saldoFGTS = encargosAcumulados.fgts

  // Calcula verbas rescisórias baseado no tipo
  let multa40FGTS: number | undefined
  let avisoPrevio: number | undefined

  if (tipoRescisao === 'demissaoSemJusta') {
    multa40FGTS = Math.ceil(saldoFGTS * 0.4 * 100) / 100
    avisoPrevio = calcularAvisoPrevio(salarioBase, diasTrabalhados)
    avisos.push('Incluído multa de 40% do FGTS e aviso prévio indenizado')
  } else if (tipoRescisao === 'acordoTrabalhista') {
    multa40FGTS = Math.ceil(saldoFGTS * 0.2 * 100) / 100 // 20% no acordo
    avisos.push('Incluído multa de 20% do FGTS (acordo trabalhista)')
  }

  // Monta detalhamento mensal
  const detalhamentoMensal = resultadoPeriodo.meses.map(mes => ({
    competencia: mes.label,
    diasTrabalhados: mes.diasTrabalhados,
    salario: mes.salarioCompetencia,
    encargos: {
      inssPatronal: mes.encargos.inss,
      fgts: mes.encargos.fgts,
      rat: mes.encargos.rat,
      terceiros: mes.encargos.terceiros,
      total: mes.encargos.total
    },
    provisoes: {
      decimoTerceiro: mes.provisoes.decimoTerceiro,
      ferias: mes.provisoes.ferias,
      tercoFerias: mes.provisoes.tercoFerias,
      fgtsProvisoes: mes.provisoes.fgtsProvisoes,
      total: mes.provisoes.total
    },
    custoTotal: mes.totalMes + mes.salarioCompetencia
  }))

  // Calcula totais
  const salariosPagos = resultadoPeriodo.totais.salario
  const encargosObrigatorios = encargosAcumulados.total
  const provisoesConstituidas = provisoesAcumuladas.total

  const custoRescisorio =
    resultadoRescisao.total +
    (multa40FGTS || 0) +
    (avisoPrevio || 0)

  const custoTotalEstimado =
    salariosPagos +
    encargosObrigatorios +
    custoRescisorio

  const mesesTrabalhados = resultadoPeriodo.meses.length || 1
  const custoMedioMensal = custoTotalEstimado / mesesTrabalhados

  const percentualEncargos = salariosPagos > 0
    ? ((encargosObrigatorios + custoRescisorio) / salariosPagos) * 100
    : 0

  // Adiciona avisos úteis
  if (mesesCompletos === 0) {
    avisos.push('Nenhum mês completo trabalhado - cálculos proporcionais aplicados')
  }

  if (percentualEncargos > 100) {
    avisos.push(`Encargos totais representam ${percentualEncargos.toFixed(1)}% do salário`)
  }

  if (setor === 'construcao') {
    avisos.push('Setor de construção civil - RAT máximo aplicado (3%)')
  }

  return {
    funcionario: {
      nome,
      cargo,
      salarioBase,
      dataEntrada: dataEntrada.toLocaleDateString('pt-BR'),
      dataFinal: dataFinal.toLocaleDateString('pt-BR'),
      diasTrabalhados,
      mesesCompletos,
      setor
    },

    detalhamentoMensal,
    encargosAcumulados,
    provisoesAcumuladas,

    verbasRescisorias: {
      decimoTerceiroProporcional: resultadoRescisao.decimoTerceiroProporcional,
      feriasProporcionais: resultadoRescisao.feriasProporcionais,
      tercoFerias: resultadoRescisao.tercoFerias,
      fgtsSobreVerbas: resultadoRescisao.fgtsSobreVerbas,
      saldoFGTS,
      multa40FGTS,
      avisoPrevio,
      totalRescisao: custoRescisorio,
      mesesConsiderados13: resultadoRescisao.mesesConsiderados13,
      mesesConsideradosFerias: resultadoRescisao.mesesConsideradosFerias
    },

    totais: {
      salariosPagos: Math.ceil(salariosPagos * 100) / 100,
      encargosObrigatorios: Math.ceil(encargosObrigatorios * 100) / 100,
      provisoesConstituidas: Math.ceil(provisoesConstituidas * 100) / 100,
      custoRescisorio: Math.ceil(custoRescisorio * 100) / 100,
      custoTotalEstimado: Math.ceil(custoTotalEstimado * 100) / 100,
      custoMedioMensal: Math.ceil(custoMedioMensal * 100) / 100,
      percentualEncargos: Math.round(percentualEncargos * 10) / 10
    },

    avisos
  }
}

// Função helper para gerar relatório formatado
export function gerarRelatorioTexto(resultado: ResultadoCalculoCompleto): string {
  const r = resultado

  let relatorio = `
RELATÓRIO DE ENCARGOS TRABALHISTAS
===================================

DADOS DO FUNCIONÁRIO
-------------------
${r.funcionario.nome ? `Nome: ${r.funcionario.nome}` : ''}
${r.funcionario.cargo ? `Cargo: ${r.funcionario.cargo}` : ''}
Salário Base: R$ ${r.funcionario.salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Período: ${r.funcionario.dataEntrada} a ${r.funcionario.dataFinal}
Dias Trabalhados: ${r.funcionario.diasTrabalhados}
Meses Completos: ${r.funcionario.mesesCompletos}
Setor: ${r.funcionario.setor}

RESUMO FINANCEIRO
----------------
Salários Pagos: R$ ${r.totais.salariosPagos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Encargos Obrigatórios: R$ ${r.totais.encargosObrigatorios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Provisões Constituídas: R$ ${r.totais.provisoesConstituidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Custo Rescisório: R$ ${r.totais.custoRescisorio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

CUSTO TOTAL ESTIMADO: R$ ${r.totais.custoTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Custo Médio Mensal: R$ ${r.totais.custoMedioMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Encargos sobre Salário: ${r.totais.percentualEncargos}%

ENCARGOS ACUMULADOS
------------------
INSS Patronal (20%): R$ ${r.encargosAcumulados.inssPatronal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
FGTS (8%): R$ ${r.encargosAcumulados.fgts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
RAT: R$ ${r.encargosAcumulados.rat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Terceiros: R$ ${r.encargosAcumulados.terceiros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

VERBAS RESCISÓRIAS
-----------------
13º Proporcional: R$ ${r.verbasRescisorias.decimoTerceiroProporcional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Férias Proporcionais: R$ ${r.verbasRescisorias.feriasProporcionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
1/3 de Férias: R$ ${r.verbasRescisorias.tercoFerias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
FGTS sobre Verbas: R$ ${r.verbasRescisorias.fgtsSobreVerbas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
${r.verbasRescisorias.multa40FGTS ? `Multa 40% FGTS: R$ ${r.verbasRescisorias.multa40FGTS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
${r.verbasRescisorias.avisoPrevio ? `Aviso Prévio: R$ ${r.verbasRescisorias.avisoPrevio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}

${r.avisos.length > 0 ? `
OBSERVAÇÕES
-----------
${r.avisos.map(a => `• ${a}`).join('\n')}
` : ''}
`

  return relatorio
}

// Exemplo de uso
export function exemploUso() {
  const dados: DadosFuncionario = {
    nome: 'João Silva',
    cargo: 'Analista',
    salarioBase: 5000,
    dataEntrada: new Date('2024-01-15'),
    dataFinal: new Date('2025-08-31'),
    setor: 'servicos',
    tipoRescisao: 'demissaoSemJusta'
  }

  const resultado = calcularEncargosCompleto(dados)
  console.log(gerarRelatorioTexto(resultado))

  return resultado
}
