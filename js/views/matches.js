import { getActiveLeague, getTeamsByLeague, getAllByIndex, generateFixture, generateBracket, deleteMatch, add } from '../db.js';
import { getTerms } from '../sports-terms.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';

async function renderMatches(container) {
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    container.innerHTML = `
      <h1>Partidos</h1>
      <p class="empty-state">Primero debes tener una liga activa. <a href="#leagues">Ir a Ligas</a></p>
    `;
    return;
  }

  const teams = await getTeamsByLeague(activeLeague.id);
  const matches = await getAllByIndex('matches', 'by_league', activeLeague.id);
  const terms = getTerms(activeLeague.sport);

  container.innerHTML = `
    <h1>Partidos ${terms.icono} — ${activeLeague.name}</h1>

    ${renderGenerateSection(activeLeague, teams, matches)}

    <div class="filters">
      <select id="filter-status">
        <option value="">Todos</option>
        <option value="programado">Programados</option>
        <option value="finalizado">Finalizados</option>
      </select>

      <select id="filter-team">
        <option value="">Todos los equipos</option>
        ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
      </select>

      ${activeLeague.mode === 'eliminacion' ? `
        <select id="filter-round">
          <option value="">Todas las rondas</option>
          ${[...new Set(matches.map(m => m.round).filter(Boolean))].map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      ` : ''}
    </div>

    ${activeLeague.mode === 'liga' ? `<button id="btn-new-match">+ Programar Partido</button>` : ''}

    <div id="matches-list"></div>
    <div id="match-form-container"></div>
  `;

  renderMatchesList(matches, teams, activeLeague);

  document.getElementById('filter-status').addEventListener('change', () => applyFilters(matches, teams));
  document.getElementById('filter-team').addEventListener('change', () => applyFilters(matches, teams));
  const roundFilter = document.getElementById('filter-round');
  if (roundFilter) roundFilter.addEventListener('change', () => applyFilters(matches, teams));

  const newMatchBtn = document.getElementById('btn-new-match');
  if (newMatchBtn) newMatchBtn.addEventListener('click', () => showMatchForm(activeLeague, teams));

  const generateBtn = document.getElementById('btn-generate');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => handleGenerate(activeLeague, teams));
  }
}

function renderGenerateSection(league, teams, existingMatches) {
  if (existingMatches.length > 0) {
    return `<p class="empty-state">✅ Ya se generaron los partidos de esta liga (${existingMatches.length}).</p>`;
  }

  if (league.mode === 'liga') {
    const enoughTeams = teams.length >= 2;
    return `
      <div class="generate-box">
        <p>Equipos registrados: ${teams.length}</p>
        <button id="btn-generate" ${!enoughTeams ? 'disabled' : ''}>Generar fixture</button>
        ${!enoughTeams ? '<p class="empty-state">Se necesitan al menos 2 equipos.</p>' : ''}
      </div>
    `;
  } else {
    const required = league.bracketSize;
    const matches = teams.length === required;
    return `
      <div class="generate-box">
        <p>Equipos registrados: ${teams.length} / ${required} requeridos</p>
        <button id="btn-generate" ${!matches ? 'disabled' : ''}>Generar bracket</button>
        ${!matches ? `<p class="empty-state">Se necesitan exactamente ${required} equipos registrados para generar el bracket.</p>` : ''}
      </div>
    `;
  }
}

async function handleGenerate(league, teams) {
  const confirmar = await showConfirmDialog('¿Generar todos los partidos? Esta acción no se puede deshacer.');
  if (!confirmar) return;

  if (league.mode === 'liga') {
    await generateFixture(league.id, teams, league.roundFormat);
  } else {
    await generateBracket(league.id, teams);
  }

  showToast('Partidos generados correctamente.', 'success');

  const container = document.getElementById('app');
  renderMatches(container);
}

