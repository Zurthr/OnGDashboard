import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  parseKkksCsv,
  mergeKkksEffective,
  applyKkksModifier,
  useKkksDeviations,
  normalizeCostType,
  CSV_TO_APP_COMPONENT_MAP,
  RAW_KKKS_DEVIATION_CSV,
  type KkksOverrides,
} from '../composables/useKkksDeviations.ts'

describe('KKKS Forecast Deviations - Data Layer', () => {

  describe('1. CSV Parsing', () => {
    it('should parse the actual CSV file from disk matching the embedded raw CSV', () => {
      const csvPath = path.resolve(process.cwd(), 'assets/data/kkks_forecast_deviation.csv')
      assert.ok(fs.existsSync(csvPath), 'assets/data/kkks_forecast_deviation.csv must exist')

      const fileContent = fs.readFileSync(csvPath, 'utf-8')
      const baselineFromFile = parseKkksCsv(fileContent)
      const baselineFromEmbedded = parseKkksCsv(RAW_KKKS_DEVIATION_CSV)

      assert.deepEqual(baselineFromFile, baselineFromEmbedded)
      assert.equal(Object.keys(baselineFromFile).length, 13, 'Expected 13 KKKS rows')
    })

    it('should convert empty fields to null, and NEVER to 0', () => {
      const baseline = parseKkksCsv(RAW_KKKS_DEVIATION_CSV)

      // STARBORN ENERGY BONTANG has empty substructure fields: ",,132.39,..."
      const starborn = baseline['STARBORN ENERGY BONTANG PTE. LTD.']
      assert.ok(starborn, 'Starborn row must exist')
      assert.strictEqual(starborn['Substructure Cost'].avg, null, 'Empty field must be null')
      assert.strictEqual(starborn['Substructure Cost'].median, null, 'Empty field must be null')
      assert.notStrictEqual(starborn['Substructure Cost'].avg, 0, 'Empty field must NOT be 0')
      assert.notStrictEqual(starborn['Substructure Cost'].median, 0, 'Empty field must NOT be 0')

      // PREMIER OIL NATUNA SEA B.V. has all empty fields: ",,,,,,,,,,,,"
      const premier = baseline['PREMIER OIL NATUNA SEA B.V.']
      assert.ok(premier, 'Premier Oil row must exist')
      for (const component of Object.values(CSV_TO_APP_COMPONENT_MAP)) {
        assert.strictEqual(premier[component].avg, null)
        assert.strictEqual(premier[component].median, null)
      }
    })

    it('should correctly parse numeric values and negative percentages', () => {
      const baseline = parseKkksCsv(RAW_KKKS_DEVIATION_CSV)

      // BP BERAU: -6.94 avg, -6.71 median for substructure
      const bp = baseline['BP BERAU LTD.']
      assert.strictEqual(bp['Substructure Cost'].avg, -6.94)
      assert.strictEqual(bp['Substructure Cost'].median, -6.71)

      // MEDCO ENERGI SAMPANG: general support has actual 0.06 (should NOT be confused with null)
      const sampang = baseline['MEDCO ENERGI SAMPANG PTY. LTD.']
      assert.strictEqual(sampang['General Support Cost'].avg, 0.06)
      assert.strictEqual(sampang['General Support Cost'].median, 0.06)
    })

    it('should correctly parse PT PERTAMINA HULU MAHAKAM with all 6 components', () => {
      const baseline = parseKkksCsv(RAW_KKKS_DEVIATION_CSV)
      const mahakam = baseline['PT PERTAMINA HULU MAHAKAM']

      assert.ok(mahakam, 'PT PERTAMINA HULU MAHAKAM must exist in baseline')
      assert.deepEqual(mahakam['Substructure Cost'], { avg: 9.58, median: 10.43 })
      assert.deepEqual(mahakam['Deck Structure Cost'], { avg: 156.29, median: 96.54 })
      assert.deepEqual(mahakam['Production Facilities Cost'], { avg: -34.06, median: -46.55 })
      assert.deepEqual(mahakam['Pipeline Costs'], { avg: 171.26, median: 19.31 })
      assert.deepEqual(mahakam['General Support Cost'], { avg: 13.41, median: 13.15 })
      assert.deepEqual(mahakam['Certifications & Permits Costs'], { avg: 131.42, median: 85.33 })
    })
  })

  describe('2. Merge Logic (Baseline, Overrides & Reset)', () => {
    const testBaseline = {
      'TEST KKKS': {
        'Substructure Cost': { avg: 10.0, median: 12.0 },
        'Pipeline Costs': { avg: 20.0, median: 22.0 },
      }
    }

    it('should return baseline values when no override is present', () => {
      const effective = mergeKkksEffective(testBaseline['TEST KKKS'], undefined)
      assert.ok(effective)
      assert.deepEqual(effective['Substructure Cost'], { avg: 10.0, median: 12.0 })
      assert.deepEqual(effective['Pipeline Costs'], { avg: 20.0, median: 22.0 })
    })

    it('should merge active overrides onto baseline', () => {
      const overrides = {
        'Substructure Cost': { avg: 50.0 } // only avg overridden
      }
      const effective = mergeKkksEffective(testBaseline['TEST KKKS'], overrides)
      assert.ok(effective)
      assert.strictEqual(effective['Substructure Cost'].avg, 50.0, 'Override should replace avg')
      assert.strictEqual(effective['Substructure Cost'].median, 12.0, 'Unoverridden median should retain baseline')
      assert.deepEqual(effective['Pipeline Costs'], { avg: 20.0, median: 22.0 }, 'Other components untouched')
    })

    it('should respect override explicitly set to null (not fall back to baseline)', () => {
      const overrides = {
        'Substructure Cost': { avg: null } // explicitly cleared/nullified
      }
      const effective = mergeKkksEffective(testBaseline['TEST KKKS'], overrides)
      assert.ok(effective)
      assert.strictEqual(effective['Substructure Cost'].avg, null, 'Explicit null override must be respected')
      assert.strictEqual(effective['Substructure Cost'].median, 12.0, 'Median retains baseline')
    })

    it('should revert to baseline when override is reset via useKkksDeviations', () => {
      const deviations = useKkksDeviations(testBaseline as any)

      // Set override
      deviations.setOverride('TEST KKKS', 'Substructure Cost', 'avg', 99.9)
      assert.strictEqual(deviations.isOverridden('TEST KKKS', 'Substructure Cost', 'avg'), true)
      assert.strictEqual(deviations.getEffective('TEST KKKS')?.['Substructure Cost'].avg, 99.9)

      // Reset cell
      deviations.resetCell('TEST KKKS', 'Substructure Cost', 'avg')
      assert.strictEqual(deviations.isOverridden('TEST KKKS', 'Substructure Cost', 'avg'), false)
      assert.strictEqual(deviations.getEffective('TEST KKKS')?.['Substructure Cost'].avg, 10.0, 'Should revert to baseline')

      // Reset KKKS
      deviations.setOverride('TEST KKKS', 'Pipeline Costs', 'median', 44.4)
      deviations.resetKkks('TEST KKKS')
      assert.strictEqual(deviations.isOverridden('TEST KKKS'), false)
      assert.strictEqual(deviations.getEffective('TEST KKKS')?.['Pipeline Costs'].median, 22.0)
    })
  })

  describe('3. Pure Function: applyKkksModifier', () => {
    const rawForecast = 1000

    it('positive deviation: reduces forecast cost and returns "adjusted"', () => {
      // 1000 / (1 + 25/100) = 1000 / 1.25 = 800
      const res = applyKkksModifier(rawForecast, 25)
      assert.strictEqual(res.status, 'adjusted')
      assert.strictEqual(res.value, 800)
    })

    it('negative deviation above -100: increases forecast cost and returns "adjusted"', () => {
      // 1000 / (1 + (-20)/100) = 1000 / 0.8 = 1250
      const res = applyKkksModifier(rawForecast, -20)
      assert.strictEqual(res.status, 'adjusted')
      assert.strictEqual(res.value, 1250)
    })

    it('null deviation: returns raw forecast with status "no_data"', () => {
      const resNull = applyKkksModifier(rawForecast, null)
      assert.strictEqual(resNull.status, 'no_data')
      assert.strictEqual(resNull.value, rawForecast)

      const resUndef = applyKkksModifier(rawForecast, undefined)
      assert.strictEqual(resUndef.status, 'no_data')
      assert.strictEqual(resUndef.value, rawForecast)
    })

    it('exactly -100 deviation: returns raw forecast with status "out_of_range"', () => {
      // Guard: deviationPct <= -100 (would otherwise divide by 0)
      const res = applyKkksModifier(rawForecast, -100)
      assert.strictEqual(res.status, 'out_of_range')
      assert.strictEqual(res.value, rawForecast)
    })

    it('below -100 deviation: returns raw forecast with status "out_of_range"', () => {
      // Real data example: Starborn Pipeline at -1161.69
      const res = applyKkksModifier(rawForecast, -1161.69)
      assert.strictEqual(res.status, 'out_of_range')
      assert.strictEqual(res.value, rawForecast)

      // Another example: -100.01
      const res2 = applyKkksModifier(rawForecast, -100.01)
      assert.strictEqual(res2.status, 'out_of_range')
      assert.strictEqual(res2.value, rawForecast)
    })
  })
})
