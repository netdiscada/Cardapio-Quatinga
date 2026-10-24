// Cardapio Quatinga v3 - appUpdate.js
// Ponte para o atualizador nativo do APK (plugin AppUpdater, em android/ no PC-DO-HERMES).
// A verificação automática roda no lado nativo sempre que o app abre; aqui só expomos a
// versão instalada e a verificação manual. No navegador/PWA não há nada a fazer: o site
// já é sempre a versão publicada.

(function (global) {
  function getPlugin() {
    const cap = global.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.AppUpdater) || null;
  }

  function showToast(msg, type = 'info') {
    if (global.showToast) {
      global.showToast(msg, type, 5000);
    } else {
      console.log('[appUpdate]', type.toUpperCase(), ':', msg);
    }
  }

  // Verificação manual (ex: botão no menu). Os avisos aparecem como toast nativo.
  async function check() {
    const plugin = getPlugin();
    if (!plugin) {
      showToast('O site já está na versão mais recente.', 'success');
      return null;
    }
    try {
      return await plugin.check({ interactive: true });
    } catch (e) {
      console.error('[appUpdate] Erro ao verificar:', e);
      showToast('Erro ao verificar atualização: ' + e.message, 'error');
      return null;
    }
  }

  async function getCurrentVersion() {
    const plugin = getPlugin();
    if (!plugin) return null;
    try {
      return (await plugin.getInfo()).versionName;
    } catch (e) {
      return null;
    }
  }

  global.manualUpdateCheck = check;
  global.AppUpdate = { check, getCurrentVersion };
})(window);
