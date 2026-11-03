// Cardapio Quatinga v3 - installHelper.js
// Ajuda o funcionario que usa o SITE a receber os avisos do cardapio:
//  - Ao abrir o site: pede para ativar as notificacoes (aviso na tela; o navegador so deixa
//    mostrar a janela de permissao depois de um toque, principalmente no iPhone)
//  - Botao "Instalar" no topo (Android/computador: janela de instalacao do navegador;
//    iPhone/iPad: passo a passo de "Adicionar a Tela de Inicio", pois a Apple so entrega
//    notificacao de site instalado)
//  - Botao de notificacoes no topo: ativa, mostra que esta ativo ou explica como desbloquear
// No APK nao faz nada (o app pede a permissao sozinho em pushRegistration.js).

(function (global) {
  const INSTALL_DISMISS_KEY = 'installHelperDismissedAt';
  const NOTIFY_DISMISS_KEY = 'notifyPromptDismissedAt';
  const INSTALL_DISMISS_DAYS = 7;
  const NOTIFY_DISMISS_DAYS = 3;

  const isNative = !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const isStandalone = (global.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const notifySupported = 'Notification' in global && 'serviceWorker' in navigator;

  let installEvent = null; // evento beforeinstallprompt guardado para o botao "Instalar"

  const $ = (id) => document.getElementById(id);

  function recentlyDismissed(key, days) {
    try {
      const at = Number(localStorage.getItem(key) || 0);
      return Date.now() - at < days * 24 * 3600 * 1000;
    } catch (e) { return false; }
  }

  function remember(key) {
    try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* sem storage */ }
  }

  // ===== Aviso na tela (um por vez) =====
  function closeBanner() {
    const banner = $('install-helper-banner');
    if (banner) banner.remove();
  }

  function showBanner({ title, html, actionLabel, onAction, onLater, kind }) {
    if ($('install-helper-banner')) return;
    const host = $('user-view');
    if (!host) return;
    const banner = document.createElement('div');
    banner.id = 'install-helper-banner';
    banner.dataset.kind = kind || '';
    banner.className = 'mb-4 p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 text-gray-800 dark:text-gray-100 text-sm';
    banner.innerHTML = `<div class="font-bold text-base mb-1">${title}</div><div>${html}</div>
      <div class="mt-3 flex gap-2 justify-end">
        <button type="button" data-act="later" class="px-3 py-1.5 rounded-lg font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">Agora não</button>
        ${actionLabel ? `<button type="button" data-act="go" class="px-4 py-1.5 rounded-lg font-bold bg-blue-600 text-white cursor-pointer">${actionLabel}</button>` : ''}
      </div>`;
    banner.querySelector('[data-act="later"]').addEventListener('click', () => { if (onLater) onLater(); closeBanner(); });
    const go = banner.querySelector('[data-act="go"]');
    if (go) go.addEventListener('click', () => onAction(banner));
    host.insertBefore(banner, host.firstChild);
  }

  // ===== Notificacoes =====
  function permission() {
    return notifySupported ? Notification.permission : 'unsupported';
  }

  // Pede a permissao (precisa vir de um toque) e registra o aparelho para receber os avisos
  async function enableNotifications() {
    if (!notifySupported) return 'unsupported';
    let perm = Notification.permission;
    if (perm === 'default') {
      try { perm = await Notification.requestPermission(); } catch (e) { perm = Notification.permission; }
    }
    global.__pushStatus = perm;
    if (perm === 'granted') {
      if (global.registerWebPush) global.registerWebPush();
      if (global.showToast) global.showToast('Notificações ativadas!', 'success');
    } else if (perm === 'denied' && global.showToast) {
      global.showToast('As notificações estão bloqueadas neste navegador.', 'error', 5000);
    }
    if (global.renderHome) global.renderHome();
    refreshButtons();
    return perm;
  }

  function showNotifyPrompt() {
    if (isNative || !notifySupported || permission() !== 'default') return;
    if (recentlyDismissed(NOTIFY_DISMISS_KEY, NOTIFY_DISMISS_DAYS)) return;
    showBanner({
      kind: 'notify',
      title: '🔔 Ative os avisos do cardápio',
      html: 'Receba uma notificação assim que o cardápio da semana for lançado, sem precisar abrir o site para conferir.',
      actionLabel: 'Ativar notificações',
      onAction: async () => {
        const perm = await enableNotifications();
        if (perm !== 'default') closeBanner();
        else remember(NOTIFY_DISMISS_KEY);
      },
      onLater: () => remember(NOTIFY_DISMISS_KEY)
    });
  }

  // ===== Instalacao =====
  function showIosSteps() {
    closeBanner();
    showBanner({
      title: '📲 Instalar no iPhone',
      html: 'No iPhone, os avisos só chegam com o Cardápio na Tela de Início:<br>' +
        '1. Toque em <b>Compartilhar</b> (o quadrado com a seta ↑)<br>' +
        '2. Toque em <b>Adicionar à Tela de Início</b><br>' +
        '3. Abra o Cardápio pelo ícone novo e toque em <b>Ativar notificações</b>',
      actionLabel: 'Entendi',
      onAction: () => closeBanner(),
      onLater: () => remember(INSTALL_DISMISS_KEY)
    });
    window.scrollTo(0, 0);
  }

  async function installApp() {
    if (installEvent) {
      const ev = installEvent;
      installEvent = null; // o navegador só aceita usar o evento uma vez
      ev.prompt();
      const choice = await ev.userChoice.catch(() => null);
      // Se recusar, o botão some até o navegador oferecer de novo (o evento só vale uma vez)
      refreshButtons();
      return;
    }
    if (isIOS) { showIosSteps(); return; }
    if (global.showToast) global.showToast('Para instalar, abra o menu ⋮ do navegador e toque em "Instalar app" ou "Adicionar à tela inicial".', 'info', 7000);
  }

  // ===== Botoes do topo =====
  function refreshButtons() {
    const install = $('installAppBtn');
    const notify = $('notifyBtn');
    // Permissão já decidida (pelo aviso do navegador, por exemplo): o pedido de ativar some
    const banner = $('install-helper-banner');
    if (banner && banner.dataset.kind === 'notify' && permission() !== 'default') banner.remove();
    if (install) {
      // Aparece quando da para instalar: o navegador avisou (Android/computador) ou e iPhone fora do app instalado
      const canInstall = !isNative && !isStandalone && (!!installEvent || isIOS);
      install.classList.toggle('hidden', !canInstall);
    }
    if (notify) {
      const show = !isNative && notifySupported;
      notify.classList.toggle('hidden', !show);
      if (show) {
        const perm = permission();
        const label = notify.querySelector('span');
        notify.classList.toggle('is-on', perm === 'granted');
        notify.classList.toggle('is-off', perm === 'denied');
        if (label) label.textContent = perm === 'granted' ? 'Avisos ativos' : perm === 'denied' ? 'Bloqueado' : 'Ativar avisos';
        notify.setAttribute('aria-label', perm === 'granted' ? 'Notificações ativadas' : perm === 'denied' ? 'Notificações bloqueadas' : 'Ativar notificações');
      }
    }
  }

  function bindButtons() {
    $('installAppBtn')?.addEventListener('click', installApp);
    $('notifyBtn')?.addEventListener('click', async () => {
      const perm = permission();
      if (perm === 'granted') {
        if (global.showToast) global.showToast('Os avisos de cardápio já estão ativados neste aparelho.', 'success');
      } else if (perm === 'denied') {
        if (global.showToast) global.showToast('Notificações bloqueadas. Toque no cadeado ao lado do endereço do site, abra "Permissões" e permita as notificações.', 'info', 8000);
      } else {
        await enableNotifications();
        closeBanner();
      }
    });
    // Se a pessoa mudar a permissao nas configuracoes do navegador, o botao acompanha
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'notifications' }).then(status => {
          status.onchange = () => { global.__pushStatus = permission(); refreshButtons(); if (global.renderHome) global.renderHome(); };
        }).catch(() => {});
      }
    } catch (e) { /* navegador sem esta consulta */ }
  }

  function init() {
    if (isNative) return;
    bindButtons();
    refreshButtons();

    // Android/computador: o navegador avisa quando da para instalar
    global.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      installEvent = event;
      refreshButtons();
      // Aviso na tela so se nao houver outro e a pessoa nao dispensou faz pouco tempo
      if (!isStandalone && !$('install-helper-banner') && !recentlyDismissed(INSTALL_DISMISS_KEY, INSTALL_DISMISS_DAYS) && permission() !== 'default') {
        showBanner({
          title: '📲 Instale o Cardápio',
          html: 'Instale na tela inicial: abre mais rápido, funciona sem internet e recebe os avisos de cardápio novo.',
          actionLabel: 'Instalar',
          onAction: async () => { await installApp(); closeBanner(); },
          onLater: () => remember(INSTALL_DISMISS_KEY)
        });
      }
    });

    // Ao abrir o site: pede para ativar as notificacoes
    showNotifyPrompt();

    // iPhone fora do app instalado: passo a passo (a Apple so entrega aviso de site instalado)
    if (isIOS && !isStandalone && !$('install-helper-banner') && !recentlyDismissed(INSTALL_DISMISS_KEY, INSTALL_DISMISS_DAYS)) showIosSteps();
  }

  global.addEventListener('appinstalled', () => {
    installEvent = null;
    closeBanner();
    refreshButtons();
  });

  global.enableNotifications = enableNotifications;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
