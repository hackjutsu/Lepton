import { describe, expect, it } from 'vitest'

import Chart from '../../app/containers/dashboard/chart'
import { buildRadarChartConfig } from '../../app/containers/dashboard/chartConfig'

describe('dashboard radar chart config', () => {
  it('registers only the Chart.js pieces needed by radar charts', () => {
    expect(Chart.version).toMatch(/^4\./)
    expect(Chart.registry.getController('radar')).toBeDefined()
    expect(Chart.registry.getScale('radialLinear')).toBeDefined()
    expect(Chart.registry.getElement('point')).toBeDefined()
    expect(Chart.registry.getElement('line')).toBeDefined()
    expect(Chart.registry.getPlugin('tooltip')).toBeDefined()
    expect(Chart.registry.getPlugin('legend')).toBeDefined()
    expect(() => Chart.registry.getController('bar')).toThrow()
  })

  it('builds a radar chart config', () => {
    const config = buildRadarChartConfig(
      [8, 5, 3],
      ['JavaScript', 'Markdown', 'Python'],
      'Snippets'
    )

    expect(config).toMatchObject({
      type: 'radar',
      data: {
        labels: ['JavaScript', 'Markdown', 'Python'],
        datasets: [
          {
            label: 'Snippets',
            backgroundColor: 'rgba(81,192,191,0.2)',
            borderColor: 'rgba(81,192,191,1)',
            pointBackgroundColor: 'rgba(81,192,191,1)',
            pointBorderColor: '#C2C4D1',
            pointHoverBackgroundColor: '#C2C4D1',
            pointHoverBorderColor: 'rgba(81,192,191,1)',
            data: [8, 5, 3]
          }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          r: {
            ticks: {
              display: false
            },
            pointLabels: {
              font: {
                size: 12
              }
            }
          }
        }
      }
    })
  })

  it('does not use legacy Chart.js 1 radar option names', () => {
    const config = buildRadarChartConfig([1, 2, 3], ['A', 'B', 'C'], 'Snippets')
    const dataset = config.data.datasets[0]

    expect(dataset).not.toHaveProperty('fillColor')
    expect(dataset).not.toHaveProperty('strokeColor')
    expect(dataset).not.toHaveProperty('pointColor')
    expect(dataset).not.toHaveProperty('pointStrokeColor')
    expect(dataset).not.toHaveProperty('pointHighlightFill')
    expect(dataset).not.toHaveProperty('pointHighlightStroke')
    expect(config.options).not.toHaveProperty('pointLabelFontSize')
  })
})
