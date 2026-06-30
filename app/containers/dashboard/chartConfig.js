const GREY = '#C2C4D1'
const ACCENT = 'rgba(81,192,191,1)'
const ACCENT_FILL = 'rgba(81,192,191,0.2)'

export function buildRadarChartConfig (data, labels, datasetLabel) {
  return {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [
        {
          label: datasetLabel,
          backgroundColor: ACCENT_FILL,
          borderColor: ACCENT,
          pointBackgroundColor: ACCENT,
          pointBorderColor: GREY,
          pointHoverBackgroundColor: GREY,
          pointHoverBorderColor: ACCENT,
          data: data
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
  }
}
