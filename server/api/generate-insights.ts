import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  // Read request body (Pinia state sent by the client)
  const body = await readBody(event)
  const summary = body?.summaryFindings
  const components = body?.componentFindings || []

  // Simulate network latency of 1.5 seconds to showcase the loading skeleton
  await new Promise((resolve) => setTimeout(resolve, 1500))

  if (!summary) {
    return {
      insights: "No summary findings provided. Cost forecasting engine is idle."
    }
  }

  const baselineTotal = summary.baselineTotal || 0
  const forecastTotal = summary.forecastTotal || 0
  const totalDevPct = summary.percentageDeviationTotal !== undefined 
    ? summary.percentageDeviationTotal 
    : (baselineTotal > 0 ? ((forecastTotal - baselineTotal) / baselineTotal) * 100 : 0)
  
  const totalDiff = forecastTotal - baselineTotal

  if (totalDiff <= 0) {
    return {
      insights: `The proposed contract is within or below the forecast baseline (deviation: ${totalDevPct.toFixed(2)}%). All components are currently running within historical limits.`
    }
  }

  // Find primary driver component based on absolute variance
  let primaryDriver = null;
  let maxAbsVar = -1;
  
  for (const comp of components) {
    const absVar = Math.abs(comp.absoluteVariance || 0);
    if (absVar > maxAbsVar) {
      maxAbsVar = absVar;
      primaryDriver = comp;
    }
  }

  const severity = totalDevPct > 25 ? 'critical' : totalDevPct > 15 ? 'high' : totalDevPct > 5 ? 'moderate' : 'low';
  
  let driverText = '';
  if (primaryDriver) {
    const share = totalDiff > 0 ? Math.min(100, Math.max(0, (primaryDriver.absoluteVariance / totalDiff) * 100)) : 0;
    const pctDev = primaryDriver.percentageDeviation || 0;
    driverText = `${primaryDriver.costType} is the primary driver, accounting for ${share.toFixed(0)}% of the total deviation with a ${pctDev.toFixed(1)}% variance relative to its baseline.`;
  }

  // Determine historical flag details based on VEDA business logic:
  // If total > 25% or any component > 35% -> Unprecedented
  // If total > 10% -> Outlier
  // Else -> Within Normal Range
  let flag = 'Within Normal Range';
  let maxCompPct = 0;
  for (const comp of components) {
    if (comp.percentageDeviation > maxCompPct) {
      maxCompPct = comp.percentageDeviation;
    }
  }

  if (maxCompPct > 35 || totalDevPct > 25) {
    flag = 'Unprecedented';
  } else if (totalDevPct > 10) {
    flag = 'Outlier';
  }

  const flagText = flag === 'Unprecedented' 
    ? 'This expenditure represents an unprecedented scenario, indicating a cost profile substantially above historical norms.'
    : flag === 'Outlier'
    ? 'This expenditure is classified as an outlier, exceeding normal variance bounds.'
    : 'This expenditure is within normal historical ranges.';

  const insights = `The proposed contract exceeds the forecast baseline by approximately ${totalDevPct.toFixed(1)}%, representing a ${severity}-severity deviation. ${driverText} ${flagText}`;

  return {
    insights
  }
})
