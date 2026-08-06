import {
  getActiveLeague, getStandings, getTopScorers, getMatchesGroupedByRound, getTeamsByLeague,
  getPointsEvolutionByTeam, getScoresByRound
} from '../db.js';
import { getTerms } from '../sports-terms.js';
import { renderLineChart, renderHorizontalBarChart, renderBarChart, renderEmptyChart } from '../charts.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
async function renderStats(container) {
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    container.innerHTML = `
      <h1>Estadísticas</h1>
      <p class="empty-state">Primero debes tener una liga activa. <a href="#leagues">Ir a Ligas</a></p>
    `;
    return;
  }

  const terms = getTerms(activeLeague.sport);
  const topScorers = await getTopScorers(activeLeague.id, 10);

  container.innerHTML = `
    <h1>Estadísticas ${terms.icono} — ${activeLeague.name}</h1>

    <div id="tournament-structure"></div>

    <h2>${terms.rankingAnotadores}</h2>
    <div id="scorers-table"></div>
  `;

  if (activeLeague.mode === 'liga') {
    await renderStandingsTable(activeLeague, terms);
  } else {
    await renderBracket(activeLeague);
  }

renderScorersTable(topScorers, terms);
  await renderAdvancedCharts(activeLeague, terms, topScorers);
}

// --- 3 gráficos avanzados (sección 4.9.3), distintos según modalidad ---
async function renderAdvancedCharts(league, terms, topScorers) {
  const container = document.getElementById('app');
  const statsEl = document.querySelector('h1').parentElement;

  const chartsHtml = `
    <h2>Gráficos avanzados</h2>
    <div id="advanced-charts" class="dashboard-charts">
      <div class="chart-box chart-wide"><h4>${league.mode === 'liga' ? 'Evolución de puntos por equipo' : 'Anotaciones por ronda'}</h4><canvas id="chart-adv-1"></canvas></div>
      <div class="chart-box"><h4>Top 10 ${terms.rankingAnotadores.toLowerCase()}</h4><canvas id="chart-adv-2"></canvas></div>
      <div class="chart-box"><h4>${league.mode === 'liga' ? 'Promedio de goles por equipo' : 'Promedio de goles por partido'}</h4><canvas id="chart-adv-3"></canvas></div>
    </div>
  `;

  document.querySelector('main#app').insertAdjacentHTML('beforeend', chartsHtml);

  // --- Gráfico 1: distinto según modalidad ---
  if (league.mode === 'liga') {
    const { teams, dateLabels, evolution } = await getPointsEvolutionByTeam(league.id);
    if (dateLabels.length === 0) {
      renderEmptyChart(document.getElementById('chart-adv-1').parentElement);
    } else {
      const palette = ['#2e7d32', '#1565c0', '#e65100', '#6a1b9a', '#c62828', '#00838f'];
      const datasets = teams.slice(0, 6).map((t, i) => ({
        label: t.name,
        data: evolution[t.id],
        borderColor: palette[i % palette.length],
        fill: false,
        tension: 0.3
      }));
      renderLineChart('chart-adv-1', dateLabels, datasets);
    }
  } else {
    const byRound = await getScoresByRound(league.id);
    const rounds = Object.keys(byRound);
    if (rounds.length === 0) {
      renderEmptyChart(document.getElementById('chart-adv-1').parentElement);
    } else {
      renderBarChart('chart-adv-1', rounds, rounds.map(r => byRound[r]), 'Anotaciones', '#e65100');
    }
  }

  // --- Gráfico 2: top 10 anotadores (barras horizontales, igual en ambas modalidades) ---
  if (topScorers.length === 0) {
    renderEmptyChart(document.getElementById('chart-adv-2').parentElement);
  } else {
    renderHorizontalBarChart(
      'chart-adv-2',
      topScorers.map(p => p.name),
      topScorers.map(p => p.totalScored),
      terms.eventoAnotacionPlural,
      '#1565c0'
    );
  }

  // --- Gráfico 3: a elección (promedio de goles) ---
  const teams = await getTeamsByLeague(league.id);
  const teamsWithMatches = teams.filter(t => t.played > 0);
  if (teamsWithMatches.length === 0) {
    renderEmptyChart(document.getElementById('chart-adv-3').parentElement);
  } else {
    const averages = teamsWithMatches.map(t => (t.scoredFor / t.played).toFixed(2));
    renderBarChart(
      'chart-adv-3',
      teamsWithMatches.map(t => t.name),
      averages,
      'Promedio por partido',
      '#6a1b9a'
    );
  }
}

