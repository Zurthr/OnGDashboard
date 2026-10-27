import { defineEventHandler, readBody, createError } from 'h3'
import { spawn } from 'child_process'
import path from 'path'

interface ComponentFinding {
  costType: string
  baseline: number
  forecast: number
  absoluteVariance: number
  percentageDeviation: number
  contributionRatio: number
  isDominantDriver: boolean
  historicalContext: {
    historicalFlag: string
  }
}

interface SummaryFindings {
  baselineTotal: number
  forecastTotal: number
  absoluteVarianceTotal: number
  percentageDeviationTotal: number
}

function formatVedaComputation(forecastData: any) {
  const base = forecastData.forecast.base_cost_usd
  const adjusted = forecastData.forecast.adjusted_cost_usd
  const totalProjectCost = forecastData.forecast.total_project_cost_usd

  const categories = [
    { key: 'substructure', label: 'Substructure Cost' },
    { key: 'topside_deck_structure', label: 'Deck Structure Cost' },
    { key: 'topside_production', label: 'Production Facilities Cost' },
    { key: 'pipeline', label: 'Pipeline Costs' },
    { key: 'certification_and_permit', label: 'Certifications & Permits Costs' },
    { key: 'general_support', label: 'General Support Cost' },
  ]

  const rawComponents = categories.map(cat => {
    const unadjustedBase = Number(base[cat.key]) || 0
    const forecast = Number(adjusted[cat.key]) || 0
    const baseline = forecast
    const absoluteVariance = forecast - unadjustedBase
    const percentageDeviation = unadjustedBase > 0 ? (absoluteVariance / unadjustedBase) * 100 : 0
    return {
      costType: cat.label,
      baseline,
      forecast,
      absoluteVariance,
      percentageDeviation
    }
  })

  const totalAbsoluteVariance = rawComponents.reduce((sum, c) => sum + Math.abs(c.absoluteVariance), 0)

  const sortedByContribution = [...rawComponents]
    .map((rc, originalIdx) => ({
      originalIdx,
      absVariance: Math.abs(rc.absoluteVariance),
      contributionRatio: totalAbsoluteVariance > 0
        ? (Math.abs(rc.absoluteVariance) / totalAbsoluteVariance) * 100
        : 0
    }))
    .sort((a, b) => b.absVariance - a.absVariance)

  const PARETO_THRESHOLD = 80
  let cumulative = 0
  const dominantDriverIndices = new Set<number>()

  for (const component of sortedByContribution) {
    cumulative += component.contributionRatio
    dominantDriverIndices.add(component.originalIdx)
    if (cumulative >= PARETO_THRESHOLD) break
  }

  const baselineTotal = rawComponents.reduce((sum, c) => sum + c.baseline, 0)
  const forecastTotal = totalProjectCost || rawComponents.reduce((sum, c) => sum + c.forecast, 0)
  const absoluteVarianceTotal = forecastTotal - baselineTotal
  const percentageDeviationTotal = baselineTotal > 0 ? (absoluteVarianceTotal / baselineTotal) * 100 : 0

  const componentFindings: ComponentFinding[] = rawComponents.map((rc, idx) => {
    const contributionRatio = totalAbsoluteVariance > 0
      ? (Math.abs(rc.absoluteVariance) / totalAbsoluteVariance) * 100
      : 0

    let compFlag = 'Within Normal Range'
    if (rc.percentageDeviation > 35) {
      compFlag = 'Unprecedented'
    } else if (rc.percentageDeviation > 10) {
      compFlag = 'Outlier'
    }

    return {
      costType: rc.costType,
      baseline: Number(rc.baseline.toFixed(2)),
      forecast: Number(rc.forecast.toFixed(2)),
      absoluteVariance: Number(rc.absoluteVariance.toFixed(2)),
      percentageDeviation: Number(rc.percentageDeviation.toFixed(2)),
      contributionRatio: Number(contributionRatio.toFixed(2)),
      isDominantDriver: dominantDriverIndices.has(idx),
      historicalContext: {
        historicalFlag: compFlag
      }
    }
  })

  let historicalFlag = 'Within Normal Range'
  const hasAnyCompAbove35 = componentFindings.some(c => c.percentageDeviation > 35)

  if (hasAnyCompAbove35 || percentageDeviationTotal > 25) {
    historicalFlag = 'Unprecedented'
  } else if (percentageDeviationTotal > 10) {
    historicalFlag = 'Outlier'
  }

  let overallSeverity = 'LOW'
  if (historicalFlag === 'Unprecedented') {
    overallSeverity = 'HIGH'
  } else if (historicalFlag === 'Outlier') {
    overallSeverity = 'MEDIUM'
  }

  const dominantDrivers = componentFindings.filter(c => c.isDominantDriver).map(c => c.costType).join(', ') || 'None'

  return {
    rawForecast: forecastData,
    summaryFindings: {
      baselineTotal: Number(baselineTotal.toFixed(2)),
      forecastTotal: Number(forecastTotal.toFixed(2)),
      absoluteVarianceTotal: Number(absoluteVarianceTotal.toFixed(2)),
      percentageDeviationTotal: Number(percentageDeviationTotal.toFixed(2))
    },
    componentFindings,
    dominantDrivers,
    historicalFlag,
    overallSeverity
  }
}

