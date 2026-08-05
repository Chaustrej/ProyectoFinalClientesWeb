import { getActiveLeague } from '../db.js';
import { getTerms } from '../sports-terms.js';

async function updateNavbarLeague() {
  const el = document.getElementById('nav-active-league');
  if (!el) return;

  const activeLeague = await getActiveLeague();

  if (!activeLeague) {
    el.innerHTML = '<span class="no-league">Sin liga activa</span>';
    return;
  }

  const terms = getTerms(activeLeague.sport);
  el.innerHTML = `${terms.icono} <strong>${activeLeague.name}</strong>`;
}

export { updateNavbarLeague };