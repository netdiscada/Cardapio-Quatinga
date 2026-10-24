// Cardapio Quatinga v3 - installHelper.js
// Ajuda o funcionario que usa o SITE a receber notificacoes:
//  - Android/computador: oferece "Instalar" (vira um app na tela inicial)
//  - iPhone/iPad: a Apple so entrega notificacao de site instalado na Tela de Inicio,
//    entao mostra o passo a passo de "Adicionar a Tela de Inicio"
// No APK nao faz nada. O botao "Ativar notificacoes" fica em pushRegistration.js.

(function (global) {
  const DISMISS_KEY = 'installHelperDismissedAt';
  const DISMISS_DAYS = 7;

  const isNative = !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const isStandalone = (global.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function recentlyDismissed() {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return Date.now() - at < DISMISS_DAYS * 24 * 3600 * 1000;
    } catch (e) { return false; }
  }

  function dismiss(banner) {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    banner.remove();
  }

  function showBanner(html, actionLabel, onAction) {
    if (document.getElementById('install-helper-banner')) return;
    const host = document.getElementById('user-view');
    if (!host) return;
    const banner = document.createElement('div');
    banner.id = 'install-helper-banner';
    banner.className = 'mb-4 p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 text-gray-800 dark:text-gray-100 text-sm';
    banner.innerHTML = `<div class="font-bold text-base mb-1">📲 Receba os avisos do cardápio</div><div>${html}</div>
      <div class="mt-3 flex gap-2 justify-end">
        <button type="button" data-act="later" class="px-3 py-1.5 rounded-lg font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">Agora não</button>
        ${actionLabel ? `<button type="button" data-act="go" class="px-4 py-1.5 rounded-lg font-bold bg-blue-600 text-white cursor-pointer">${actionLabel}</button>` : ''}
      </div>`;
    banner.querySelector('[data-act="later"]').addEventListener('click', () => dismiss(banner));
    const go = banner.querySelector('[data-act="go"]');
    if (go) go.addEventListener('click', () => onAction(banner));
    host.insertBefore(banner, host.firstChild);
  }

  function init() {
    if (isNative || isStandalone || recentlyDismissed()) return;

    if (isIOS) {
      showBanner('No iPhone, os avisos só chegam com o Cardápio na Tela de Início:<br>' +
        '1. Toque em <b>Compartilhar</b> (o quadrado com a seta ↑)<br>' +
        '2. Toque em <b>Adicionar à Tela de Início</b><br>' +
        '3. Abra o Cardápio pelo ícone novo e toque em <b>Ativar notificações</b>',
        'Entendi', (banner) => dismiss(banner));
      return;
    }

    // Android/computador: o navegador avisa quando da para instalar
    global.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      showBanner('Instale o Cardápio na tela inicial: abre mais rápido, funciona sem internet e recebe os avisos de cardápio novo.',
        'Instalar', async (banner) => {
          event.prompt();
          const choice = await event.userChoice.catch(() => null);
          if (choice && choice.outcome === 'accepted') banner.remove();
          else dismiss(banner);
        });
    });
  }

  global.addEventListener('appinstalled', () => {
    const banner = document.getElementById('install-helper-banner');
    if (banner) banner.remove();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
