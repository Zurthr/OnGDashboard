import { defineStore } from 'pinia'

interface HistoricalContext {
  historicalFlag: 'Within Normal Range' | 'Outlier' | 'Unprecedented'
}

interface ComponentFinding {
  costType: string
  baseline: number
  forecast: number
  absoluteVariance: number
  percentageDeviation: number
  contributionRatio: number
  isDominantDriver: boolean
  historicalContext: HistoricalContext
}

interface SummaryFindings {
  baselineTotal: number
  forecastTotal: number
  absoluteVarianceTotal: number
  percentageDeviationTotal: number
}

interface NavParams {
  waterDepth: number | null
  pipeLength: number | null
  pipeDiameter: number | null
  legs: '2' | '3' | '4' | '6' | ''
  topside: number | null
  jacket: number | null
  piles: number | null
  conductor: number | null
  projectLocation?: string
  projectYear: number | null
}

interface VedaState {
  summaryFindings: SummaryFindings
  componentFindings: ComponentFinding[]
  insights: string | null
  loadingInsights: boolean
  errorInsights: string | null
  scenarios: number[]
  selectedScenarioId: number | null
  loadingScenarios: boolean
  loadingDetails: boolean
  error: string | null
  computedJson: any | null
  comparationInputs: Record<string, number | null>
  isComparationModalOpen: boolean
  // Narrative states
  narrative: string | null
  loadingNarrative: boolean
  narrativeError: string | null
  narrativeVerified: boolean
  // KKKS Modifier states
  selectedKkks: string | null
  kkksModifierMode: 'none' | 'median' | 'mean'
  // Nav parameter inputs
  navParams: NavParams
  calcDone: boolean
}

