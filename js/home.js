// Cardapio Quatinga - home.js
// Tela de início do funcionário: saudação, cartão de destaque da semana (fazer/ver pedido,
// trocar de semana), identificação compacta pelo RGF e atalhos (feriado, pagamento, avisos).
// So le o estado (window.__state) e o DOM; quem muda o estado continua sendo ui.js/order.js.

(function (global) {
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const S = function () { return global.__state; };
  const $ = function (id) { return document.getElementById(id); };

  function pad2(n) { return String(n).padStart(2, '0'); }

  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  // "26 – 30 out" (ou "28 out – 01 nov" quando a semana vira o mês)
  function weekRangeShort() {
    const st = S();
    const data = st.currentMenuData || {};
    let monday;
    if (st.viewingNextWeek) monday = data.nextWeekMonday ? new Date(data.nextWeekMonday) : global.getNextMenuMonday(data);
    else monday = data.weekMonday ? new Date(data.weekMonday) : global.__weekCalendar.mondayOf(new Date());
    const friday = global.__weekCalendar.addDays(monday, 4);
    if (monday.getMonth() === friday.getMonth()) return `${pad2(monday.getDate())} – ${pad2(friday.getDate())} ${MESES_ABREV[friday.getMonth()]}`;
    return `${pad2(monday.getDate())} ${MESES_ABREV[monday.getMonth()]} – ${pad2(friday.getDate())} ${MESES_ABREV[friday.getMonth()]}`;
  }

  // "Sexta (30/10) é feriado: Dia do Servidor Público."
  function holidaySentence() {
    const st = S();
    const holidays = st.userActiveHolidays || [];
    if (!holidays.length) return '';
    const data = st.currentMenuData || {};
    let monday;
    if (st.viewingNextWeek) monday = data.nextWeekMonday ? new Date(data.nextWeekMonday) : global.getNextMenuMonday(data);
    else monday = data.weekMonday ? new Date(data.weekMonday) : global.__weekCalendar.mondayOf(new Date());
    const partes = global.weekDays.map((day, i) => {
      if (!holidays.includes(global.getDayId(day))) return null;
      const d = global.__weekCalendar.addDays(monday, i);
      const info = global.isHolidayDate ? global.isHolidayDate(d) : null;
      return `${day.replace('-feira', '')} (${pad2(d.getDate())}/${pad2(d.getMonth() + 1)})${info && info.isHoliday ? ', ' + info.evento : ''}`;
    }).filter(Boolean);
    return partes.length === 1 ? `Sem almoço na ${partes[0]}.` : `Sem almoço: ${partes.join('; ')}.`;
  }

  function isVisible(id) {
    const el = $(id);
    return !!el && !el.classList.contains('hidden');
  }

  function renderHome() {
    const st = S();
    if (!st || !$('home-week')) return;
    const now = new Date();
    $('home-date').textContent = `${DIAS[now.getDay()]}, ${now.getDate()} de ${MESES[now.getMonth()]}`;

    const name = ($('employeeName').value || '').trim();
    const rgf = ($('employeeRGF').value || '').trim();
    const identified = !!(name && rgf);
    const firstName = titleCase(name.split(/\s+/)[0] || '');
    $('home-hello').textContent = identified ? `Olá, ${firstName}` : 'Olá!';

    // Identificação compacta (o campo volta ao tocar em "Trocar" ou se o RGF não existir)
    const editing = $('identity-card').dataset.editing === '1';
    $('identity-compact').classList.toggle('hidden', !identified || editing);
    $('identity-form').classList.toggle('hidden', identified && !editing);
    if (identified) {
      $('identity-avatar').textContent = initials(name);
      $('identity-name').textContent = titleCase(name);
      $('identity-rgf').textContent = `RGF ${rgf}`;
    }

    // Linha da semana (o cartão azul grande saiu: o pedido já fica à vista)
    const hasMenu = !!(st.weeklyMenu && st.weeklyMenu.menuImageBase64);
    const hasNext = !!(st.currentMenuData && st.currentMenuData.nextMenuImageBase64);
    $('hero-kicker').textContent = st.viewingNextWeek ? 'Próxima semana' : 'Esta semana';
    $('hero-range').textContent = hasMenu ? weekRangeShort() : '';
    $('home-week').classList.toggle('hidden', !identified);

    // Trocar de semana (o clique continua no handler do app.js)
    const sw = $('week-badge-indicator');
    sw.classList.toggle('hidden', !(identified && (hasNext || st.viewingNextWeek)));
    $('week-badge-text').textContent = st.viewingNextWeek ? 'Semana atual' : 'Próxima semana';

    // Atalhos
    const feriado = global.getNextHoliday ? global.getNextHoliday() : null;
    if (feriado) {
      const dias = Math.round((feriado.data - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
      $('mini-holiday-title').textContent = feriado.evento.replace(/\s*\(.*\)/, '');
      $('mini-holiday-sub').textContent = `${DIAS[feriado.data.getDay()].slice(0, 3).toLowerCase()}, ${pad2(feriado.data.getDate())}/${pad2(feriado.data.getMonth() + 1)}${dias === 0 ? ' · hoje' : dias === 1 ? ' · amanhã' : ` · em ${dias} dias`}`;
    }
    const pag = global.getNextPaymentEvent ? global.getNextPaymentEvent() : null;
    if (pag) {
      const dias = Math.round((pag.data - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
      $('mini-pay-label').textContent = pag.label;
      $('mini-pay-title').textContent = `${pad2(pag.data.getDate())}/${pad2(pag.data.getMonth() + 1)}`;
      $('mini-pay-sub').textContent = dias === 0 ? 'é hoje' : dias === 1 ? 'é amanhã' : `em ${dias} dias`;
    }

    // Avisos (push): mostra só quando sabemos o estado
    const push = global.__pushStatus || (('Notification' in global) && !(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) ? Notification.permission : null);
    const pushCard = $('home-push');
    pushCard.classList.toggle('hidden', !push);
    if (push) {
      const on = push === 'granted';
      pushCard.classList.toggle('off', !on);
      $('home-push-title').textContent = on ? 'Avisos ativados' : 'Avisos desligados';
      const canAsk = push === 'default' && typeof global.enableWebPush === 'function';
      $('home-push-text').textContent = on ? 'Você recebe o cardápio novo na hora.'
        : canAsk ? 'Toque em Ativar para saber na hora quando o cardápio sair.'
        : 'Libere as notificações nas configurações do celular para saber quando o cardápio sair.';
      $('home-push-enable').classList.toggle('hidden', !canAsk);
    }
  }

  function scrollToEl(id) {
    const el = $(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function bindHome() {
    $('identity-change')?.addEventListener('click', () => {
      $('identity-card').dataset.editing = '1';
      renderHome();
      const input = $('employeeRGF');
      input.focus();
      input.select();
    });
    $('employeeRGF')?.addEventListener('blur', () => {
      // Só fecha o campo se o RGF digitado foi reconhecido
      setTimeout(() => {
        if (($('employeeName').value || '').trim()) { delete $('identity-card').dataset.editing; renderHome(); }
      }, 600);
    });
    $('home-push-enable')?.addEventListener('click', () => { if (global.enableWebPush) global.enableWebPush(); });
    // Trocar de aba volta ao topo da tela
    document.getElementById('user-tabs')?.addEventListener('click', (e) => {
      if (e.target.closest('.admin-tab-btn')) window.scrollTo(0, 0);
    });
    document.getElementById('admin-tabs')?.addEventListener('click', (e) => {
      if (e.target.closest('.admin-tab-btn')) window.scrollTo(0, 0);
    });
    document.querySelectorAll('[data-go-tab]').forEach(b => b.addEventListener('click', () => {
      const tab = document.querySelector(`#user-tabs [data-user-tab="${b.dataset.goTab}"]`);
      if (tab) tab.click();
    }));
  }

  global.renderHome = renderHome;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindHome);
  else bindHome();
})(window);
