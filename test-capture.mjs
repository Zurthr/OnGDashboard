import puppeteer from 'puppeteer'

async function run() {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 })

    page.on('console', msg => console.log('PAGE LOG:', msg.text()))
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message))

    const targetUrl = 'http://localhost:3000/forecast?scenarioId=1&location=Natuna%20Sea'
    console.log('Navigating to:', targetUrl)
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2' })
    console.log('Page loaded.')

    // Map Wait
    console.log('Waiting for map viewport and markers...')
    await page.waitForSelector('.leaflet-map-viewport')
    await page.waitForSelector('.custom-leaflet-marker')
    console.log('Map elements found.')

    // Switch to Variance
    console.log('Clicking Variance tab...')
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.tab-btn'))
      const varBtn = buttons.find(b => b.textContent?.trim() === 'Variance')
      if (varBtn) {
        varBtn.click()
        console.log('Clicked Variance button!')
      } else {
        console.log('Could not find Variance button!')
      }
    })

    console.log('Waiting for .echart-instance on Variance tab...')
    await page.waitForSelector('.echart-instance', { timeout: 10000 })
    console.log('.echart-instance found.')

    // Let's check window.echarts state
    const hasEcharts = await page.evaluate(() => {
      return {
        hasEcharts: typeof window.echarts !== 'undefined',
        chartCount: document.querySelectorAll('.echart-instance').length,
        loadingCount: document.querySelectorAll('.chart-loading').length
      }
    })
    console.log('ECharts state on page:', hasEcharts)

    // Wait for charts to load
    await page.waitForFunction(() => {
      const loadings = document.querySelectorAll('.chart-loading')
      if (loadings.length > 0) return false
      
      const echarts = window.echarts
      if (!echarts) return false
      
      const chartEls = document.querySelectorAll('.echart-instance')
      if (chartEls.length === 0) return false
      
      for (const el of Array.from(chartEls)) {
        const instance = echarts.getInstanceByDom(el)
        if (!instance) return false
      }
      return true
    }, { timeout: 10000 })
    console.log('Variance charts fully loaded and initialized.')

    // Switch to Treemap
    console.log('Clicking Treemap tab...')
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.tab-btn'))
      const tmBtn = buttons.find(b => b.textContent?.trim() === 'Treemap')
      if (tmBtn) {
        tmBtn.click()
        console.log('Clicked Treemap button!')
      } else {
        console.log('Could not find Treemap button!')
      }
    })

    console.log('Waiting for .echart-instance on Treemap tab...')
    await page.waitForSelector('.echart-instance', { timeout: 10000 })
    console.log('.echart-instance found on Treemap.')

    console.log('All tests succeeded!')
  } catch (err) {
    console.error('Test failed with error:', err)
  } finally {
    await browser.close()
    console.log('Browser closed.')
  }
}

run()
