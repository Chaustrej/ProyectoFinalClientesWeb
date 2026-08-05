import { getActiveLeague, getPlayersByLeague, getTeamsByLeague, getEventsByPlayer, add, remove, isPlayerNumberTaken } from '../db.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';

let allPlayersCache = [];
let debounceTimer = null;

async function renderPlayers(container, presetTeamId) {
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    container.innerHTML = `
      <h1>Jugadores</h1>
      <p class="empty-state">Primero debes tener una liga activa. <a href="#leagues">Ir a Ligas</a></p>
    `;
    return;
  }

  const teams = await getTeamsByLeague(activeLeague.id);

  if (teams.length === 0) {
    container.innerHTML = `
      <h1>Jugadores</h1>
      <p class="empty-state">Primero registra equipos. <a href="#teams" class="btn-link">Ir a Equipos</a></p>
    `;
    return;
  }

  allPlayersCache = await getPlayersByLeague(activeLeague.id);
  const positions = [...new Set(allPlayersCache.map(p => p.position).filter(Boolean))];

  container.innerHTML = `
    <h1>Jugadores</h1>

    <div class="filters">
      <input type="text" id="filter-search" placeholder="Buscar por nombre...">

      <select id="filter-team">
        <option value="">Todos los equipos</option>
        ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
      </select>

      <select id="filter-position">
        <option value="">Todas las posiciones</option>
        ${positions.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>

      <button id="btn-clear-filters" class="btn-link-secondary">Limpiar filtros</button>
    </div>

    <button id="btn-new-player">+ Nuevo Jugador</button>
    <div id="players-list" class="players-grid"></div>
    <div id="player-form-container"></div>
  `;

  renderPlayersList(allPlayersCache);

  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 350);
  });

  document.getElementById('filter-team').addEventListener('change', applyFilters);
  document.getElementById('filter-position').addEventListener('change', applyFilters);

  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-team').value = '';
    document.getElementById('filter-position').value = '';
    renderPlayersList(allPlayersCache);
  });

  document.getElementById('btn-new-player')
    .addEventListener('click', () => showPlayerForm(teams, presetTeamId));

  // Si venimos desde "Agregar jugador" en el detalle de un equipo,
  // preseleccionamos el filtro y abrimos el formulario ya con ese equipo elegido
  if (presetTeamId) {
    document.getElementById('filter-team').value = presetTeamId;
    applyFilters();
    showPlayerForm(teams, presetTeamId);
  }
}

function applyFilters() {
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const teamId = document.getElementById('filter-team').value;
  const position = document.getElementById('filter-position').value;

  const filtered = allPlayersCache.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search);
    const matchesTeam = !teamId || p.teamId === Number(teamId);
    const matchesPosition = !position || p.position === position;
    return matchesSearch && matchesTeam && matchesPosition;
  });

  renderPlayersList(filtered);
}

function renderPlayersList(players) {
  const listEl = document.getElementById('players-list');

  if (players.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No se encontraron jugadores.</p>';
    return;
  }

  listEl.innerHTML = players.map(p => `
    <div class="player-card" style="--team-color: ${p.teamPrimaryColor || '#ccc'}">
      <a href="#player/${p.id}">
        ${p.photo
          ? `<img src="${p.photo}" alt="${p.name}" class="player-photo" onerror="this.style.display='none'">`
          : `<div class="player-photo-placeholder" style="background-color: ${p.teamPrimaryColor || 'var(--color-primario)'}">${p.name[0].toUpperCase()}</div>`
        }
        <span class="player-name"><strong>${p.name}</strong> #${p.number || '-'}</span>
        <span class="team-chip" style="background-color: ${p.teamPrimaryColor || '#999'}">${p.teamName}</span><br>
        <span>${p.position || 'Sin posición'}</span>
      </a>
      <button data-id="${p.id}" class="btn-delete-player">Eliminar</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.btn-delete-player').forEach(btn => {
    btn.addEventListener('click', handleDeletePlayer);
  });
}

async function handleDeletePlayer(e) {
  const playerId = e.target.getAttribute('data-id');

  const events = await getEventsByPlayer(playerId);
  if (events.length > 0) {
    showToast('No se puede eliminar: este jugador tiene anotaciones registradas en partidos.', 'error');
    return;
  }

  const confirmar = await showConfirmDialog('¿Eliminar este jugador?');
  if (!confirmar) return;

  await remove('players', playerId);
  showToast('Jugador eliminado correctamente.', 'success');

  const container = document.getElementById('app');
  renderPlayers(container);
}

function showPlayerForm(teams, presetTeamId) {
  const formContainer = document.getElementById('player-form-container');

  formContainer.innerHTML = `
    <form id="player-form">
      <h3>Nuevo Jugador</h3>

      <label>Nombre:
        <input type="text" name="name" required>
      </label>

      <label>Foto (URL, opcional):
        <input type="url" name="photo">
      </label>

      <label>Posición:
        <input type="text" name="position" placeholder="ej: Defensor">
      </label>

      <label>Número:
        <input type="number" name="number" min="0">
      </label>

      <label>Equipo:
        <select name="teamId" required>
          ${teams.map(t => `<option value="${t.id}" ${presetTeamId && t.id === Number(presetTeamId) ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
      </label>

      <button type="submit">Crear jugador</button>
    </form>
  `;

  document.getElementById('player-form').addEventListener('submit', handleCreatePlayer);
}

async function handleCreatePlayer(e) {
  e.preventDefault();
  const formData = new FormData(e.target);

  const player = {
    name: formData.get('name').trim(),
    photo: formData.get('photo').trim() || null,
    position: formData.get('position').trim() || null,
    number: formData.get('number') ? Number(formData.get('number')) : null,
    teamId: Number(formData.get('teamId')),
    matchesPlayed: 0,
    totalScored: 0
  };

  if (!player.name) {
    showToast('El nombre es obligatorio.', 'error');
    return;
  }

  const taken = await isPlayerNumberTaken(player.teamId, player.number);
  if (taken) {
    showToast('Ya existe un jugador con ese número en este equipo.', 'error');
    return;
  }

  await add('players', player);
  showToast('Jugador creado correctamente.', 'success');

  const container = document.getElementById('app');
  renderPlayers(container);
}

export { renderPlayers };
