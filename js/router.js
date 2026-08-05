import { updateNavbarLeague } from './components/navbar.js';
const routes = {};
function registerRoute(path, renderFn) {
  routes[path] = renderFn;
}

function handleRouteChange() {
  let hash = location.hash.slice(1) || 'dashboard';
  const [routeName, param] = hash.split('/');
  const container = document.getElementById('app');

  if (routes[routeName]) {
    highlightActiveLink(routeName);
    routes[routeName](container, param);
  } else {
    container.innerHTML = '<p>Vista no encontrada</p>';
  }

  updateNavbarLeague();
}

function highlightActiveLink(routeName) {
  document.querySelectorAll('nav a').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + routeName) {
      link.classList.add('active');
    }
  });
}

window.addEventListener('hashchange', handleRouteChange);
function initRouter() {
  handleRouteChange();
}

export { registerRoute, initRouter };