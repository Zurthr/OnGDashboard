import { defineEventHandler } from 'h3';
import { getDbPool } from '../../utils/db';

export default defineEventHandler(async (event) => {
  try {
    const pool = getDbPool();
    const [rows]: any = await pool.query(
      'SELECT DISTINCT scenario_id FROM scenario_costs ORDER BY scenario_id'
    );
    
    // Extract numbers from row results
    const scenarioIds = rows.map((r: any) => Number(r.scenario_id));
    return {
      success: true,
      scenarioIds
    };
  } catch (error: any) {
    console.error('Error fetching scenarios list:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch scenarios: ${error.message}. Please verify if MySQL is running.`
    });
  }
});
