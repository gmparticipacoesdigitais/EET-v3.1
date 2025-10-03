import { mountAuthGate } from './auth/gate';
import { logout } from './auth/service';

/** Boot */
(async () => {
  mountAuthGate((uid) => {
    const root = document.getElementById('app')!;
    root.innerHTML = `
      <h1>Bem-vindo, ${uid}</h1>
      <button id="sair" aria-label="Sair">Sair</button>
    `;

    document.getElementById('sair')!.addEventListener('click', async () => {
      logout();
      location.assign('/login.html');
    });
  });
})();
