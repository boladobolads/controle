(() => {
  const root = document.getElementById('guest-details');
  if (!root) return;
  const makeToken = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String(values[0] % 1000000).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1 $2');
  };
  const enhance = () => {
    [...root.children].forEach(card => {
      if (card.dataset.demoReady) return;
      const status = card.querySelector('p:nth-child(2)');
      if (!status || status.textContent.trim() !== 'LIBERADO PELO PROPRIETÁRIO') return;
      card.dataset.demoReady = '1';
      const panel = document.createElement('div');
      panel.className = 'mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-slate-900';
      const caption = document.createElement('p');
      caption.className = 'text-xs font-bold uppercase tracking-wide text-emerald-900';
      caption.textContent = 'Teste de abertura · demonstração';
      const tokenLabel = document.createElement('p');
      tokenLabel.className = 'mt-3 text-xs font-semibold text-emerald-900';
      tokenLabel.textContent = 'TOKEN TEMPORÁRIO DE TESTE';
      const token = document.createElement('p');
      token.className = 'mt-1 font-mono text-3xl font-black tracking-widest text-emerald-950';
      token.textContent = makeToken();
      const timer = document.createElement('p');
      timer.className = 'mt-1 text-xs text-emerald-800';
      timer.textContent = 'Novo token em 30 segundos';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'mt-4 w-full rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white active:scale-[.99]';
      toggle.textContent = 'SIMULAR ABERTURA';
      const result = document.createElement('p');
      result.className = 'mt-2 text-center text-xs font-semibold text-emerald-900';
      result.textContent = 'Estado simulado: FECHADO';
      toggle.addEventListener('click', () => {
        const opened = toggle.dataset.opened !== '1';
        toggle.dataset.opened = opened ? '1' : '0';
        toggle.textContent = opened ? 'SIMULAR FECHAMENTO' : 'SIMULAR ABERTURA';
        result.textContent = opened ? 'Estado simulado: ABERTO' : 'Estado simulado: FECHADO';
        result.className = 'mt-2 text-center text-xs font-semibold ' + (opened ? 'text-emerald-700' : 'text-emerald-900');
      });
      panel.append(caption, tokenLabel, token, timer, toggle, result);
      card.append(panel);
      card._rotateDemoToken = () => {
        token.textContent = makeToken();
        timer.textContent = 'Novo token em 30 segundos';
      };
    });
  };
  const observer = new MutationObserver(enhance);
  observer.observe(root, { childList: true, subtree: true });
  enhance();
  setInterval(() => {
    [...root.children].forEach(card => {
      if (card._rotateDemoToken) card._rotateDemoToken();
    });
  }, 30000);
})();