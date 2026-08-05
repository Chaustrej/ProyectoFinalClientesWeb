import { getById, getPlayerMatchHistory } from '../db.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
async function renderPlayerDetail(container, playerId) {
  const player = await getById('players', playerId);

  if (!player) {
    container.innerHTML = '<p class="empty-state">Jugador no encontrado.</p>';
    return;
  }

  const team = await getById('teams', player.teamId);
  const history = await getPlayerMatchHistory(player.id);

  const average = player.matchesPlayed > 0
    ? (player.totalScored / player.matchesPlayed).toFixed(2)
    : '0.00';

  container.innerHTML = `
    <a href="#players" class="btn-link-secondary">← Volver a Jugadores</a>

    <div class="player-card-detail">
      ${player.photo
        ? `<img src="${player.photo}" alt="${player.name}" class="player-photo-large" onerror="this.style.display='none'">`
        : `<div class="player-photo-placeholder-large">${player.name[0].toUpperCase()}</div>`
      }
      <div>
        <h1>${player.name} ${player.number ? '#' + player.number : ''}</h1>
        <p>${player.position || 'Sin posición registrada'}</p>
        <p>Equipo: <a href="#team/${team.id}">${team.name}</a></p>
      </div>
    </div>

    <h2>Estadísticas</h2>
    <table class="stats-table">
      <tr>
        <th>Partidos jugados</th>
        <th>Anotaciones totales</th>
        <th>Promedio por partido</th>
      </tr>
      <tr>
        <td>${player.matchesPlayed}</td>
        <td>${player.totalScored}</td>
        <td>${average}</td>
      </tr>
    </table>

    <h2>Historial de partidos</h2>
    ${history.length === 0
      ? '<p class="empty-state">Todavía no registró anotaciones.</p>'
      : `<div class="matches-list">
          ${history.map(h => `
            <a href="#match/${h.match.id}" class="match-card">
              <span>${new Date(h.match.date).toLocaleDateString()}</span>
              <span>${h.scored} anotación(es)</span>
              <span>${h.match.status === 'finalizado' ? `${h.match.homeScore} - ${h.match.awayScore}` : 'Programado'}</span>
            </a>
          `).join('')}
        </div>`
    }
  `;
}

export { renderPlayerDetail };