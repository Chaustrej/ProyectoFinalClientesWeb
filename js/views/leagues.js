import { getAllLeagues, add, setActiveLeague, exportLeague, validateImportData, importLeague, deleteLeagueCascade } from '../db.js';
import { SPORTS_TERMS } from '../sports-terms.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
import { seedSampleLeague } from '../seedData.js';

async function renderLeagues(container) {
  const leagues = await getAllLeagues();

  container.innerHTML = `
    <h1>Ligas</h1>
    <div class="league-actions">
      <button id="btn-new-league">+ Nueva Liga</button>
      <button id="btn-import-league" class="btn-link-secondary">Importar liga (JSON)</button>
      <button id="btn-seed-demo" class="btn-link-secondary">Cargar liga de ejemplo</button>
      <input type="file" id="import-file-input" accept=".json" style="display:none">
    </div>
    <div id="leagues-list"></div>
    <div id="league-form-container"></div>
  `;

  renderLeaguesList(leagues);

  document.getElementById('btn-new-league')
    .addEventListener('click', showLeagueForm);

  document.getElementById('btn-import-league')
    .addEventListener('click', () => document.getElementById('import-file-input').click());

  document.getElementById('import-file-input')
    .addEventListener('change', handleImportFile);

  document.getElementById('btn-seed-demo').addEventListener('click', async () => {
    await seedSampleLeague();
    showToast('Liga de ejemplo cargada correctamente.', 'success');
    const container = document.getElementById('app');
    renderLeagues(container);
  });
}

function renderLeaguesList(leagues) {
  const listEl = document.getElementById('leagues-list');

  if (leagues.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Todavía no hay ligas creadas. Crea la primera.</p>';
    return;
  }

  listEl.innerHTML = leagues.map(league => `
    <div class="league-card ${league.isActive ? 'active' : ''}">
      <h3>${league.name} ${league.isActive ? '✅ (activa)' : ''}</h3>
      <p>Deporte: ${SPORTS_TERMS[league.sport]?.nombre || league.sport}</p>
      <p>Modalidad: ${league.mode === 'liga' ? 'Liga' : 'Eliminación directa'}</p>
      <p>Temporada: ${league.season}</p>
      ${!league.isActive ? `<button data-id="${league.id}" class="btn-activate">Activar</button>` : ''}
      <button data-id="${league.id}" class="btn-export">Exportar JSON</button>
      <button data-id="${league.id}" class="btn-delete-league">Eliminar</button>
    </div>
  `).join('');

  // IMPORTANTE: estos dos listeners van SEPARADOS, no anidados uno dentro del otro
  listEl.querySelectorAll('.btn-activate').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await setActiveLeague(id);
      location.hash = '#dashboard';
    });
  });

  listEl.querySelectorAll('.btn-delete-league').forEach(btn => {
    btn.addEventListener('click', (e) => handleDeleteLeague(e.target.getAttribute('data-id')));
  });

  listEl.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', (e) => handleExport(e.target.getAttribute('data-id')));
  });
}

function showLeagueForm() {
  const formContainer = document.getElementById('league-form-container');

  const sportOptions = Object.keys(SPORTS_TERMS)
    .map(key => `<option value="${key}">${SPORTS_TERMS[key].nombre}</option>`)
    .join('');

  formContainer.innerHTML = `
    <form id="league-form">
      <h3>Nueva Liga</h3>

      <label>Nombre:
        <input type="text" name="name" required>
      </label>

      <label>Deporte:
        <select name="sport" required>${sportOptions}</select>
      </label>

      <label>Modalidad:
        <select name="mode" id="mode-select" required>
          <option value="liga">Liga (todos contra todos)</option>
          <option value="eliminacion">Eliminación directa</option>
        </select>
      </label>

      <div id="mode-options"></div>

      <label>Temporada:
        <input type="text" name="season" placeholder="ej: 2026-I" required>
      </label>

      <button type="submit">Crear liga</button>
    </form>
  `;

  const modeSelect = document.getElementById('mode-select');
  const modeOptions = document.getElementById('mode-options');

  function updateModeOptions() {
    if (modeSelect.value === 'liga') {
      modeOptions.innerHTML = `
        <label>Formato:
          <select name="roundFormat">
            <option value="una">Una vuelta</option>
            <option value="doble">Ida y vuelta</option>
          </select>
        </label>
      `;
    } else {
      modeOptions.innerHTML = `
        <label>Número de equipos:
          <select name="bracketSize">
            <option value="4">4</option>
            <option value="8">8</option>
            <option value="16">16</option>
          </select>
        </label>
      `;
    }
  }

  updateModeOptions();
  modeSelect.addEventListener('change', updateModeOptions);

  document.getElementById('league-form').addEventListener('submit', handleCreateLeague);
}

async function handleCreateLeague(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const league = {
    name: formData.get('name').trim(),
    sport: formData.get('sport'),
    mode: formData.get('mode'),
    season: formData.get('season').trim(),
    isActive: false,
    roundFormat: formData.get('roundFormat') || null,
    bracketSize: formData.get('bracketSize') ? Number(formData.get('bracketSize')) : null
  };

  if (!league.name) {
    showToast('El nombre es obligatorio.', 'error');
    return;
  }

  try {
    await add('leagues', league);
    showToast('Liga creada correctamente.', 'success');
    const container = document.getElementById('app');
    renderLeagues(container);
  } catch (err) {
    // El índice by_name es único: si el nombre ya existe, IndexedDB rechaza la operación
    showToast('Ya existe una liga con ese nombre. Elige otro.', 'error');
  }
}

// Genera y descarga el archivo JSON de la liga
async function handleExport(leagueId) {
  const data = await exportLeague(leagueId);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.league.name.replace(/\s+/g, '_')}.json`;
  a.click();

  URL.revokeObjectURL(url);
}
async function handleDeleteLeague(leagueId) {
  const confirmar = await showConfirmDialog('¿Eliminar esta liga? Se borrarán también todos sus equipos, jugadores y partidos. Esta acción no se puede deshacer.');
  if (!confirmar) return;

  await deleteLeagueCascade(leagueId);
  showToast('Liga eliminada correctamente.', 'success');

  const container = document.getElementById('app');
  renderLeagues(container);
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!validateImportData(data)) {
      showToast('El archivo no tiene el formato esperado de una liga de LeagueHub.', 'error');
      return;
    }

    const existingLeagues = await getAllLeagues();
    let finalName = data.league.name;

    if (existingLeagues.some(l => l.name === data.league.name)) {
      const newName = prompt(`Ya existe una liga llamada "${data.league.name}". Escribe un nuevo nombre, o cancela para abortar:`);
      if (!newName) return;
      finalName = newName;
    }

    await importLeague(data, finalName);
    showToast('Liga importada correctamente.', 'success');

    const container = document.getElementById('app');
    renderLeagues(container);
} catch (err) {
    const msg = err && err.message ? err.message : 'Formato de archivo inválido.';
    showToast('Error al leer el archivo: ' + msg, 'error');
  } finally {
    e.target.value = '';
  }
}

export { renderLeagues };
