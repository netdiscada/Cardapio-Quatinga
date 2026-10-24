// Cardapio Quatinga v3 - adminNotify.js
// Aba Dev do ADM: aviso personalizado para os funcionarios, quem recebe notificacoes
// e verificacao manual de atualizacao do APK. O envio passa pelo Cloudflare Worker
// (callNotifyEndpoint em notificationTrigger.js), que confere se quem chama e o ADM.

(function (global) {
  const esc = global.escapeHtml;

  function bindCustomNotify() {
    const form = document.getElementById('custom-notify-form');
    if (!form) return;
    const title = document.getElementById('custom-notify-title');
    const body = document.getElementById('custom-notify-body');
    const alsoAdmin = document.getElementById('custom-notify-admin');
    const count = document.getElementById('custom-notify-count');
    const btn = document.getElementById('custom-notify-send');

    body.addEventListener('input', () => { count.textContent = `${body.value.length}/300`; });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = title.value.trim();
      const b = body.value.trim();
      if (!t || !b) { showToast('Escreva o título e a mensagem.', 'error'); return; }
      showCustomConfirm(`Enviar "${t}" para todos os funcionários?`, async () => {
        btn.disabled = true; btn.textContent = 'Enviando...';
        try {
          const r = await global.callNotifyEndpoint({ type: 'custom', title: t, body: b, alsoAdmin: alsoAdmin.checked });
          if (r.error) throw new Error(r.error);
          showToast(`Aviso enviado para ${r.sent} aparelho(s).`, 'success', 5000);
          title.value = ''; body.value = ''; count.textContent = '0/300';
          loadStats();
        } catch (err) {
          showToast('Não foi possível enviar: ' + err.message, 'error', 6000);
        } finally {
          btn.disabled = false; btn.textContent = 'Enviar para todos';
        }
      });
    });
  }

  async function loadStats() {
    const box = document.getElementById('notify-stats');
    if (!box) return;
    box.textContent = 'Carregando...';
    try {
      const s = await global.callNotifyEndpoint({ type: 'stats' });
      if (s.error) throw new Error(s.error);
      const faltam = s.semAviso.length
        ? `<p class="mt-3 font-semibold text-orange-600 dark:text-orange-400">Ainda não ativaram (${s.semAviso.length}):</p>
           <ul class="mt-1 list-disc pl-5">${s.semAviso.map(f => `<li>${esc(f.nome || 'Sem nome')} <span class="text-gray-400">(RGF ${esc(f.rgf)})</span></li>`).join('')}</ul>
           <p class="mt-2 text-xs text-gray-500">Peça para abrirem o app ou o site, digitarem o RGF e tocarem em "Ativar notificações".</p>`
        : '<p class="mt-3 font-semibold text-green-600 dark:text-green-400">Todos os funcionários recebem notificações. ✅</p>';
      box.innerHTML = `
        <p><b>${s.comAviso}</b> de <b>${s.funcionarios}</b> funcionários recebem notificações.</p>
        <p class="mt-1 text-xs text-gray-500">Aparelhos: ${s.aparelhos.app} no app · ${s.aparelhos.site} no site · ${s.aparelhos.adm} do ADM${s.aparelhos.semRgf ? ` · ${s.aparelhos.semRgf} sem RGF` : ''}</p>
        ${faltam}`;
    } catch (err) {
      box.textContent = 'Erro ao carregar: ' + err.message;
    }
  }

  function bindUpdateCheck() {
    const btn = document.getElementById('dev-check-update');
    if (!btn) return;
    const isNative = !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
    if (!isNative) { btn.classList.add('hidden'); return; }
    btn.addEventListener('click', () => global.manualUpdateCheck && global.manualUpdateCheck());
  }

  function init() {
    bindCustomNotify();
    bindUpdateCheck();
    const refresh = document.getElementById('notify-stats-refresh');
    if (refresh) refresh.addEventListener('click', loadStats);
    // Carrega sozinho quando o ADM abre a aba Dev
    const devTab = document.querySelector('#admin-tabs [data-admin-tab="dev"]');
    if (devTab) devTab.addEventListener('click', loadStats);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
