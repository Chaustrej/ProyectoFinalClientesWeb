import {
  getById, getTeamsByLeague, getPlayersByTeam, getActiveLeague,
  getMatchEvents, finalizeMatch, undoMatch, updateMatchDate
} from '../db.js';
import { getTerms } from '../sports-terms.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';

let pendingEvents = [];

async function renderMatchDetail(container, matchId) {
  pendingEvents = [];

  const match = await getById('matches', matchId);
  if (!match) {
    container.innerHTML = '<p class="empty-state">Partido no encontrado.</p>';
    return;
  }

  const activeLeague = await getActiveLeague();
  const terms = getTerms(activeLeague.sport);
  const homeTeam = match.homeTeamId ? await getById('teams', match.homeTeamId) : null;
  const awayTeam = match.awayTeamId ? await getById('teams', match.awayTeamId) : null;

  container.innerHTML = `
    <a href="#matches" class="btn-link-secondary">← Volver a Partidos</a>

    <div class="match-header">
      <h1>${homeTeam ? homeTeam.name : 'Por definir'} vs ${awayTeam ? awayTeam.name : 'Por definir'}</h1>
      <p>${new Date(match.date).toLocaleString()} — Estado: <strong>${match.status}</strong></p>
      ${match.round ? `<span class="team-chip" style="background-color:#555">${match.round}</span>` : ''}

      ${match.status === 'finalizado'
        ? `<h2 class="score-display">${match.homeScore} - ${match.awayScore}</h2>`
        : ''
      }
    </div>

    <div id="date-edit-section"></div>
    <div id="events-section"></div>
    <div id="action-section"></div>
  `;

  renderDateEditSection(match);

  if (match.status === 'programado' && homeTeam && awayTeam) {
    await renderEventsSection(match, homeTeam, awayTeam, terms);
  } else if (match.status === 'finalizado') {
    await renderFinishedEvents(match, terms);
  } else {
    document.getElementById('events-section').innerHTML =
      '<p class="empty-state">Este partido todavía no tiene equipos definidos (esperando ronda anterior).</p>';
  }
}

function renderDateEditSection(match) {
  const el = document.getElementById('date-edit-section');
  const localDate = new Date(match.date).toISOString().slice(0, 16);

  el.innerHTML = `
    <form id="date-form" class="inline-form">
      <label>Fecha y hora:
        <input type="datetime-local" name="date" value="${localDate}">
      </label>
      <button type="submit">Actualizar fecha</button>
    </form>
  `;

  document.getElementById('date-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await updateMatchDate(match.id, new Date(formData.get('date')).toISOString());
    showToast('Fecha actualizada correctamente.', 'success');
    const container = document.getElementById('app');
    renderMatchDetail(container, match.id);
  });
}

async function renderEventsSection(match, homeTeam, awayTeam, terms) {
  const homePlayers = await getPlayersByTeam(homeTeam.id);
  const awayPlayers = await getPlayersByTeam(awayTeam.id);

  const section = document.getElementById('events-section');
  section.innerHTML = `
    <h2>Registrar ${terms.eventoAnotacionPlural.toLowerCase()}</h2>
    <button id="btn-add-event">+ Agregar ${terms.eventoAnotacion.toLowerCase()}</button>
    <div id="event-form-container"></div>

    <div class="events-columns">
      <div>
        <h3>${homeTeam.name}</h3>
        <ul id="home-events"></ul>
      </div>
      <div>
        <h3>${awayTeam.name}</h3>
        <ul id="away-events"></ul>
      </div>
    </div>
  `;

  renderPendingEvents();

  document.getElementById('btn-add-event').addEventListener('click', () => {
    showEventForm(homeTeam, awayTeam, homePlayers, awayPlayers, terms);
  });

  renderActionSection(match, terms, homeTeam, awayTeam);
}

