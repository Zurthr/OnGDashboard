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
  // Narrative states
  narrative: string | null
  loadingNarrative: boolean
  narrativeError: string | null
  narrativeVerified: boolean
  // Geographic states
  selectedLocation: string
  locations: string[]
}

export const useVedaStore = defineStore('vedaStore', {
  state: (): VedaState => ({
    summaryFindings: {
      baselineTotal: 56723100.00,
      forecastTotal: 59794395.00,
      absoluteVarianceTotal: 3071295.00,
      percentageDeviationTotal: 5.41
    },
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
    // Initialize geographic fields
    selectedLocation: 'Natuna Sea',
    locations: [
      'Natuna Sea',
      'East Kalimantan',
      'Madura Strait',
      'Malacca Strait',
      'Sunda Asri',
      'Makassar Strait'
    ]
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
      // Clear narrative from previous scenario
      this.narrative = null
      this.narrativeError = null
      this.narrativeVerified = false
      
      try {
        const response = await $fetch<any>(`/api/scenarios/${id}`)

        if (response) {
          // Store the raw computed VEDA JSON
          this.computedJson = response

          // Populate existing reactive states
          this.summaryFindings = response.summaryFindings
          this.componentFindings = response.componentFindings

          // Generate AI insights automatically
          await this.generateInsights()
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

    // Generate verified cost review narrative via ChatGPT proxy
    async generateNarrative() {
      if (!this.computedJson) return

      this.loadingNarrative = true
      this.narrativeError = null
      this.narrativeVerified = false
      this.narrative = null

      try {
        const response = await $fetch<{
          success: boolean
          verified: boolean
          narrative?: string
          message?: string
        }>('/api/generate-narrative', {
          method: 'POST',
          body: {
            vedaJson: this.computedJson
          }
        })

        if (response.success && response.verified) {
          this.narrative = response.narrative || ''
          this.narrativeVerified = true
        } else {
          // Narrative failed BFF verification check
          this.narrativeError = response.message || 'Narrative verification failed.'
          this.narrativeVerified = false
          // Store narrative text anyway if returned, for debugging or context
          this.narrative = response.narrative || null
        }
      } catch (err: any) {
        this.narrativeError = err?.statusMessage || err?.message || 'Failed to generate regulatory narrative.'
        console.error('Narrative Generation Error:', err)
      } finally {
        this.loadingNarrative = false
      }
    }
  }
})