export const useFpsoVedaStore = defineStore('fpsoVedaStore', {
  state: (): VedaState => ({
    summaryFindings: {
      baselineTotal: 56723100.00,
      forecastTotal: 59794395.00,
      absoluteVarianceTotal: 3071295.00,
      percentageDeviationTotal: 5.41
    },
    comparationInputs: {},
    isComparationModalOpen: false,
    componentFindings: [
      {
        costType: "Substructure Cost",
        baseline: 18432150.00,
        forecast: 19206300.00,
        absoluteVariance: 774150.00,
        percentageDeviation: 4.20,
        contributionRatio: 25.21,
        isDominantDriver: false,
        historicalContext: { historicalFlag: "Within Normal Range" }
      },
      {
        costType: "Deck Structure Cost",
        baseline: 12104890.00,
        forecast: 12613295.00,
        absoluteVariance: 508405.00,
        percentageDeviation: 4.20,
        contributionRatio: 16.55,
        isDominantDriver: false,
        historicalContext: { historicalFlag: "Within Normal Range" }
      },
      {
        costType: "Production Facilities Cost",
        baseline: 9451220.00,
        forecast: 9923781.00,
        absoluteVariance: 472561.00,
        percentageDeviation: 5.00,
        contributionRatio: 15.39,
        isDominantDriver: false,
        historicalContext: { historicalFlag: "Within Normal Range" }
      },
      {
        costType: "Pipeline Costs",
        baseline: 14673810.00,
        forecast: 15921084.00,
        absoluteVariance: 1247274.00,
        percentageDeviation: 8.50,
        contributionRatio: 40.61,
        isDominantDriver: true,
        historicalContext: { historicalFlag: "Within Normal Range" }
      },
      {
        costType: "Certifications & Permits Costs",
        baseline: 215430.00,
        forecast: 219739.00,
        absoluteVariance: 4309.00,
        percentageDeviation: 2.00,
        contributionRatio: 0.14,
        isDominantDriver: false,
        historicalContext: { historicalFlag: "Within Normal Range" }
      },
      {
        costType: "General Support Cost",
        baseline: 1845600.00,
        forecast: 1910196.00,
        absoluteVariance: 64596.00,
        percentageDeviation: 3.50,
        contributionRatio: 2.10,
        isDominantDriver: false,
        historicalContext: { historicalFlag: "Within Normal Range" }
      }
    ],
    insights: null,
    loadingInsights: false,
    errorInsights: null,
    scenarios: [],
    selectedScenarioId: null,
    loadingScenarios: false,
    loadingDetails: false,
    error: null,
    computedJson: null,
    // Initialize narrative fields
    narrative: null,
    loadingNarrative: false,
    narrativeError: null,
    narrativeVerified: false,
    // KKKS Modifier states
    selectedKkks: null,
    kkksModifierMode: 'none',
    // Nav parameter inputs
    navParams: {
      waterDepth: null,
      pipeLength: null,
      pipeDiameter: null,
      legs: '',
      topside: null,
      jacket: null,
      piles: null,
      conductor: null,
      projectYear: null,
    },
    calcDone: false,
  }),

  getters: {
    // Computes high deviation threshold (> 15% deviation is considered critical warning)
    highDeviationWarnings(): ComponentFinding[] {
      return this.componentFindings.filter(c => Math.abs(c.percentageDeviation) > 15)
    },
    hasHighDeviationWarning(): boolean {
      return this.highDeviationWarnings.length > 0
    }
  },

  actions: {
    // Fetch all unique scenario IDs
    async fetchScenarios() {
      this.loadingScenarios = true
      this.error = null
      try {
        const response = await $fetch<{ success: boolean; scenarioIds: number[] }>('/api/scenarios')
        if (response.success) {
          this.scenarios = response.scenarioIds
          // Auto-select the first scenario if loaded and none is active
          if (this.scenarios.length > 0 && !this.selectedScenarioId) {
            await this.selectScenario(this.scenarios[0])
          }
        }
      } catch (err: any) {
        this.error = err?.statusMessage || err?.message || 'Failed to fetch scenarios list'
        console.error('Error fetching scenarios list:', err)
      } finally {
        this.loadingScenarios = false
      }
    },

    // Fetch and populate details for a specific scenario
    async selectScenario(id: number) {
      this.selectedScenarioId = id
      this.loadingDetails = true
      this.error = null

      this.narrative = null
      this.narrativeError = null
      this.narrativeVerified = false

      try {
        const response = await $fetch<any>(`/api/scenarios/${id}`)

        if (response) {
          this.computedJson = response

          this.summaryFindings = response.summaryFindings
          this.componentFindings = response.componentFindings

          // Trigger non-blocking insights and narrative generation
          this.generateInsights()
          this.generateNarrative()
        }
      } catch (err: any) {
        this.error = err?.statusMessage || err?.message || `Failed to fetch VEDA computation for scenario ${id}`
        console.error(`Error selecting scenario ${id}:`, err)
      } finally {
        this.loadingDetails = false
      }
    },

    // Trigger AI insights generator
    async generateInsights() {
      this.loadingInsights = true
      this.errorInsights = null

      try {
        const response = await $fetch<{ insights: string }>('/api/generate-insights', {
          method: 'POST',
          body: {
            summaryFindings: this.summaryFindings,
            componentFindings: this.componentFindings
          }
        })
        this.insights = response.insights
      } catch (err: any) {
        this.errorInsights = err?.message || 'Failed to generate insights'
        console.error('BFF Insights Fetch Error:', err)
      } finally {
        this.loadingInsights = false
      }
    },

    // Generate verified cost review narrative via deterministic rules (non-LLM)
    generateNarrative() {
      if (!this.componentFindings || this.componentFindings.length === 0) return

      this.loadingNarrative = false
      this.narrativeError = null

      const comparationInputs = this.comparationInputs || {}
      const components = this.componentFindings.map(c => {
        const rawVal = comparationInputs[c.costType]
        const compVal = (rawVal !== undefined && rawVal !== null && rawVal !== '')
          ? Number(rawVal)
          : (c.forecast ?? c.baseline ?? 0)

        return {
          costType: c.costType,
          baseline: c.baseline || 0,
          compVal
        }
      })

      const result = generateRuleBasedNarrative(components, this.summaryFindings?.baselineTotal)
      this.narrative = result.plainText
      this.narrativeVerified = true
    },
    setSelectedKkks(kkks: string | null) {
      this.selectedKkks = kkks
      if (!kkks) {
        this.kkksModifierMode = 'none'
      }
    },

    setKkksModifierMode(mode: 'none' | 'median' | 'mean') {
      this.kkksModifierMode = mode
    },

    // Update nav parameter inputs and reset calcDone
    setNavParams(params: Partial<NavParams>) {
      this.navParams = { ...this.navParams, ...params }
      this.calcDone = false
    },

    setComparationInputs(inputs: Record<string, number | null>) {
      this.comparationInputs = { ...inputs }
    },

    openComparationModal() {
      this.isComparationModalOpen = true
    },

    closeComparationModal() {
      this.isComparationModalOpen = false
    },

    applyForecastResult(response: any) {
      if (!response) return
      if (response.summaryFindings) this.summaryFindings = response.summaryFindings
      if (response.componentFindings) this.componentFindings = response.componentFindings
      this.computedJson = response
      this.calcDone = true

      this.generateInsights()
      this.generateNarrative()
    },

    // Confirm calculation was run — calls offshore forecast API & unlocks PDF button
    async runCalc() {
      const p = this.navParams
      if (
        p.legs === '' ||
        p.waterDepth === null ||
        p.pipeLength === null ||
        p.pipeDiameter === null ||
        p.piles === null ||
        p.jacket === null ||
        p.topside === null ||
        p.conductor === null ||
        p.projectYear === null
      ) {
        throw new Error('Please fill in all 9 forecast parameters before calculating.')
      }

      const payload = {
        leg: Number(p.legs),
        water_depth: Number(p.waterDepth),
        pipe_length: Number(p.pipeLength),
        pipe_diameter: Number(p.pipeDiameter),
        piles: Number(p.piles),
        jacket: Number(p.jacket),
        topside: Number(p.topside),
        conductor: Number(p.conductor),
        project_year: Number(p.projectYear),
      }

      const response = await $fetch<any>('/api/new_forecast_api', {
        method: 'POST',
        body: payload
      })

      if (response && response.success) {
        this.applyForecastResult(response)
        return response
      }
      throw new Error(response?.error || 'Forecast calculation failed')
    }
  }
})
