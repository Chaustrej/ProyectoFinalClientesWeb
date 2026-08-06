import { openDB } from './db.js';
import { registerRoute } from './router.js';
import { renderLeagues } from './views/leagues.js';
import { renderTeams } from './views/teams.js';
import { renderTeamDetail } from './views/teamDetail.js';
import { renderPlayers } from './views/players.js';
import { renderPlayerDetail } from './views/playerDetail.js';
import { renderMatches } from './views/matches.js';
import { renderMatchDetail } from './views/matchDetail.js';
import { renderStats } from './views/stats.js';
import { renderDashboard } from './views/dashboard.js';
import { updateNavbarLeague } from './components/navbar.js';
import { setDbStatus } from './components/footer.js';

function renderPlaceholder(nombreVista) {
  return (container) => {
    container.innerHTML = `<h1>${nombreVista}</h1><p>Vista en construcción.</p>`;
  };
}
registerRoute('dashboard', renderDashboard);
registerRoute('leagues', renderLeagues);
registerRoute('teams', renderPlaceholder('Equipos'));
registerRoute('players', renderPlaceholder('Jugadores'));
registerRoute('matches', renderPlaceholder('Partidos'));
registerRoute('stats', renderPlaceholder('Estadísticas'));
registerRoute('teams', renderTeams);
registerRoute('team', renderTeamDetail);
registerRoute('players', renderPlayers);
registerRoute('player', renderPlayerDetail);
registerRoute('matches', renderMatches);
registerRoute('match', renderMatchDetail);
registerRoute('stats', renderStats);
registerRoute('players', renderPlayers);
import { initRouter } from './router.js';

openDB()
  .then(() => {
    console.log('Base de datos lista');
    setDbStatus(true);
    initRouter();
  })
  .catch((err) => {
    console.error('Error al abrir la base de datos:', err);
    setDbStatus(false);
  });