import {
  getAllLeagues, getActiveLeague, getNextMatch, getLastFinishedMatch,
  getStandings, getMatchesGroupedByRound, getTeamsByLeague, setActiveLeague
} from '../db.js';
import { getTerms } from '../sports-terms.js';
import { renderBarChart, renderDoughnutChart, renderLineChart, renderEmptyChart } from '../charts.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
async function renderDashboard(container) {
  const leagues = await getAllLeagues();

  if (leagues.length === 0) {
    container.innerHTML = `
      <h1>Bienvenido a LeagueHub</h1>
      <p class="empty-state">Todavía no has creado ninguna liga.</p>
      <a href="#leagues" class="btn-link">Crear primera liga</a>
    `;
    return;
  }

  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    container.innerHTML = `
      <h1>Bienvenido a LeagueHub</h1>
      <p class="empty-state">Tienes ligas creadas pero ninguna activa.</p>
      <a href="#leagues" class="btn-link">Ir a Ligas y activar una</a>
    `;
    return;
  }

  const terms = getTerms(activeLeague.sport);
  const nextMatch = await getNextMatch(activeLeague.id);
  const lastMatch = await getLastFinishedMatch(activeLeague.id);
  const teams = await getTeamsByLeague(activeLeague.id);
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  container.innerHTML = `
    <div class="dashboard-header">
      <h1>${terms.icono} ${activeLeague.name}</h1>
      <p>${terms.nombre} — ${activeLeague.season}</p>
      ${leagues.length > 1 ? renderLeagueSwitcher(leagues, activeLeague) : ''}
    </div>

    <div class="dashboard-cards">
      <div class="dashboard-card">
        <h3>Próximo partido</h3>
        ${nextMatch ? renderMatchCard(nextMatch, teamById) : '<p class="empty-state">No hay partidos programados.</p>'}
      </div>
      <div class="dashboard-card">
        <h3>Último resultado</h3>
        ${lastMatch ? renderMatchCard(lastMatch, teamById, true) : '<p class="empty-state">Todavía no hay partidos finalizados.</p>'}
      </div>
    </div>

    <div id="quick-view"></div>

    <h2>Resumen visual</h2>
    <div id="dashboard-charts"></div>
  `;

  if (leagues.length > 1) {
    document.getElementById('league-switcher').addEventListener('change', async (e) => {
      await setActiveLeague(e.target.value);
      const container = document.getElementById('app');
      renderDashboard(container);
    });
  }

await renderQuickView(activeLeague, teams);
  await renderDashboardCharts(activeLeague, teams);
}

async function renderDashboardCharts(league, teams) {
  const chartsEl = document.getElementById('dashboard-charts');

  chartsEl.innerHTML = `
    <div class="chart-box"><h4>Equipos con más ${league.mode === 'liga' ? '' : ''}goles a favor</h4><canvas id="chart-top-teams"></canvas></div>
    <div class="chart-box"><h4>Distribución de resultados</h4><canvas id="chart-results"></canvas></div>
    <div class="chart-box chart-wide"><h4>Evolución de goles por fecha</h4><canvas id="chart-timeline"></canvas></div>
  `;

  const teamsWithGoals = teams.filter(t => t.played > 0);
  if (teamsWithGoals.length === 0) {
    renderEmptyChart(document.getElementById('chart-top-teams').parentElement);
  } else {
    const sorted = [...teamsWithGoals].sort((a, b) => b.scoredFor - a.scoredFor).slice(0, 6);
    renderBarChart(
      'chart-top-teams',
      sorted.map(t => t.name),
      sorted.map(t => t.scoredFor),
      'Goles a favor',
      '#2e7d32'
    );
  }

  const totalWon = teams.reduce((sum, t) => sum + t.won, 0);
  const totalDrawn = teams.reduce((sum, t) => sum + t.drawn, 0);
  const totalLost = teams.reduce((sum, t) => sum + t.lost, 0);

  if (totalWon + totalDrawn + totalLost === 0) {
    renderEmptyChart(document.getElementById('chart-results').parentElement);
  } else {
    renderDoughnutChart(
      'chart-results',
      ['Victorias', 'Empates', 'Derrotas'],
      [totalWon, totalDrawn, totalLost],
      ['#2e7d32', '#fbc02d', '#c62828']
    );
  }

  const { getAllByIndex } = await import('../db.js');
  const matches = await getAllByIndex('matches', 'by_league', league.id);
  const finished = matches
    .filter(m => m.status === 'finalizado')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (finished.length === 0) {
    renderEmptyChart(document.getElementById('chart-timeline').parentElement);
  } else {
    let acumulado = 0;
    const dataPoints = finished.map(m => {
      acumulado += (m.homeScore + m.awayScore);
      return acumulado;
    });
    renderLineChart(
      'chart-timeline',
      finished.map(m => new Date(m.date).toLocaleDateString()),
      [{
        label: 'Goles acumulados en la liga',
        data: dataPoints,
        borderColor: '#1565c0',
        backgroundColor: 'rgba(21, 101, 192, 0.15)',
        fill: true,
        tension: 0.3
      }]
    );
  }
}

function renderLeagueSwitcher(leagues, activeLeague) {
  return `
    <select id="league-switcher">
      ${leagues.map(l => `<option value="${l.id}" ${l.id === activeLeague.id ? 'selected' : ''}>${l.name}</option>`).join('')}
    </select>
  `;
}

function renderMatchCard(match, teamById, finished = false) {
  const home = teamById[match.homeTeamId];
  const away = teamById[match.awayTeamId];
  const scoreText = finished ? `${match.homeScore} - ${match.awayScore}` : new Date(match.date).toLocaleString();

  return `
    <a href="#match/${match.id}" class="match-card">
      <span>${home ? home.name : 'Por definir'}</span>
      <span><strong>${finished ? scoreText : 'vs'}</strong></span>
      <span>${away ? away.name : 'Por definir'}</span>
      ${!finished ? `<span>${scoreText}</span>` : ''}
    </a>
  `;
}

async function renderQuickView(league, teams) {
  const el = document.getElementById('quick-view');

  if (league.mode === 'liga') {
    const standings = await getStandings(league.id);
    const top5 = standings.slice(0, 5);

    el.innerHTML = `
      <h2>Top 5 equipos</h2>
      ${top5.length === 0
        ? '<p class="empty-state">Sin equipos registrados.</p>'
        : `<table class="stats-table full-width">
            <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>Pts</th></tr></thead>
            <tbody>
              ${top5.map((t, i) => `
                <tr><td>${i + 1}</td><td>${t.name}</td><td>${t.played}</td><td><strong>${t.points}</strong></td></tr>
              `).join('')}
            </tbody>
          </table>
          <a href="#stats" class="btn-link">Ver tabla completa</a>`
      }
    `;
  } else {
    const grouped = await getMatchesGroupedByRound(league.id);
    const rounds = Object.keys(grouped);
    const lastRound = rounds[rounds.length - 1];

    el.innerHTML = `
      <h2>Estado del torneo</h2>
      ${lastRound
        ? `<p>Ronda actual: <strong>${lastRound}</strong> (${grouped[lastRound].length} partido${grouped[lastRound].length > 1 ? 's' : ''})</p>`
        : '<p class="empty-state">Bracket aún no generado.</p>'
      }
      <a href="#stats" class="btn-link">Ver bracket completo</a>
    `;
  }
}

export { renderDashboard };