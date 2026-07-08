import { defineEventHandler, readBody, setHeader, getRequestHost, getRequestProtocol, createError } from 'h3'
import fs from 'fs'
import path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────
interface ComponentFinding {
  costType: string
  baseline: number
  forecast: number
  absoluteVariance: number
  percentageDeviation: number
  contributionRatio: number
  isDominantDriver: boolean
}

interface SummaryFindings {
  baselineTotal: number
  forecastTotal: number
  absoluteVarianceTotal: number
  percentageDeviationTotal: number
}

interface ScenarioParams {
  forecastYear?: string | number
  historicalBasis?: string
  waterDepth?: string | number
  structureLength?: string | number
  legsConfiguration?: string
  projectLocation?: string
  topsideWeight?: string | number
  jacketWeight?: string | number
}



// ─────────────────────────────────────────────────────────────────────────────
//  Formatters
// ─────────────────────────────────────────────────────────────────────────────
const fmtUSD = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(v)

const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`

const nowWIB = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd} ${mon} ${yyyy}, ${hh}:${mm} WIB`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Driver badge helper
// ─────────────────────────────────────────────────────────────────────────────
function driverBadge(c: ComponentFinding): string {
  if (c.absoluteVariance < 0)
    return `<span style="background:#dcfce7;color:#166534;border-radius:4px;padding:2px 7px;font-size:8pt;font-weight:700;">Decrease</span>`
  if (c.isDominantDriver)
    return `<span style="background:#fee2e2;color:#991b1b;border-radius:4px;padding:2px 7px;font-size:8pt;font-weight:700;">Dominant Driver</span>`
  if (Math.abs(c.contributionRatio) >= 20)
    return `<span style="background:#fff7ed;color:#c2410c;border-radius:4px;padding:2px 7px;font-size:8pt;font-weight:700;">Contributing</span>`
  return `<span style="background:#f0fdf4;color:#166534;border-radius:4px;padding:2px 7px;font-size:8pt;font-weight:700;">Within Bounds</span>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Visual placeholder (when chart image not supplied)
// ─────────────────────────────────────────────────────────────────────────────
function imgOrPlaceholder(b64: string | null | undefined, label: string): string {
  if (b64) return `<img src="data:image/png;base64,${b64}" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:6px;box-shadow: 0 1px 3px rgba(0,0,0,0.1);" />`
  return `<div style="width:100%;height:180px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9pt;font-style:italic;">${label} — image not captured</div>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Puppeteer header / footer templates
// ─────────────────────────────────────────────────────────────────────────────
function headerHtml(scenarioId: number | null, timestamp: string): string {
  return `<div style="width:100%;padding:8px 18mm 0;display:flex;justify-content:space-between;align-items:flex-end;font-family:Arial,sans-serif;border-bottom:0.5pt solid #e2e8f0;">
    <div>
      <div style="font-size:7pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-variant:small-caps;">SKK MIGAS · Cost Estimation Platform</div>
      <div style="font-size:7pt;color:#94a3b8;margin-top:1px;">Generated: ${timestamp}</div>
    </div>
    <div style="text-align:right;">
      <div style="display:inline-block;padding:2px 8px;border:1px solid #ef4444;border-radius:3px;font-size:7pt;font-weight:700;color:#ef4444;letter-spacing:0.3px;">CONFIDENTIAL — REGULATORY USE ONLY</div>
      <div style="font-size:7pt;color:#94a3b8;margin-top:2px;">Scenario #${scenarioId ?? 'N/A'}</div>
    </div>
  </div>`
}

const footerHtml = `<div style="width:100%;padding:0 18mm 6px;display:flex;justify-content:space-between;align-items:flex-end;font-family:Arial,sans-serif;border-top:0.5pt solid #e2e8f0;">
  <span style="font-size:7pt;color:#94a3b8;">Cost Benchmarking Analytical Report</span>
  <span style="font-size:7pt;color:#94a3b8;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  <span style="font-size:7pt;color:#94a3b8;">For regulatory use only</span>
</div>`

// ─────────────────────────────────────────────────────────────────────────────
//  Event handler
// ─────────────────────────────────────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const {
    scenarioId = null,
    summaryFindings,
    componentFindings = [],
    insights = null,
    narrative = null,
    selectedVisualizations = ['location', 'variance', 'treemap'],
    scenarioParams = {} as ScenarioParams,
  } = body || {}

  if (!summaryFindings) {
    throw createError({ statusCode: 400, statusMessage: 'summaryFindings are required' })
  }

  const timestamp = nowWIB()

  // ── Puppeteer Live Capture ─────────────────────────────────────────────────
  let locationBase64: string | null = null
  let varianceBase64: string | null = null
  let treemapBase64: string | null = null

  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 })

    // Log frontend messages for debugging
    page.on('console', msg => console.log('PUPPETEER PAGE LOG:', msg.text()))
    page.on('pageerror', err => console.error('PUPPETEER PAGE ERROR:', err.message))

    // Determine host origin dynamically using robust H3 helpers
    const host = getRequestHost(event)
    const protocol = getRequestProtocol(event)
    const locName = scenarioParams.projectLocation || 'Natuna Sea'
    const targetUrl = `${protocol}://${host}/forecast?scenarioId=${scenarioId ?? ''}&location=${encodeURIComponent(locName)}`

    console.log('Puppeteer navigating to pre-render charts & map at:', targetUrl)
    await page.goto(targetUrl, { waitUntil: 'networkidle2' })

    // Wait for the Leaflet map viewport and custom marker to be rendered
    await page.waitForSelector('.leaflet-map-viewport', { timeout: 15000 }).catch(() => { })
    await page.waitForSelector('.custom-leaflet-marker', { timeout: 8000 }).catch(() => { })
    // Wait for Leaflet tiles to load fully and map center transition to finish
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 1. Capture Location Map (Default Tab)
    if (selectedVisualizations.includes('location')) {
      const mapElement = await page.$('.leaflet-map-viewport')
      if (mapElement) {
        locationBase64 = await mapElement.screenshot({ encoding: 'base64' })
      }
    }

    // 2. Capture Variance Charts (Switch Tab)
    if (selectedVisualizations.includes('variance')) {
      try {
        // Click the Variance tab button
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('.tab-btn'))
          const varBtn = buttons.find(b => b.textContent?.trim() === 'Variance')
          if (varBtn) (varBtn as HTMLElement).click()
        })
        // Wait for the tab transition to complete and ECharts canvas elements to appear
        await page.waitForSelector('.echart-instance', { timeout: 8000 })
        // Wait for ECharts to finish its async import and render animation
        await new Promise(resolve => setTimeout(resolve, 3000))

        const chartsRow = await page.$('.charts-row')
        if (chartsRow) {
          varianceBase64 = await chartsRow.screenshot({ encoding: 'base64' }) as string
          console.log('Captured Variance charts-row screenshot.')
        } else {
          console.warn('Could not find .charts-row for Variance capture')
        }
      } catch (err) {
        console.error('Variance capture failed:', err)
      }
    }

    // 3. Capture Treemap Chart (Switch Tab)
    if (selectedVisualizations.includes('treemap')) {
      try {
        // Click the Treemap tab button
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('.tab-btn'))
          const tmBtn = buttons.find(b => b.textContent?.trim() === 'Treemap')
          if (tmBtn) (tmBtn as HTMLElement).click()
        })
        // TreemapTab uses class '.treemap-echart' (not '.echart-instance')
        await page.waitForSelector('.treemap-echart', { timeout: 8000 })
        // Wait for ECharts async import and render animation
        await new Promise(resolve => setTimeout(resolve, 3000))

        const treemapTab = await page.$('.treemap-tab')
        if (treemapTab) {
          treemapBase64 = await treemapTab.screenshot({ encoding: 'base64' }) as string
          console.log('Captured Treemap .treemap-tab screenshot.')
        } else {
          console.warn('Could not find .treemap-tab for Treemap capture')
        }
      } catch (err) {
        console.error('Treemap capture failed:', err)
      }
    }

    await browser.close()
  } catch (err) {
    console.error('Puppeteer live visualization capturing error:', err)
  }

  // ── Compile HTML Template ──────────────────────────────────────────────────
  let html: string
  try {
    const templatePath = path.resolve('./server/templates/report.html')
    html = fs.readFileSync(templatePath, 'utf-8')
  } catch (err) {
    console.error('Failed to read report.html template, falling back to basic layout:', err)
    throw createError({ statusCode: 500, statusMessage: 'Report template file missing' })
  }

  const increase = summaryFindings.percentageDeviationTotal >= 0
  const devColor = increase ? '#991b1b' : '#166534'
  const devBg = increase ? '#fee2e2' : '#dcfce7'

  // Dominant driver name
  const dominant = componentFindings.find(c => c.isDominantDriver)
  const dominantName = dominant?.costType ?? 'N/A'

  // Historical status
  const maxCompPct = Math.max(...componentFindings.map(c => c.percentageDeviation))
  let histFlag = 'Within Normal Range'
  if (maxCompPct > 35 || Math.abs(summaryFindings.percentageDeviationTotal) > 25) histFlag = 'Unprecedented'
  else if (Math.abs(summaryFindings.percentageDeviationTotal) > 10) histFlag = 'Outlier'

  // ── Parameter rows ─────────────────────────────────────────────────────────
  const paramRowsHtml = [
    ['Forecast Year', scenarioParams.forecastYear ?? '—'],
    ['Historical Basis', scenarioParams.historicalBasis ?? '—'],
    ['Water Depth', scenarioParams.waterDepth ? `${scenarioParams.waterDepth} Meters` : '—'],
    ['Structure Length', scenarioParams.structureLength ? `${scenarioParams.structureLength} Meters` : '—'],
    ['Legs Configuration', scenarioParams.legsConfiguration ? `${scenarioParams.legsConfiguration} Legs` : '—'],
    ['Topside Weight', scenarioParams.topsideWeight ? `${scenarioParams.topsideWeight} Metric Tons` : '—'],
    ['Jacket Weight', scenarioParams.jacketWeight ? `${scenarioParams.jacketWeight} Metric Tons` : '—'],
    ['Project Location', scenarioParams.projectLocation ?? '—'],
  ].map(([label, val], i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f8f8'};">
      <td style="padding:6px 10px;color:#64748b;font-size:10pt;border-bottom:0.5pt solid #e2e8f0;width:42%;">${label}</td>
      <td style="padding:6px 10px;color:#0f172a;font-size:10pt;border-bottom:0.5pt solid #e2e8f0;font-weight:600;">${val}</td>
    </tr>`).join('')

  // ── KPI grid ───────────────────────────────────────────────────────────────
  const kpiData = [
    { label: 'Cost Basis (USD)', value: fmtUSD(summaryFindings.baselineTotal), bg: '#f8fafc', vcolor: '#0f172a' },
    { label: 'Forecasted (USD)', value: fmtUSD(summaryFindings.forecastTotal), bg: '#f8fafc', vcolor: '#0f172a' },
    { label: 'Variance', value: (increase ? '+' : '') + fmtUSD(summaryFindings.absoluteVarianceTotal), bg: devBg, vcolor: devColor },
    { label: 'Deviation %', value: fmtPct(summaryFindings.percentageDeviationTotal), bg: devBg, vcolor: devColor },
    { label: 'Dominant Driver', value: dominantName, bg: '#fff5f5', vcolor: '#D85A30' },
    { label: 'Historical Status', value: histFlag, bg: '#f0fdf4', vcolor: '#166534' },
  ]
  const kpiGridHtml = kpiData.map(k => `
    <div style="background:${k.bg};border:1px solid #e2e8f0;border-radius:4px;padding:12px 14px;flex:1 1 30%;">
      <div style="font-size:8pt;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${k.label}</div>
      <div style="font-size:13pt;font-weight:900;color:${k.vcolor};letter-spacing:-0.5px;line-height:1.2;">${k.value}</div>
    </div>`).join('')

  // ── Component table rows ───────────────────────────────────────────────────
  const compRowsHtml = componentFindings.map((c, i) => {
    const isDom = c.isDominantDriver
    const rowBg = isDom ? '#fff5f5' : i % 2 === 0 ? '#ffffff' : '#f8f8f8'
    const numColor = c.absoluteVariance >= 0 ? '#D85A30' : '#3B9E6A'
    return `<tr style="background:${rowBg};${isDom ? 'font-weight:700;' : ''}">
      <td style="padding:7px 12px;font-size:9.5pt;border-bottom:0.5pt solid #e2e8f0;">${c.costType}</td>
      <td style="padding:7px 12px;text-align:right;font-family:monospace;font-size:9pt;border-bottom:0.5pt solid #e2e8f0;">${fmtUSD(c.baseline)}</td>
      <td style="padding:7px 12px;text-align:right;font-family:monospace;font-size:9pt;border-bottom:0.5pt solid #e2e8f0;">${fmtUSD(c.forecast)}</td>
      <td style="padding:7px 12px;text-align:right;font-family:monospace;font-size:9pt;color:${numColor};border-bottom:0.5pt solid #e2e8f0;">${c.absoluteVariance >= 0 ? '+' : ''}${fmtUSD(c.absoluteVariance)}</td>
      <td style="padding:7px 12px;text-align:right;font-family:monospace;font-size:9pt;color:${numColor};border-bottom:0.5pt solid #e2e8f0;">${fmtPct(c.percentageDeviation)}</td>
      <td style="padding:7px 12px;text-align:center;border-bottom:0.5pt solid #e2e8f0;">${driverBadge(c)}</td>
    </tr>`
  }).join('')

  const totalsRowHtml = `<tr style="background:#f1f5f9;font-weight:900;">
    <td style="padding:8px 12px;font-size:9.5pt;border-top:1.5pt solid #94a3b8;">TOTAL</td>
    <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:9pt;border-top:1.5pt solid #94a3b8;">${fmtUSD(summaryFindings.baselineTotal)}</td>
    <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:9pt;border-top:1.5pt solid #94a3b8;">${fmtUSD(summaryFindings.forecastTotal)}</td>
    <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:9pt;color:${devColor};border-top:1.5pt solid #94a3b8;">${increase ? '+' : ''}${fmtUSD(summaryFindings.absoluteVarianceTotal)}</td>
    <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:9pt;color:${devColor};border-top:1.5pt solid #94a3b8;">${fmtPct(summaryFindings.percentageDeviationTotal)}</td>
    <td style="padding:8px 12px;border-top:1.5pt solid #94a3b8;"></td>
  </tr>`

  // ── Analytical Visualizations Section ──────────────────────────────────────
  const vizBlocks = [
    {
      id: 'location',
      heading: 'Operation Location',
      caption: 'Geographic location of the project working area within Indonesia\'s upstream offshore sector.',
      image: locationBase64,
    },
    {
      id: 'variance',
      heading: 'Variance Analysis',
      caption: 'Left: Forecast variance by cost category showing baseline and deviation. Center: Waterfall chart showing cumulative cost build-up. Right: Proportional deviation by category.',
      image: varianceBase64,
    },
    {
      id: 'treemap',
      heading: 'Cost Composition Treemap',
      caption: 'Rectangle size reflects forecasted cost. Red indicates dominant driver, orange indicates contributing increase, green indicates cost decrease.',
      image: treemapBase64,
    },
  ].filter(v => selectedVisualizations.includes(v.id))

  const vizSectionHtml = vizBlocks.length > 0 ? `
    <div class="page-break">
      <h2 style="font-size:11pt;font-weight:800;color:#0f172a;border-left:4px solid #ef4444;padding-left:10px;margin-bottom:14px;letter-spacing:-0.2px;">Analytical Visualizations</h2>
      <p style="font-size:9pt;color:#94a3b8;margin:-10px 0 18px;font-style:italic;">
        Visualizations reflect the verified analytical state at time of report generation. Included visualizations are selected at export.
      </p>
      ${vizBlocks.map(v => `
        <div style="margin-bottom:28px;">
          <h3 style="font-size:10pt;font-weight:700;color:#334155;margin:0 0 10px;">${v.heading}</h3>
          ${imgOrPlaceholder(v.image, v.heading)}
          <p style="font-size:8pt;color:#94a3b8;font-style:italic;text-align:center;margin:6px 0 0;">${v.caption}</p>
        </div>
      `).join('')}
    </div>` : ''

  // ── Narrative page ─────────────────────────────────────────────────────────
  const narrativePageHtml = narrative ? `
    <div class="page-break">
      <h2 style="font-size:11pt;font-weight:800;color:#0f172a;border-left:4px solid #ef4444;padding-left:10px;margin-bottom:14px;letter-spacing:-0.2px;">Analytical Findings</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #ef4444;border-radius:6px;padding:18px 20px;margin-bottom:16px;">
        <div style="font-size:9pt;font-weight:700;color:#334155;margin-bottom:12px;">AI-Assisted Analytical Narration — Verified Output</div>
        <p style="font-size:10pt;color:#1e293b;line-height:1.75;margin:0;white-space:pre-wrap;">${narrative}</p>
      </div>
      <p style="font-size:8pt;color:#94a3b8;font-style:italic;line-height:1.6;margin:0;">
        The analytical narrative above was generated by an AI-assisted narration system operating over deterministically computed benchmarking outputs. All numerical values referenced in the narrative have been verified against the source analytical findings prior to inclusion in this report. This report is intended to support regulatory review and does not constitute a final regulatory determination. Regulatory decisions remain the exclusive responsibility of authorized supervisory personnel.
      </p>
    </div>` : ''

  // ── Insights block ─────────────────────────────────────────────────────────
  const insightsBlockHtml = insights ? `
    <div style="background:linear-gradient(135deg,#fff7ed,#fff);border:1px solid #fed7aa;border-left:4px solid #fb923c;border-radius:6px;padding:14px 16px;margin-bottom:18px;">
      <div style="font-size:8pt;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">▸ VEDA AI Analysis</div>
      <p style="font-size:10pt;color:#431407;line-height:1.65;margin:0;">${insights}</p>
    </div>` : ''

  // ── Do Replacements ────────────────────────────────────────────────────────
  html = html
    .replace(/{{forecastYear}}/g, String(scenarioParams.forecastYear ?? '2028'))
    .replace(/{{historicalBasis}}/g, String(scenarioParams.historicalBasis ?? '2020–2024'))
    .replace(/{{paramRows}}/g, paramRowsHtml)
    .replace(/{{insightsBlock}}/g, insightsBlockHtml)
    .replace(/{{kpiGrid}}/g, kpiGridHtml)
    .replace(/{{compRows}}/g, compRowsHtml)
    .replace(/{{totalsRow}}/g, totalsRowHtml)
    .replace(/{{vizSection}}/g, vizSectionHtml)
    .replace(/{{narrativePage}}/g, narrativePageHtml)

  // ── Render PDF ─────────────────────────────────────────────────────────────
  let pdfBuffer: Buffer

  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    pdfBuffer = Buffer.from(await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerHtml(scenarioId, timestamp),
      footerTemplate: footerHtml,
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    }))

    await browser.close()
  } catch (err) {
    console.error('Puppeteer PDF print generation error:', err)
    throw createError({ statusCode: 500, statusMessage: 'PDF rendering failed' })
  }

  // ── Setup Filename & Stream Download ───────────────────────────────────────
  const sanitizedLocation = (scenarioParams.projectLocation || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const fYear = scenarioParams.forecastYear || '2028'
  const reportFilename = `report-${sanitizedLocation}-${fYear}-${Date.now()}.pdf`

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="${reportFilename}"`)
  setHeader(event, 'Content-Length', pdfBuffer.length)

  return pdfBuffer
})