async function runPythonForecast(payload: any): Promise<any> {
  // 1. Try FastAPI endpoint if running
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1200)
    const res = await fetch('http://127.0.0.1:8000/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // FastAPI server not responding, fallback to direct python CLI execution
  }

  // 2. Direct python CLI execution via predict_cli.py
  return new Promise((resolve, reject) => {
    const scriptDir = path.resolve(process.cwd(), 'server/api/offshore_forecast_api')
    const pythonExe = 'python'
    const proc = spawn(pythonExe, ['predict_cli.py'], { cwd: scriptDir })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        let errMsg = `Python script exited with code ${code}`
        try {
          const parsed = JSON.parse(stdout)
          if (parsed && parsed.error) errMsg = parsed.error
        } catch {}
        if (stderr.trim()) errMsg += `: ${stderr.trim()}`
        return reject(new Error(errMsg))
      }

      try {
        const parsed = JSON.parse(stdout)
        if (parsed.success) {
          resolve(parsed.data)
        } else {
          reject(new Error(parsed.error || 'Unknown error from Python predict_cli.py'))
        }
      } catch (err: any) {
        reject(new Error(`Failed to parse Python output: ${err.message}. Output was: ${stdout}`))
      }
    })

    proc.stdin.write(JSON.stringify(payload))
    proc.stdin.end()
  })
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  // Validate the 9 parameters matching ForecastRequest
  const leg = Number(body.leg)
  const water_depth = Number(body.water_depth ?? body.waterDepth)
  const pipe_length = Number(body.pipe_length ?? body.pipeLength)
  const pipe_diameter = Number(body.pipe_diameter ?? body.pipeDiameter)
  const piles = Number(body.piles)
  const jacket = Number(body.jacket)
  const topside = Number(body.topside)
  const conductor = Number(body.conductor)
  const project_year = Number(body.project_year ?? body.projectYear)

  if (
    isNaN(leg) || leg <= 0 ||
    isNaN(water_depth) || water_depth < 0 ||
    isNaN(pipe_length) || pipe_length < 0 ||
    isNaN(pipe_diameter) || pipe_diameter <= 0 ||
    isNaN(piles) || piles < 0 ||
    isNaN(jacket) || jacket < 0 ||
    isNaN(topside) || topside < 0 ||
    isNaN(conductor) || conductor < 0 ||
    isNaN(project_year)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input parameters for offshore forecast. All 9 parameters must be valid numbers.'
    })
  }

  const forecastPayload = {
    leg,
    water_depth,
    pipe_length,
    pipe_diameter,
    piles,
    jacket,
    topside,
    conductor,
    project_year
  }

  try {
    const rawData = await runPythonForecast(forecastPayload)
    const formatted = formatVedaComputation(rawData)
    return {
      success: true,
      ...formatted
    }
  } catch (err: any) {
    console.error('Error executing offshore forecast:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || 'Error running forecast models'
    })
  }
})
