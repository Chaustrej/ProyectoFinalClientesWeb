function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const existing = document.getElementById('confirm-dialog-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirm-dialog-overlay';
    overlay.className = 'dialog-overlay';

    overlay.innerHTML = `
      <div class="dialog-box">
        <p>${message}</p>
        <div class="dialog-actions">
          <button id="confirm-cancel" class="btn-link-secondary">Cancelar</button>
          <button id="confirm-accept">Confirmar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('confirm-accept').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });

    document.getElementById('confirm-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

export { showConfirmDialog };