// --- Tabla de posiciones (modalidad Liga) ---
async function renderStandingsTable(league, terms) {
  const standings = await getStandings(league.id);
  const el = document.getElementById('tournament-structure');

  if (standings.length === 0) {
    el.innerHTML = '<p class="empty-state">No hay equipos registrados.</p>';
    return;
  }

  el.innerHTML = `
    <table class="stats-table full-width">
      <thead>
        <tr>
          <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
          <th>${terms.etiquetaFavor}</th><th>${terms.etiquetaContra}</th><th>DIF</th><th>Pts</th>
        </tr>
      </thead>
      <tbody>
        ${standings.map((t, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><a href="#team/${t.id}">${t.name}</a></td>
            <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
            <td>${t.scoredFor}</td><td>${t.scoredAgainst}</td>
            <td>${t.scoredFor - t.scoredAgainst}</td>
            <td><strong>${t.points}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// --- Bracket visual (modalidad Eliminación Directa) ---
async function renderBracket(league) {
  const grouped = await getMatchesGroupedByRound(league.id);
  const teams = await getTeamsByLeague(league.id);
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const el = document.getElementById('tournament-structure');

  const roundNames = Object.keys(grouped);

  if (roundNames.length === 0) {
    el.innerHTML = '<p class="empty-state">Todavía no se generó el bracket.</p>';
    return;
  }

  el.innerHTML = `
    <div class="bracket-container">
      ${roundNames.map(roundName => `
        <div class="bracket-round">
          <h3>${roundName}</h3>
          ${grouped[roundName].map(m => renderBracketMatch(m, teamById)).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function renderBracketMatch(match, teamById) {
  const home = match.homeTeamId ? teamById[match.homeTeamId] : null;
  const away = match.awayTeamId ? teamById[match.awayTeamId] : null;
  const isFinished = match.status === 'finalizado';

  const homeWon = isFinished && match.homeScore > match.awayScore;
  const awayWon = isFinished && match.awayScore > match.homeScore;

  return `
    <a href="#match/${match.id}" class="bracket-match">
      <div class="bracket-team ${homeWon ? 'winner' : ''}">
        <span>${home ? home.name : 'Por definir'}</span>
        <span>${isFinished ? match.homeScore : ''}</span>
      </div>
      <div class="bracket-team ${awayWon ? 'winner' : ''}">
        <span>${away ? away.name : 'Por definir'}</span>
        <span>${isFinished ? match.awayScore : ''}</span>
      </div>
    </a>
  `;
}

// --- Ranking de anotadores (ambas modalidades) ---
function renderScorersTable(topScorers, terms) {
  const el = document.getElementById('scorers-table');

  if (topScorers.length === 0) {
    el.innerHTML = '<p class="empty-state">Todavía no hay anotaciones registradas.</p>';
    return;
  }

  el.innerHTML = `
    <table class="stats-table full-width">
      <thead>
        <tr>
          <th>#</th><th>Jugador</th><th>Equipo</th><th>${terms.eventoAnotacionPlural}</th><th>PJ</th><th>Promedio</th>
        </tr>
      </thead>
      <tbody>
        ${topScorers.map((p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><a href="#player/${p.id}">${p.name}</a></td>
            <td>${p.teamName}</td>
            <td>${p.totalScored}</td>
            <td>${p.matchesPlayed}</td>
            <td>${p.matchesPlayed > 0 ? (p.totalScored / p.matchesPlayed).toFixed(2) : '0.00'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

export { renderStats };