// composables/useRuleBasedNarrative.ts
// Deterministic, non-LLM rule-based narrative engine for VEDA / SKK Migas cost reviews.
// Replaces external LLM inference with canonical regulatory benchmarking rules.

import { useFormatters } from './useFormatters'

export interface NarrativeComponentInput {
  costType: string
  baseline: number
  compVal: number
}

export interface RuleBasedNarrativeResult {
  formattedHtml: string
  plainText: string
  dominantDriver: string
  severity: string
  historicalFlag: 'Within Normal Range' | 'Outlier' | 'Unprecedented'
  totalDeviationPct: number
  comparationTotal: number
  baselineTotal: number
  varianceTotal: number
}

export const generateRuleBasedNarrative = (
  components: NarrativeComponentInput[],
  customBaselineTotal?: number
): RuleBasedNarrativeResult => {
  const { formatCurrency, getSeverityLabel } = useFormatters()

  const validComponents = components.filter(c => c && typeof c.compVal === 'number' && !isNaN(c.compVal))
  const baselineTotal = customBaselineTotal ?? validComponents.reduce((sum, c) => sum + (c.baseline || 0), 0)
  const comparationTotal = validComponents.reduce((sum, c) => sum + (c.compVal || 0), 0)
  const varianceTotal = comparationTotal - baselineTotal
  const totalDeviationPct = baselineTotal > 0 ? (varianceTotal / baselineTotal) * 100 : 0

  const compTotalStr = formatCurrency(comparationTotal)
  const baseTotalStr = formatCurrency(baselineTotal)
  const varTotalStr = formatCurrency(Math.abs(varianceTotal))
  const pctStr = Math.abs(totalDeviationPct).toFixed(2)
  const isExceed = varianceTotal >= 0
  const severity = getSeverityLabel(totalDeviationPct).toUpperCase()

  // Compute variances and sort to find dominant driver
  const sortedComponents = validComponents.map(c => {
    const varVal = c.compVal - c.baseline
    const pct = c.baseline > 0 ? (varVal / c.baseline) * 100 : 0
    return {
      costType: c.costType,
      baseline: c.baseline,
      compVal: c.compVal,
      varVal,
      pct,
      absVar: Math.abs(varVal)
    }
  }).sort((a, b) => b.absVar - a.absVar)

  const topDriver = sortedComponents[0] || {
    costType: 'Pipeline Costs',
    baseline: 0,
    compVal: 0,
    varVal: 0,
    pct: 0,
    absVar: 0
  }

  const topDriverName = topDriver.costType
  const topDriverVarStr = formatCurrency(Math.abs(topDriver.varVal))
  const topDriverPctStr = Math.abs(topDriver.pct).toFixed(2)
  const topDriverDirection = topDriver.varVal >= 0 ? 'above' : 'below'

  const absTotalVar = Math.abs(varianceTotal)
  const shareRatio = absTotalVar > 0 ? Math.min(100, (topDriver.absVar / absTotalVar) * 100) : 0
  const shareStr = shareRatio.toFixed(2)

  // Canonical VEDA Historical Flag Classification
  const maxCompPct = Math.max(...sortedComponents.map(c => c.pct), 0)
  let historicalFlag: 'Within Normal Range' | 'Outlier' | 'Unprecedented' = 'Within Normal Range'
  let flagDescription = 'though remaining within the normal historical range'

  if (totalDeviationPct > 25 || maxCompPct > 35) {
    historicalFlag = 'Unprecedented'
    flagDescription = 'representing an unprecedented variance substantially above historical benchmarks'
  } else if (totalDeviationPct > 10) {
    historicalFlag = 'Outlier'
    flagDescription = 'classified as an outlier exceeding normal variance bounds'
  }

  // Sentence 1: Aggregate comparison & severity
  const s1Plain = `Total proposed cost of ${compTotalStr} ${isExceed ? 'exceeds' : 'is below'} the approved baseline of ${baseTotalStr}, reflecting an aggregate deviation of ${varTotalStr} or ${pctStr}% at a ${severity} severity level.`
  const s1Html = `Total proposed cost of <strong>$${compTotalStr}</strong> ${isExceed ? 'exceeds' : 'is below'} the approved baseline of <strong>$${baseTotalStr}</strong>, reflecting an aggregate deviation of <strong>$${varTotalStr}</strong> or <strong>${pctStr}%</strong> at a <strong>${severity}</strong> severity level.`

  // Sentence 2: Dominant cost driver & contribution
  const s2Plain = `${topDriverName} is identified as the dominant cost driver with a variance of ${topDriverVarStr} or ${topDriverPctStr}% ${topDriverDirection} its baseline, contributing ${shareStr}% of the total aggregate deviation, ${flagDescription}.`
  const s2Html = `<strong>${topDriverName}</strong> is identified as the dominant cost driver with a variance of <strong>$${topDriverVarStr}</strong> or <strong>${topDriverPctStr}%</strong> ${topDriverDirection} its baseline, contributing <strong>${shareStr}%</strong> of the total aggregate deviation, ${flagDescription}.`

  // Sentence 3: Other components
  const otherItems = sortedComponents.slice(1)
  let s3Plain = ''
  let s3Html = ''
  if (otherItems.length > 0) {
    const listPlain = otherItems.map(c => {
      const sign = c.varVal >= 0 ? '+' : '-'
      return `${c.costType} (${sign}${Math.abs(c.pct).toFixed(2)}%)`
    }).join(', ')

    s3Plain = `All other cost components, namely ${listPlain}, show reasonable deviations and do not require immediate escalation action.`
    s3Html = `All other cost components, namely ${listPlain}, show reasonable deviations and do not require immediate escalation action.`
  }

  // Sentence 4: Regulatory recommendation
  let s4Plain = ''
  let s4Html = ''
  if (historicalFlag === 'Unprecedented' || totalDeviationPct > 25) {
    s4Plain = `The regulator is advised to conduct a comprehensive audit and require detailed commercial justification from the contractor prior to final sanctioning.`
    s4Html = `The regulator is advised to conduct a comprehensive audit and require detailed commercial justification from the contractor prior to final sanctioning.`
  } else if (historicalFlag === 'Outlier' || totalDeviationPct > 10) {
    s4Plain = `The regulator is advised to request written justification from the contractor regarding the ${topDriverName} increase given its dominant contribution to total variance, though a comprehensive audit is not required at this stage.`
    s4Html = `The regulator is advised to request written justification from the contractor regarding the <strong>${topDriverName}</strong> increase given its dominant contribution to total variance, though a comprehensive audit is not required at this stage.`
  } else {
    s4Plain = `The proposed expenditure aligns with historical benchmark parameters and does not require formal escalation or comprehensive review at this stage.`
    s4Html = `The proposed expenditure aligns with historical benchmark parameters and does not require formal escalation or comprehensive review at this stage.`
  }

  const p1Plain = `${s1Plain} ${s2Plain}`
  const p2Plain = s3Plain ? `${s3Plain} ${s4Plain}` : s4Plain
  const plainText = `${p1Plain}\n\n${p2Plain}`

  const p1Html = `${s1Html} ${s2Html}`
  const p2Html = s3Html ? `${s3Html} ${s4Html}` : s4Html
  const formattedHtml = `${p1Html}<br><br>${p2Html}`

  return {
    formattedHtml,
    plainText,
    dominantDriver: topDriverName,
    severity,
    historicalFlag,
    totalDeviationPct,
    comparationTotal,
    baselineTotal,
    varianceTotal
  }
}
