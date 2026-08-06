const activeCharts = {};

function destroyChartIfExists(canvasId) {
  if (activeCharts[canvasId]) {
    activeCharts[canvasId].destroy();
    delete activeCharts[canvasId];
  }
}

function renderEmptyChart(containerEl, message = 'No hay datos suficientes') {
  containerEl.innerHTML = `<p class="empty-state chart-empty">${message}</p>`;
}

function renderBarChart(canvasId, labels, data, label, color) {
  destroyChartIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: color }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderDoughnutChart(canvasId, labels, data, colors) {
  destroyChartIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors }]
    },
    options: { responsive: true }
  });
}

function renderLineChart(canvasId, labels, datasets) {
  destroyChartIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderHorizontalBarChart(canvasId, labels, data, label, color) {
  destroyChartIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: color }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    }
  });
}

export { renderBarChart, renderDoughnutChart, renderLineChart, renderHorizontalBarChart, renderEmptyChart };