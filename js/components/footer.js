function setDbStatus(connected) {
  const el = document.getElementById('db-status');
  if (!el) return;

  if (connected) {
    el.innerHTML = 'Base de datos: <span class="status-ok">✅ Conectado</span>';
  } else {
    el.innerHTML = 'Base de datos: <span class="status-error">❌ Error de conexión</span>';
  }
}

export { setDbStatus };