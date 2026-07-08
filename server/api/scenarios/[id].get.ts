import { defineEventHandler, getRouterParam, createError } from 'h3';
import { getDbPool } from '../../utils/db';

export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id');
  const scenarioId = Number(idStr);

  if (isNaN(scenarioId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid scenario ID. Must be a number.'
    });
  }

  try {
    const pool = getDbPool();

    const [costRows]: any = await pool.query(
      'SELECT * FROM scenario_costs WHERE scenario_id = ? ORDER BY FIELD(row_type, "Baseline", "Forecast")',
      [scenarioId]
    );

    if (!costRows || costRows.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `Scenario with ID ${scenarioId} not found in database.`
      });
    }

    const baselineRow = costRows.find((r: any) => r.row_type === 'Baseline');
    const forecastRow = costRows.find((r: any) => r.row_type === 'Forecast');

    if (!baselineRow || !forecastRow) {
      throw createError({
        statusCode: 422,
        statusMessage: `Scenario ${scenarioId} is missing either Baseline or Forecast row data.`
      });
    }

    const categories = [
      { key: 'substructures', label: 'Substructure Cost' },
      { key: 'ts_deck_structure', label: 'Deck Structure Cost' },
      { key: 'ts_prod_facilities', label: 'Production Facilities Cost' },
      { key: 'pipeline', label: 'Pipeline Costs' },
      { key: 'cert_and_permit', label: 'Certifications & Permits Costs' },
      { key: 'general_support', label: 'General Support Cost' }
    ];

    const rawComponents = categories.map(cat => {
      const baseline = Number(baselineRow[cat.key]) || 0;
      const forecast = Number(forecastRow[cat.key]) || 0;
      const absoluteVariance = forecast - baseline;
      const percentageDeviation = baseline > 0 ? (absoluteVariance / baseline) * 100 : 0;
      
      return {
        costType: cat.label,
        baseline,
        forecast,
        absoluteVariance,
        percentageDeviation
      };
    });

    const totalAbsoluteVariance = rawComponents.reduce((sum, c) => sum + Math.abs(c.absoluteVariance), 0);

        // Sort components by absolute variance descending
    const sortedByContribution = [...rawComponents]
    .map((rc, originalIdx) => ({
      ...rc,
      originalIdx,
      absVariance: Math.abs(rc.absoluteVariance),
      contributionRatio: totalAbsoluteVariance > 0
        ? (Math.abs(rc.absoluteVariance) / totalAbsoluteVariance) * 100
        : 0
    }))
    .sort((a, b) => b.absVariance - a.absVariance);

    // Walk down sorted list until cumulative contribution >= threshold
    const PARETO_THRESHOLD = 80;
    let cumulative = 0;
    const dominantDriverIndices = new Set<number>();

    for (const component of sortedByContribution) {
    cumulative += component.contributionRatio;
    dominantDriverIndices.add(component.originalIdx);
    if (cumulative >= PARETO_THRESHOLD) break;
    }

    const baselineTotal = Number(baselineRow.total_cost_sum) || 0;
    const forecastTotal = Number(forecastRow.total_cost_sum) || 0;
    const absoluteVarianceTotal = forecastTotal - baselineTotal;
    const percentageDeviationTotal = baselineTotal > 0 ? (absoluteVarianceTotal / baselineTotal) * 100 : 0;

    const componentFindings = rawComponents.map((rc, idx) => {
      const contributionRatio = totalAbsoluteVariance > 0 
        ? (rc.absoluteVariance / totalAbsoluteVariance) * 100 
        : 0;

      // Component-level flag evaluation
      let compFlag = 'Within Normal Range';
      if (rc.percentageDeviation > 35) {
        compFlag = 'Unprecedented';
      } else if (rc.percentageDeviation > 10) {
        compFlag = 'Outlier';
      }

      return {
        costType: rc.costType,
        baseline: rc.baseline,
        forecast: rc.forecast,
        absoluteVariance: rc.absoluteVariance,
        percentageDeviation: Number(rc.percentageDeviation.toFixed(2)),
        contributionRatio: Number(contributionRatio.toFixed(2)),
        isDominantDriver: dominantDriverIndices.has(idx),
        historicalContext: {
          historicalFlag: compFlag
        }
      };
    });

    // Determine overall scenario historical flag rules in priority order
    let historicalFlag = 'Within Normal Range';
    const hasAnyCompAbove35 = componentFindings.some(c => c.percentageDeviation > 35);

    if (hasAnyCompAbove35) {
      historicalFlag = 'Unprecedented';
    } else if (percentageDeviationTotal > 25) {
      historicalFlag = 'Unprecedented';
    } else if (percentageDeviationTotal > 10) {
      historicalFlag = 'Outlier';
    } else {
      historicalFlag = 'Within Normal Range';
    }

    let overallSeverity = 'LOW';
    if (historicalFlag === 'Unprecedented') {
      overallSeverity = 'HIGH';
    } else if (historicalFlag === 'Outlier') {
      overallSeverity = 'MEDIUM';
    }

    const dominantDrivers = componentFindings.filter(c => c.isDominantDriver).map(c => c.costType).join(', ') || 'None';

    return {
      summaryFindings: {
        baselineTotal,
        forecastTotal,
        absoluteVarianceTotal,
        percentageDeviationTotal: Number(percentageDeviationTotal.toFixed(2))
      },
      componentFindings,
      dominantDrivers,
      overallSeverity
    };

  } catch (error: any) {
    console.error(`Error processing VEDA computation for scenario ${scenarioId}:`, error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to execute VEDA computation: ${error.message}`
    });
  }
});
