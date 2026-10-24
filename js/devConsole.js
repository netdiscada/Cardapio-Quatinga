// Cardapio Quatinga v3 - devConsole.js
// Console de desenvolvedor da aba Dev do ADM: guarda console.log/info/warn/error, erros de
// JavaScript e promessas rejeitadas desde a abertura do app e mostra tudo no painel.
// Carregado logo depois do config.js, para pegar os erros de inicialização também.
// Botões: Limpar Logs, Exportar Logs, Limpar Cache SW e Testar PDF Share.

(function (global) {
  const MAX_ENTRIES = 500;
  const entries = [];
  let errorCount = 0;
  let onlyErrors = false;
  let renderQueued = false;

  function stringify(value) {
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    try {
      const json = JSON.stringify(value);
      return json && json.length > 1500 ? json.slice(0, 1500) + '…' : json;
    } catch (e) {
      return String(value);
    }
  }

  function add(level, args) {
    const text = Array.prototype.map.call(args, stringify).join(' ');
    // Imagens em base64 entopem o console sem ajudar ninguém
    const clean = text.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]{40,}/g, '[imagem base64]');
    entries.push({ time: new Date(), level, text: clean });
    if (entries.length > MAX_ENTRIES) entries.shift();
    if (level === 'error') errorCount++;
    scheduleRender();
  }

  // ===== Captura =====
  ['log', 'info', 'warn', 'error'].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = function () {
      try { add(level, arguments); } catch (e) { /* nunca quebrar o console */ }
      original.apply(null, arguments);
    };
  });

  global.addEventListener('error', (event) => {
    // Erro de carregamento de arquivo (script/imagem) não tem event.error
    if (event.target && event.target !== global && (event.target.src || event.target.href)) {
      const url = event.target.src || event.target.href;
      // <img src=""> de propósito (antes do cardápio carregar) aponta para a própria página: não é erro
      if (event.target.getAttribute('src') === '' || url === location.href) return;
      add('error', [`Falha ao carregar ${event.target.tagName}: ${url}`]);
      return;
    }
    const where = event.filename ? ` (${event.filename.split('/').pop()}:${event.lineno}:${event.colno})` : '';
    add('error', [event.error || event.message, where]);
  }, true);

  global.addEventListener('unhandledrejection', (event) => {
    add('error', ['Promessa rejeitada sem tratamento:', event.reason]);
  });

  // ===== Painel =====
  const COLORS = { log: '#86efac', info: '#93c5fd', warn: '#fde047', error: '#fca5a5' };
  const ICONS = { log: '·', info: 'ℹ', warn: '⚠', error: '✖' };

  function pad(n) { return String(n).padStart(2, '0'); }
  function timeOf(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => { renderQueued = false; render(); }, 200);
  }

  function render() {
    const box = document.getElementById('dev-log-console');
    if (!box) return;
    const list = onlyErrors ? entries.filter(e => e.level === 'error' || e.level === 'warn') : entries;
    const counter = document.getElementById('dev-log-count');
    if (counter) counter.textContent = `${entries.length} registros · ${errorCount} erro${errorCount === 1 ? '' : 's'}`;
    if (!list.length) {
      box.innerHTML = `<span style="color:#9ca3af">${onlyErrors ? 'Nenhum erro registrado. ✅' : 'Nenhum registro ainda.'}</span>`;
      return;
    }
    const nearBottom = box.parentElement && (box.parentElement.scrollHeight - box.parentElement.scrollTop - box.parentElement.clientHeight < 40);
    box.innerHTML = list.map(e =>
      `<div style="color:${COLORS[e.level]};border-bottom:1px solid #1f2937;padding:2px 0">` +
      `<span style="color:#6b7280">${timeOf(e.time)}</span> ${ICONS[e.level]} ${escapeHtml(e.text)}</div>`
    ).join('');
    if (nearBottom && box.parentElement) box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }

  function reportText() {
    const cap = global.Capacitor;
    const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
    const header = [
      'Cardápio Quatinga — logs do desenvolvedor',
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      `Plataforma: ${native ? 'APK Android' : 'Site'} · ${navigator.userAgent}`,
      `Endereço: ${location.href}`,
      `Online: ${navigator.onLine ? 'sim' : 'não'}`,
      `Erros: ${errorCount} · Registros: ${entries.length}`,
      ''.padEnd(60, '=')
    ];
    const lines = entries.map(e => `${e.time.toLocaleString('pt-BR')} [${e.level.toUpperCase()}] ${e.text}`);
    return header.concat(lines).join('\n');
  }

  async function exportLogs() {
    const text = reportText();
    const fileName = `cardapio-logs-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
    const cap = global.Capacitor;
    const plugins = cap && cap.Plugins;
    try {
      if (cap && cap.isNativePlatform && cap.isNativePlatform() && plugins.Filesystem && plugins.Share) {
        const { uri } = await plugins.Filesystem.writeFile({ path: fileName, data: text, directory: 'CACHE', encoding: 'utf8' });
        await plugins.Share.share({ title: 'Logs do Cardápio Quatinga', files: [uri], dialogTitle: 'Enviar logs' });
        return;
      }
      const file = new File([text], fileName, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Logs do Cardápio Quatinga', files: [file] });
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      global.showToast && global.showToast('Logs baixados.', 'success');
    } catch (err) {
      if (err && (err.name === 'AbortError' || /cancel/i.test(err.message))) return;
      try {
        await navigator.clipboard.writeText(text);
        global.showToast && global.showToast('Não deu para salvar o arquivo; os logs foram copiados.', 'info', 5000);
      } catch (e) {
        console.error('[Dev] Falha ao exportar logs:', err);
        global.showToast && global.showToast('Falha ao exportar os logs.', 'error');
      }
    }
  }

  async function clearCacheAndReload() {
    global.showToast && global.showToast('Limpando cache e recarregando...', 'info', 3000);
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if (global.caches) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
    } catch (e) {
      console.warn('[Dev] Erro ao limpar cache:', e);
    }
    setTimeout(() => location.reload(), 800);
  }

  async function testPdfShare() {
    try {
      if (!global.jspdf || !global.sharePdfBlob) throw new Error('jsPDF ou compartilhamento indisponível');
      const doc = new global.jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text('Cardápio Quatinga — PDF de teste', 15, 25);
      doc.setFontSize(11);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 35);
      doc.text('Se este arquivo abriu ou foi compartilhado, o PDF está funcionando.', 15, 45);
      console.info('[Dev] Gerando PDF de teste');
      await global.sharePdfBlob(doc.output('blob'), 'Teste-Cardapio-Quatinga.pdf');
    } catch (err) {
      console.error('[Dev] Teste de PDF falhou:', err);
      global.showToast && global.showToast('Teste de PDF falhou: ' + err.message, 'error', 6000);
    }
  }

  function bind() {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('dev-clear-logs', () => { entries.length = 0; errorCount = 0; render(); });
    on('dev-export-logs', exportLogs);
    on('dev-clear-cache', clearCacheAndReload);
    on('dev-test-pdf-share', testPdfShare);
    const filter = document.getElementById('dev-log-only-errors');
    if (filter) filter.addEventListener('change', () => { onlyErrors = filter.checked; render(); });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  global.devConsole = { entries, reportText, render };
})(window);
