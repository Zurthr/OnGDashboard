// composables/useFormatters.ts
// Shared formatting and severity utilities — import in any component
// that needs currency formatting or deviation severity labels/classes.

export const useFormatters = () => {
  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  const formatCostPerFoot = (total: number, pipeLength: number | null): string => {
    if (pipeLength == null || pipeLength <= 0) return '—'
    return formatCurrency(total / pipeLength)
  }

  const getSeverityLabel = (deviation: number): string => {
    if (deviation <= 5) return 'Low'
    if (deviation <= 15) return 'Medium'
    if (deviation <= 30) return 'High'
    return 'Critical'
  }

  // Used on scorecard pill (badge-low / badge-medium / ...)
  const getSeverityBadgeClass = (deviation: number): string => {
    if (deviation <= 5) return 'badge-low'
    if (deviation <= 15) return 'badge-medium'
    if (deviation <= 30) return 'badge-high'
    return 'badge-critical'
  }

  // Used on compare results header badge (severity-low / severity-medium / ...)
  const getSeverityClass = (deviation: number): string => {
    if (deviation <= 5) return 'severity-low'
    if (deviation <= 15) return 'severity-medium'
    if (deviation <= 30) return 'severity-high'
    return 'severity-critical'
  }

  return { formatCurrency, formatCostPerFoot, getSeverityLabel, getSeverityBadgeClass, getSeverityClass }
}
