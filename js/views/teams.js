import { getActiveLeague, getTeamsByLeague, getMatchesByTeam, add, deleteTeamCascade, remove, isTeamNameTaken } from '../db.js';
import { getTerms } from '../sports-terms.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';

async function renderTeams(container) {
  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    container.innerHTML = `
      <h1>Equipos</h1>
      <p class="empty-state">Primero debes tener una liga activa. <a href="#leagues">Ir a Ligas</a></p>
    `;
    return;
  }

  const teams = await getTeamsByLeague(activeLeague.id);
  const terms = getTerms(activeLeague.sport);

  container.innerHTML = `
    <h1>Equipos ${terms.icono} — ${activeLeague.name}</h1>
    <button id="btn-new-team">+ Nuevo Equipo</button>
    <div id="teams-list"></div>
    <div id="team-form-container"></div>
  `;

  renderTeamsList(teams, activeLeague.id);

  document.getElementById('btn-new-team')
    .addEventListener('click', () => showTeamForm(activeLeague.id));
}

function renderTeamsList(teams, leagueId) {
  const listEl = document.getElementById('teams-list');

  if (teams.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Todavía no hay equipos. Agrega el primero.</p>';
    return;
  }

  listEl.innerHTML = teams.map(team => `
    <div class="team-card" style="border-left: 4px solid ${team.primaryColor || '#ccc'}">
      <div class="card-header">
        ${team.shield
          ? `<img src="${team.shield}" alt="${team.name}" class="shield-img" onerror="this.style.display='none'">`
          : `<div class="shield-placeholder" style="background-color: ${team.primaryColor}">${getInitials(team.name)}</div>`
        }
        <h3>${team.name}</h3>
      </div>
      <p>${team.city || 'Sin sede registrada'}</p>
      <a href="#team/${team.id}" class="btn-link">Ver detalle</a>
      <button data-id="${team.id}" class="btn-delete-team">Eliminar</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.btn-delete-team').forEach(btn => {
    btn.addEventListener('click', (e) => handleDeleteTeam(e, leagueId));
  });
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function showTeamForm(leagueId) {
  const formContainer = document.getElementById('team-form-container');

  formContainer.innerHTML = `
    <form id="team-form">
      <h3>Nuevo Equipo</h3>

      <label>Nombre:
        <input type="text" name="name" required>
      </label>

      <label>Escudo (URL, opcional):
        <input type="url" name="shield">
      </label>

      <label>Color principal:
        <input type="color" name="primaryColor" value="#2e7d32">
      </label>

      <label>Color secundario:
        <input type="color" name="secondaryColor" value="#ffffff">
      </label>

      <label>Ciudad / Sede (opcional):
        <input type="text" name="city">
      </label>

      <button type="submit">Crear equipo</button>
    </form>
  `;

  document.getElementById('team-form').addEventListener('submit', (e) => handleCreateTeam(e, leagueId));
}

async function handleCreateTeam(e, leagueId) {
  e.preventDefault();
  const formData = new FormData(e.target);

  const team = {
    name: formData.get('name').trim(),
    shield: formData.get('shield').trim() || null,
    primaryColor: formData.get('primaryColor'),
    secondaryColor: formData.get('secondaryColor'),
    city: formData.get('city').trim() || null,
    leagueId: Number(leagueId),
    played: 0, won: 0, drawn: 0, lost: 0,
    scoredFor: 0, scoredAgainst: 0, points: 0
  };

  if (!team.name) {
    showToast('El nombre es obligatorio.', 'error');
    return;
  }

  const taken = await isTeamNameTaken(leagueId, team.name);
  if (taken) {
    showToast('Ya existe un equipo con ese nombre en esta liga.', 'error');
    return;
  }

  await add('teams', team);
  showToast('Equipo creado correctamente.', 'success');

  const container = document.getElementById('app');
  renderTeams(container);
}

async function handleDeleteTeam(e, leagueId) {
  const teamId = e.target.getAttribute('data-id');

  const matches = await getMatchesByTeam(teamId);
  if (matches.length > 0) {
    showToast('No se puede eliminar: este equipo tiene partidos jugados o programados.', 'error');
    return;
  }

  const confirmar = await showConfirmDialog('¿Eliminar este equipo y todos sus jugadores?');
  if (!confirmar) return;

  await deleteTeamCascade(teamId);
  showToast('Equipo eliminado correctamente.', 'success');

  const container = document.getElementById('app');
  renderTeams(container);
}

export { renderTeams };