async function applyFilters(allMatches, teams) {
  const status = document.getElementById('filter-status').value;
  const teamId = document.getElementById('filter-team').value;
  const roundFilterEl = document.getElementById('filter-round');
  const round = roundFilterEl ? roundFilterEl.value : '';

  const filtered = allMatches.filter(m => {
    const matchesStatus = !status || m.status === status;
    const matchesTeam = !teamId || m.homeTeamId === Number(teamId) || m.awayTeamId === Number(teamId);
    const matchesRound = !round || m.round === round;
    return matchesStatus && matchesTeam && matchesRound;
  });

  const activeLeague = await getActiveLeague();
  renderMatchesList(filtered, teams, activeLeague);
}

function renderMatchesList(matches, teams, league) {
  const listEl = document.getElementById('matches-list');

  if (matches.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No hay partidos para mostrar.</p>';
    return;
  }

  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const sorted = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date));

  listEl.innerHTML = sorted.map(m => {
    const home = teamById[m.homeTeamId];
    const away = teamById[m.awayTeamId];
    const scoreText = m.status === 'finalizado' ? `${m.homeScore} - ${m.awayScore}` : 'vs';
    // Solo se puede eliminar en modalidad liga y si el partido sigue programado (sección 4.7.4)
    const canDelete = league.mode === 'liga' && m.status === 'programado';

    return `
      <div class="match-row-wrapper">
        <a href="#match/${m.id}" class="match-card">
          <span>${home ? home.name : 'Por definir'}</span>
          <span><strong>${scoreText}</strong></span>
          <span>${away ? away.name : 'Por definir'}</span>
          <span>${new Date(m.date).toLocaleDateString()}</span>
          <span class="badge ${m.status === 'finalizado' ? 'badge-win' : ''}">${m.status}</span>
          ${m.round ? `<span class="team-chip" style="background-color:#555">${m.round}</span>` : ''}
        </a>
        ${canDelete ? `<button data-id="${m.id}" class="btn-delete-match">Eliminar</button>` : ''}
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.btn-delete-match').forEach(btn => {
    btn.addEventListener('click', (e) => handleDeleteMatch(e));
  });
}

async function handleDeleteMatch(e) {
  const matchId = e.target.getAttribute('data-id');
  const confirmar = await showConfirmDialog('¿Eliminar este partido programado?');
  if (!confirmar) return;

  await deleteMatch(matchId);
  showToast('Partido eliminado correctamente.', 'success');

  const container = document.getElementById('app');
  renderMatches(container);
}

function showMatchForm(league, teams) {
  const formContainer = document.getElementById('match-form-container');

  formContainer.innerHTML = `
    <form id="match-form">
      <h3>Programar Partido</h3>

      <label>Equipo local:
        <select name="homeTeamId" required>
          ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
      </label>

      <label>Equipo visitante:
        <select name="awayTeamId" required>
          ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
      </label>

      <label>Fecha y hora:
        <input type="datetime-local" name="date" required>
      </label>

      <button type="submit">Programar</button>
    </form>
  `;

  document.getElementById('match-form').addEventListener('submit', (e) => handleCreateMatch(e, league));
}

async function handleCreateMatch(e, league) {
  e.preventDefault();
  const formData = new FormData(e.target);

  const homeTeamId = Number(formData.get('homeTeamId'));
  const awayTeamId = Number(formData.get('awayTeamId'));
  const date = formData.get('date');

  if (homeTeamId === awayTeamId) {
    showToast('Un equipo no puede enfrentarse a sí mismo.', 'error');
    return;
  }

  const existing = await getAllByIndex('matches', 'by_league', league.id);
  const duplicate = existing.some(m =>
    m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId &&
    new Date(m.date).getTime() === new Date(date).getTime()
  );
  if (duplicate) {
    showToast('Ya existe un partido con estos equipos en esa misma fecha.', 'error');
    return;
  }

  await add('matches', {
    leagueId: league.id,
    homeTeamId, awayTeamId,
    date: new Date(date).toISOString(),
    status: 'programado',
    homeScore: null, awayScore: null,
    round: null, nextMatchId: null
  });

  showToast('Partido programado correctamente.', 'success');

  const container = document.getElementById('app');
  renderMatches(container);
}

export { renderMatches };
