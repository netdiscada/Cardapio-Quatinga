// Cardapio Quatinga - adminHome.js
// Painel do ADM no estilo da tela do funcionario: topo compacto, cartao azul de resumo
// (quantos ja pediram) e mini cartoes que abrem os blocos antigos numa janela que sobe
// de baixo. Os blocos sao MOVIDOS (nao copiados), entao os eventos ja ligados continuam.

(function (global) {
  const $ = function (id) { return document.getElementById(id); };
  const S = function () { return global.__state; };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  let current = null; // { el, parent, next }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function rangeOf(monday) {
    const friday = global.__weekCalendar.addDays(monday, 4);
    if (monday.getMonth() === friday.getMonth()) return `${pad2(monday.getDate())} – ${pad2(friday.getDate())} ${MESES_ABREV[friday.getMonth()]}`;
    return `${pad2(monday.getDate())} ${MESES_ABREV[monday.getMonth()]} – ${pad2(friday.getDate())} ${MESES_ABREV[friday.getMonth()]}`;
  }

  // ===== Janela =====
  function openPop(blockId, title) {
    const el = $(blockId);
    if (!el) return;
    closePop();
    current = { el, parent: el.parentNode, next: el.nextSibling };
    $('adm-pop-title').textContent = title || '';
    $('adm-pop-body').appendChild(el);
    $('adm-pop').classList.remove('hidden');
    document.body.classList.add('pop-open');
    if (blockId === 'dev-block-stats') $('notify-stats-refresh')?.click();
    if (blockId === 'dev-block-ai' && global.loadAiConfig) global.loadAiConfig();
    if (blockId === 'menutext-card' && global.renderMenuTextEditor) global.renderMenuTextEditor();
  }

  function closePop() {
    if (current) {
      current.parent.insertBefore(current.el, current.next);
      current = null;
    }
    $('adm-pop')?.classList.add('hidden');
    document.body.classList.remove('pop-open');
    renderAdminHome();
  }

  // ===== Resumo =====
  function renderAdminHome() {
    const st = S();
    if (!st || !$('adm-hero')) return;
    const now = new Date();
    $('adm-date').textContent = `${DIAS[now.getDay()]}, ${now.getDate()} de ${MESES[now.getMonth()]}`;
    const data = st.currentMenuData || {};
    const monday = data.weekMonday ? new Date(data.weekMonday) : global.__weekCalendar.mondayOf(now);
    $('adm-hero-range').textContent = rangeOf(monday);

    const stats = global.__adminStats;
    if (stats) {
      const faltam = stats.pending || [];
      $('adm-hero-title').textContent = stats.total ? `${stats.done} de ${stats.total} já pediram` : 'Nenhum funcionário cadastrado';
      $('adm-hero-text').textContent = !faltam.length ? 'Todos fizeram o pedido desta semana.'
        : `Faltam: ${faltam.slice(0, 6).join(', ')}${faltam.length > 6 ? ` e mais ${faltam.length - 6}` : ''}.`;
      $('adm-orders-title').textContent = `${stats.done} de ${stats.total}`;
      $('adm-orders-sub').textContent = faltam.length ? `${faltam.length} ainda não pediram` : 'todos pediram';
    }

    const hasNext = !!data.nextMenuImageBase64;
    if (hasNext) {
      const nextMonday = data.nextWeekMonday ? new Date(data.nextWeekMonday) : global.getNextMenuMonday(data);
      $('adm-next-title').textContent = 'Lançado';
      $('adm-next-sub').textContent = `semana ${rangeOf(nextMonday)}`;
    } else {
      $('adm-next-title').textContent = 'Lançar cardápio';
      $('adm-next-sub').textContent = 'foto, feriados e recado';
    }
    $('adm-cur-title').textContent = data.menuImageBase64 ? 'No ar' : 'Sem cardápio';
    $('adm-cur-sub').textContent = data.targetRotationDate ? `vira em ${new Date(data.targetRotationDate).toLocaleDateString('pt-BR')}` : 'ver e virar semana';
    const hasText = Object.keys(data.menuText || {}).length > 0;
    $('adm-text-title').textContent = hasText ? 'Preenchido' : 'Sem texto';
    $('adm-text-sub').textContent = hasText ? 'funcionários veem os pratos' : 'preencher com IA';
  }

  function bind() {
    if (!$('adm-pop')) return;
    document.addEventListener('click', (e) => {
      const pop = e.target.closest('[data-pop]');
      if (pop) { openPop(pop.dataset.pop, pop.dataset.popTitle); return; }
      const go = e.target.closest('[data-go-admin-tab]');
      if (go) document.querySelector(`#admin-tabs [data-admin-tab="${go.dataset.goAdminTab}"]`)?.click();
    });
    $('adm-pop-close').addEventListener('click', closePop);
    $('adm-pop').addEventListener('click', (e) => { if (e.target.id === 'adm-pop') closePop(); });
    // Trocar de aba fecha a janela
    $('admin-tabs')?.addEventListener('click', () => { if (current) closePop(); });
    renderAdminHome();
  }

  global.renderAdminHome = renderAdminHome;
  global.closeAdminPop = closePop;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})(window);
