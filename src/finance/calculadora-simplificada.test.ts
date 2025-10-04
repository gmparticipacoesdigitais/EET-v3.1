// src/finance/calculadora-simplificada.test.ts
import { describe, expect, it } from 'vitest'
import {
  calcularEncargosCompleto,
  DadosFuncionario,
  ALIQUOTAS_POR_SETOR
} from './calculadora-simplificada'

describe('calcularEncargosCompleto', () => {
  it('deve calcular corretamente para período de 1 mês completo', () => {
    const dados: DadosFuncionario = {
      salarioBase: 10000,
      dataEntrada: new Date(2025, 0, 1), // 1 de janeiro
      dataFinal: new Date(2025, 0, 31),   // 31 de janeiro
      setor: 'servicos'
    }

    const resultado = calcularEncargosCompleto(dados)

    // Verifica salário pago
    expect(resultado.totais.salariosPagos).toBeCloseTo(10000, 0)

    // Verifica encargos (INSS 20% + FGTS 8% + RAT 2% + Terceiros 5.8% = 35.8%)
    expect(resultado.encargosAcumulados.total).toBeCloseTo(3580, 0)

    // Verifica 13º proporcional (1/12)
    expect(resultado.verbasRescisorias.decimoTerceiroProporcional).toBeCloseTo(833.33, 1)

    // Verifica que tem 1 mês completo
    expect(resultado.funcionario.mesesCompletos).toBe(1)
    expect(resultado.funcionario.diasTrabalhados).toBe(31)
  })

  it('deve aplicar a regra dos 15 dias corretamente', () => {
    const dados: DadosFuncionario = {
      salarioBase: 6000,
      dataEntrada: new Date(2025, 0, 15), // 15 de janeiro
      dataFinal: new Date(2025, 0, 31),   // 31 de janeiro (17 dias)
      setor: 'comercio'
    }

    const resultado = calcularEncargosCompleto(dados)

    // Com 17 dias trabalhados, deve contar como mês completo para 13º
    expect(resultado.verbasRescisorias.decimoTerceiroProporcional).toBeCloseTo(500, 0) // 6000/12
    expect(resultado.verbasRescisorias.feriasProporcionais).toBeCloseTo(500, 0)

    // Mas o salário deve ser proporcional (17/30 * 6000)
    expect(resultado.totais.salariosPagos).toBeCloseTo(3400, 0)
  })

  it('não deve contar mês para 13º com menos de 15 dias', () => {
    const dados: DadosFuncionario = {
      salarioBase: 5000,
      dataEntrada: new Date(2025, 0, 20), // 20 de janeiro
      dataFinal: new Date(2025, 0, 31),   // 31 de janeiro (12 dias)
      setor: 'servicos'
    }

    const resultado = calcularEncargosCompleto(dados)

    // Com 12 dias, não conta para 13º e férias
    expect(resultado.verbasRescisorias.mesesConsiderados13).toBe(0)
    expect(resultado.verbasRescisorias.decimoTerceiroProporcional).toBe(0)
    expect(resultado.verbasRescisorias.feriasProporcionais).toBe(0)
  })

  it('deve calcular multa FGTS e aviso prévio em demissão sem justa causa', () => {
    const dados: DadosFuncionario = {
      salarioBase: 8000,
      dataEntrada: new Date(2024, 0, 1),  // 1 ano de trabalho
      dataFinal: new Date(2024, 11, 31),
      setor: 'industria',
      tipoRescisao: 'demissaoSemJusta'
    }

    const resultado = calcularEncargosCompleto(dados)

    // FGTS acumulado (ajustado por dias úteis)
    expect(resultado.verbasRescisorias.saldoFGTS).toBeGreaterThan(7600)
    expect(resultado.verbasRescisorias.saldoFGTS).toBeLessThan(7700)

    // Multa 40% FGTS
    expect(resultado.verbasRescisorias.multa40FGTS).toBeGreaterThan(3000)

    // Aviso prévio (30 dias + 3 por ano = 33 dias)
    expect(resultado.verbasRescisorias.avisoPrevio).toBeCloseTo(8800, 0) // (8000/30)*33

    // Deve ter aviso sobre multa e aviso prévio
    expect(resultado.avisos).toContain('Incluído multa de 40% do FGTS e aviso prévio indenizado')
  })

  it('deve calcular 20% de multa FGTS em acordo trabalhista', () => {
    const dados: DadosFuncionario = {
      salarioBase: 10000,
      dataEntrada: new Date(2024, 5, 1),
      dataFinal: new Date(2025, 4, 31),   // 11 meses
      setor: 'servicos',
      tipoRescisao: 'acordoTrabalhista'
    }

    const resultado = calcularEncargosCompleto(dados)

    // FGTS acumulado: ~10000 * 11 * 0.08 = 8800
    const fgtsEsperado = resultado.verbasRescisorias.saldoFGTS

    // Multa 20% FGTS (acordo)
    expect(resultado.verbasRescisorias.multa40FGTS).toBeCloseTo(fgtsEsperado * 0.2, 0)

    // Não deve ter aviso prévio
    expect(resultado.verbasRescisorias.avisoPrevio).toBeUndefined()

    expect(resultado.avisos).toContain('Incluído multa de 20% do FGTS (acordo trabalhista)')
  })

  it('deve aplicar alíquotas diferentes por setor', () => {
    const dados: DadosFuncionario = {
      salarioBase: 5000,
      dataEntrada: new Date(2025, 0, 1),
      dataFinal: new Date(2025, 0, 31),
      setor: 'construcao' // RAT 3%
    }

    const resultado = calcularEncargosCompleto(dados)

    // RAT construção = 3% * 5000 = 150
    expect(resultado.encargosAcumulados.rat).toBeCloseTo(150, 0)

    // RAT serviços = 2% * 5000 = 100 (para comparação)
    const dadosServicos = { ...dados, setor: 'servicos' }
    const resultadoServicos = calcularEncargosCompleto(dadosServicos)
    expect(resultadoServicos.encargosAcumulados.rat).toBeCloseTo(100, 0)
  })

  it('deve calcular período com múltiplos meses', () => {
    const dados: DadosFuncionario = {
      salarioBase: 4000,
      dataEntrada: new Date(2025, 0, 15), // 15 de janeiro
      dataFinal: new Date(2025, 2, 20),   // 20 de março
      setor: 'comercio'
    }

    const resultado = calcularEncargosCompleto(dados)

    // Janeiro: 17 dias (>=15, conta para 13º)
    // Fevereiro: 28 dias completo
    // Março: 20 dias (>=15, conta para 13º)
    // Total: 3 meses para 13º

    expect(resultado.verbasRescisorias.mesesConsiderados13).toBe(3)
    expect(resultado.verbasRescisorias.decimoTerceiroProporcional).toBeCloseTo(1000, 0) // 4000 * 3/12

    // Detalhamento mensal deve ter 3 entradas
    expect(resultado.detalhamentoMensal).toHaveLength(3)
  })

  it('deve arredondar valores para cima (conservador)', () => {
    const dados: DadosFuncionario = {
      salarioBase: 3333.33,
      dataEntrada: new Date(2025, 0, 1),
      dataFinal: new Date(2025, 0, 31),
      setor: 'servicos'
    }

    const resultado = calcularEncargosCompleto(dados)

    // Todos os valores devem estar arredondados para cima
    // INSS: 3333.33 * 0.20 = 666.666 -> 666.67
    expect(resultado.encargosAcumulados.inssPatronal).toBeGreaterThanOrEqual(666.67)

    // 13º: 3333.33 / 12 = 277.7775 -> 277.78
    expect(resultado.verbasRescisorias.decimoTerceiroProporcional).toBeGreaterThanOrEqual(277.78)
  })

  it('deve calcular percentual de encargos corretamente', () => {
    const dados: DadosFuncionario = {
      salarioBase: 10000,
      dataEntrada: new Date(2025, 0, 1),
      dataFinal: new Date(2025, 11, 31), // 1 ano completo
      setor: 'servicos',
      tipoRescisao: 'demissaoSemJusta'
    }

    const resultado = calcularEncargosCompleto(dados)

    // Salários: aproximadamente 10000 * 12 (ajustado por meses parciais)
    expect(resultado.totais.salariosPagos).toBeGreaterThan(119000)
    expect(resultado.totais.salariosPagos).toBeLessThan(121000)

    // Percentual de encargos deve ser significativo (>60% com multa e aviso)
    expect(resultado.totais.percentualEncargos).toBeGreaterThan(60)
    expect(resultado.totais.percentualEncargos).toBeLessThan(100)
  })

  it('deve rejeitar data final anterior à entrada', () => {
    const dados: DadosFuncionario = {
      salarioBase: 5000,
      dataEntrada: new Date(2025, 5, 1),
      dataFinal: new Date(2025, 0, 1),
      setor: 'servicos'
    }

    expect(() => calcularEncargosCompleto(dados)).toThrow('Data final não pode ser anterior')
  })

  it('deve rejeitar salário zero ou negativo', () => {
    const dados: DadosFuncionario = {
      salarioBase: 0,
      dataEntrada: new Date(2025, 0, 1),
      dataFinal: new Date(2025, 0, 31),
      setor: 'servicos'
    }

    expect(() => calcularEncargosCompleto(dados)).toThrow('Salário base deve ser maior que zero')
  })

  it('deve calcular aviso prévio progressivo corretamente', () => {
    // 5 anos de trabalho = 30 + (5 * 3) = 45 dias de aviso
    const dados: DadosFuncionario = {
      salarioBase: 6000,
      dataEntrada: new Date(2020, 0, 1),
      dataFinal: new Date(2024, 11, 31), // 5 anos
      setor: 'servicos',
      tipoRescisao: 'demissaoSemJusta'
    }

    const resultado = calcularEncargosCompleto(dados)

    // Aviso: (6000/30) * 45 = 9000
    expect(resultado.verbasRescisorias.avisoPrevio).toBeCloseTo(9000, 0)
  })

  it('deve limitar aviso prévio a 90 dias', () => {
    // 25 anos de trabalho = 30 + (25 * 3) = 105 dias, mas limitado a 90
    const dados: DadosFuncionario = {
      salarioBase: 10000,
      dataEntrada: new Date(2000, 0, 1),
      dataFinal: new Date(2024, 11, 31), // 25 anos
      setor: 'servicos',
      tipoRescisao: 'demissaoSemJusta'
    }

    const resultado = calcularEncargosCompleto(dados)

    // Aviso: (10000/30) * 90 = 30000
    expect(resultado.verbasRescisorias.avisoPrevio).toBeCloseTo(30000, 0)
  })

  it('deve usar setor padrão quando não especificado', () => {
    const dados: DadosFuncionario = {
      salarioBase: 5000,
      dataEntrada: new Date(2025, 0, 1),
      dataFinal: new Date(2025, 0, 31)
      // setor não especificado
    }

    const resultado = calcularEncargosCompleto(dados)

    // Deve usar alíquotas do setor 'servicos' como padrão
    expect(resultado.encargosAcumulados.rat).toBeCloseTo(100, 0) // 2% * 5000
  })
})
