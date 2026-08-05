import {
  getById, getActiveLeague, getPlayersByTeam,
  getUpcomingMatchesByTeam, getFinishedMatchesByTeam, getTeamPosition
} from '../db.js';
import { getTerms } from '../sports-terms.js';

async function renderTeamDetail(container, teamId) {
  const team = await getById('teams', teamId);

  if (!team) {
    container.innerHTML = '<p class="empty-state">Equipo no encontrado.</p>';
    return;
  }

  const activeLeague = await getActiveLeague();
  const terms = getTerms(activeLeague.sport);

  const players = await getPlayersByTeam(team.id);
  const upcoming = await getUpcomingMatchesByTeam(team.id);
  const finished = await getFinishedMatchesByTeam(team.id);
  const position = await getTeamPosition(team.id, team.leagueId);

  const diff = team.scoredFor - team.scoredAgainst;

  container.innerHTML = `
    <a href="#teams" class="btn-link-secondary">← Volver a Equipos</a>

    <div class="team-card" style="border-left: 4px solid ${team.primaryColor}">
      <h1>${team.name}</h1>
      <p>${team.city || 'Sin sede registrada'}</p>
      <p>Posición actual: <strong>#${position}</strong></p>

      <table class="stats-table">
        <tr>
          <th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
          <th>${terms.etiquetaFavor}</th><th>${terms.etiquetaContra}</th>
          <th>DIF</th><th>Puntos</th>
        </tr>
        <tr>
          <td>${team.played}</td><td>${team.won}</td><td>${team.drawn}</td><td>${team.lost}</td>
          <td>${team.scoredFor}</td><td>${team.scoredAgainst}</td>
          <td>${diff}</td><td>${team.points}</td>
        </tr>
      </table>
    </div>

    <h2>Plantilla</h2>
    <button id="btn-add-player">+ Agregar jugador</button>
    <div class="players-grid">
      ${players.length === 0
        ? '<p class="empty-state">Sin jugadores registrados.</p>'
        : players.map(p => `
          <div class="player-card">
            <a href="#player/${p.id}">
              <strong>${p.name}</strong> #${p.number || '-'}<br>
              <span>${p.position || 'Sin posición'}</span>
            </a>
          </div>
        `).join('')
      }
    </div>

    <h2>Próximos partidos</h2>
    ${upcoming.length === 0
      ? '<p class="empty-state">No hay partidos programados.</p>'
      : `<div class="matches-list">${upcoming.map(m => renderMatchRow(m, team.id)).join('')}</div>`
    }

    <h2>Partidos jugados</h2>
    ${finished.length === 0
      ? '<p class="empty-state">Todavía no jugó partidos.</p>'
      : `<div class="matches-list">${finished.map(m => renderMatchRow(m, team.id)).join('')}</div>`
    }
  `;

  document.getElementById('btn-add-player').addEventListener('click', () => {
    // Navegamos a Jugadores pasando el id del equipo como parámetro del hash,
    // así players.js puede preseleccionarlo automáticamente (sección 4.4.2)
    location.hash = `#players/${team.id}`;
  });
}

function renderMatchRow(match, teamId) {
  const isHome = match.homeTeamId === Number(teamId);
  let resultLabel = '';

  if (match.status === 'finalizado') {
    const myScore = isHome ? match.homeScore : match.awayScore;
    const rivalScore = isHome ? match.awayScore : match.homeScore;
    if (myScore > rivalScore) resultLabel = '<span class="badge badge-win">V</span>';
    else if (myScore < rivalScore) resultLabel = '<span class="badge badge-loss">D</span>';
    else resultLabel = '<span class="badge badge-draw">E</span>';
  }

  const scoreText = match.status === 'finalizado'
    ? `${match.homeScore} - ${match.awayScore}`
    : 'vs';

  return `
    <a href="#match/${match.id}" class="match-card">
      <span>${new Date(match.date).toLocaleDateString()}</span>
      <span>${scoreText}</span>
      ${resultLabel}
    </a>
  `;
}

export { renderTeamDetail };