function renderPendingEvents() {
  const homeList = document.getElementById('home-events');
  const awayList = document.getElementById('away-events');

  const homeEvents = pendingEvents.filter(e => e.team === 'home');
  const awayEvents = pendingEvents.filter(e => e.team === 'away');

  homeList.innerHTML = homeEvents.length === 0
    ? '<li class="empty-state">Sin anotaciones aún</li>'
    : homeEvents.map((e) => `
        <li>${e.playerName} ${e.minute ? `(${e.minute}')` : ''}
          <button data-index="${pendingEvents.indexOf(e)}" class="btn-remove-event">✕</button>
        </li>
      `).join('');

  awayList.innerHTML = awayEvents.length === 0
    ? '<li class="empty-state">Sin anotaciones aún</li>'
    : awayEvents.map((e) => `
        <li>${e.playerName} ${e.minute ? `(${e.minute}')` : ''}
          <button data-index="${pendingEvents.indexOf(e)}" class="btn-remove-event">✕</button>
        </li>
      `).join('');

  document.querySelectorAll('.btn-remove-event').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = Number(e.target.getAttribute('data-index'));
      pendingEvents.splice(index, 1);
      renderPendingEvents();
      updateFinishButtonState();
    });
  });
}

function showEventForm(homeTeam, awayTeam, homePlayers, awayPlayers, terms) {
  const formContainer = document.getElementById('event-form-container');

  formContainer.innerHTML = `
    <form id="event-form">
      <label>Equipo:
        <select name="team" id="event-team-select" required>
          <option value="home">${homeTeam.name}</option>
          <option value="away">${awayTeam.name}</option>
        </select>
      </label>

      <label>Jugador:
        <select name="playerId" id="event-player-select" required></select>
      </label>

      <label>Minuto (opcional):
        <input type="number" name="minute" min="0">
      </label>

      <button type="submit">Agregar</button>
    </form>
  `;

  const teamSelect = document.getElementById('event-team-select');
  const playerSelect = document.getElementById('event-player-select');

  function updatePlayerOptions() {
    const players = teamSelect.value === 'home' ? homePlayers : awayPlayers;
    playerSelect.innerHTML = players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  updatePlayerOptions();
  teamSelect.addEventListener('change', updatePlayerOptions);

  document.getElementById('event-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const players = teamSelect.value === 'home' ? homePlayers : awayPlayers;
    const player = players.find(p => p.id === Number(formData.get('playerId')));

    pendingEvents.push({
      team: formData.get('team'),
      playerId: Number(formData.get('playerId')),
      playerName: player.name,
      minute: formData.get('minute') ? Number(formData.get('minute')) : null
    });

    renderPendingEvents();
    updateFinishButtonState();
    formContainer.innerHTML = '';
  });
}

function renderActionSection(match, terms, homeTeam, awayTeam) {
  const section = document.getElementById('action-section');
  section.innerHTML = `<button id="btn-finish" disabled>Finalizar partido</button>`;

  document.getElementById('btn-finish').addEventListener('click', () => handleFinish(match));
  updateFinishButtonState();
}

function updateFinishButtonState() {
  const btn = document.getElementById('btn-finish');
  if (btn) btn.disabled = false;
}

async function handleFinish(match) {
  const activeLeague = await getActiveLeague();

  if (activeLeague.mode === 'eliminacion') {
    const homeCount = pendingEvents.filter(e => e.team === 'home').length;
    const awayCount = pendingEvents.filter(e => e.team === 'away').length;

    if (homeCount === awayCount) {
      const winner = prompt('El marcador está empatado. Esto no está permitido en eliminación directa.\nEscribe "local" o "visitante" para declarar el ganador por desempate:');
      if (winner === 'local') {
        pendingEvents.push({ team: 'home', playerId: null, playerName: 'Desempate', minute: null, isTiebreaker: true });
      } else if (winner === 'visitante') {
        pendingEvents.push({ team: 'away', playerId: null, playerName: 'Desempate', minute: null, isTiebreaker: true });
      } else {
        showToast('Debes declarar un ganador para finalizar el partido.', 'error');
        return;
      }
    }
  }

  const confirmar = await showConfirmDialog('¿Finalizar este partido? Se actualizarán las estadísticas.');
  if (!confirmar) return;

  try {
    await finalizeMatch(match.id, pendingEvents, activeLeague.mode);

    showToast('¡Partido finalizado con éxito!', 'success');
    const container = document.getElementById('app');
    renderMatchDetail(container, match.id);
  } catch (err) {
    showToast('Error al finalizar el partido: ' + err.message, 'error');
  }
}

async function renderFinishedEvents(match, terms) {
  const events = await getMatchEvents(match.id);

  if (!match.homeTeamId || !match.awayTeamId) {
    document.getElementById('events-section').innerHTML =
      '<p class="empty-state">Este partido importado no tiene equipos completos (limitación conocida al importar brackets).</p>';
    document.getElementById('action-section').innerHTML = '';
    return;
  }

  const homeTeam = await getById('teams', match.homeTeamId);
  const awayTeam = await getById('teams', match.awayTeamId);

  const homeEvents = events.filter(e => e.teamId === homeTeam.id);
  const awayEvents = events.filter(e => e.teamId === awayTeam.id);

  const section = document.getElementById('events-section');
  section.innerHTML = `
    <h2>${terms.eventoAnotacionPlural} registrados</h2>
    <div class="events-columns">
      <div>
        <h3>${homeTeam.name}</h3>
        <ul>${homeEvents.map(e => `<li>${e.playerName} ${e.minute ? `(${e.minute}')` : ''}</li>`).join('') || '<li class="empty-state">Sin registros</li>'}</ul>
      </div>
      <div>
        <h3>${awayTeam.name}</h3>
        <ul>${awayEvents.map(e => `<li>${e.playerName} ${e.minute ? `(${e.minute}')` : ''}</li>`).join('') || '<li class="empty-state">Sin registros</li>'}</ul>
      </div>
    </div>
  `;

  const actionSection = document.getElementById('action-section');
  actionSection.innerHTML = `<button id="btn-undo" class="btn-link-secondary">Deshacer partido</button>`;
  document.getElementById('btn-undo').addEventListener('click', () => handleUndo(match));
}

async function handleUndo(match) {
  const confirmar = await showConfirmDialog('¿Deshacer este partido? Se revertirán las estadísticas.');
  if (!confirmar) return;

  const activeLeague = await getActiveLeague();

  try {
    await undoMatch(match.id, activeLeague.mode);
    showToast('Partido deshecho correctamente.', 'success');
    const container = document.getElementById('app');
    renderMatchDetail(container, match.id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export { renderMatchDetail };
