// Cardapio Quatinga v3 - ui.js
// Helpers de UI: showToast, showCustomConfirm, dark-mode, wizard, holidays,
// showUserView/showAdminView/updateUserViewUI, renderOrdersTable, openEditOrderModal,
// renderOrderStatus, setAdminTab, handleImageLoad.
// Carregado em 5o lugar no index.html. Escopo global via window.

(function (global) {
  const fb = global.fb;
  const weekDays = global.weekDays;
  const mealOptions = global.mealOptions;
  const getDayId = global.getDayId;
  const esc = global.escapeHtml;
  // Estado compartilhado (definido em app.js)
  const S = function () { return global.__state; };

  // ===== Sistema de Notificacoes (toast) =====
  function showToast(message, type = 'info', duration = 4000) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = message;
    // Remove o tipo do toast anterior (senao 'error' + 'success' ficam juntos)
    toast.classList.remove('success', 'error', 'info');
    toast.classList.add('show', type);
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ===== Modal generico de confirmacao =====
  function showCustomConfirm(message, onConfirm) {
    const modal = document.getElementById('custom-confirm-modal');
    document.getElementById('custom-confirm-message').textContent = message;
    modal.classList.remove('hidden');
    document.getElementById('custom-confirm-ok-btn').onclick = () => {
      onConfirm();
      modal.classList.add('hidden');
    };
  }

  // ===== Dark mode =====
  const darkModeToggleBtn = document.getElementById('darkModeToggle');
  // Tema: Automático (segue o celular) -> Claro -> Escuro (theme.js)
  const THEME_LABELS = {
    auto: { nome: 'Automático', curto: 'Auto', icone: '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"></path>' },
    light: { nome: 'Claro', curto: 'Claro', icone: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>' },
    dark: { nome: 'Escuro', curto: 'Escuro', icone: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"></path>' }
  };
  function updateDarkModeButton() {
    if (!darkModeToggleBtn) return;
    const mode = global.Theme ? global.Theme.getMode() : 'light';
    const t = THEME_LABELS[mode] || THEME_LABELS.light;
    darkModeToggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t.icone}</svg><span>${t.curto}</span>`;
    darkModeToggleBtn.setAttribute('aria-label', `Tema: ${t.nome}. Toque para trocar`);
  }
  function toggleDarkMode() {
    if (global.Theme) global.Theme.cycle();
    updateDarkModeButton();
    const t = THEME_LABELS[global.Theme ? global.Theme.getMode() : 'light'];
    showToast(`Tema: ${t.nome}`, 'info', 1800);
  }
  global.addEventListener('themechange', updateDarkModeButton);

  // ===== Wizard do funcionario =====
  // ===== Pedido: chips dos dias + opções do dia =====
  const SHORT_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const OPTION_ICONS = [
    '<path d="M4 15a8 8 0 0 1 16 0z"></path><path d="M2.5 18.5h19M12 7V5.5"></path>',
    '<path d="M3 11h18a9 9 0 0 1-18 0z"></path><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"></path>',
    '<circle cx="10" cy="12" r="7"></circle><circle cx="10" cy="12" r="2.8"></circle><path d="M16.5 15.5L21 20"></path>',
    '<path d="M14.5 3.5a6 6 0 0 1 6 6c0 4-4 6-7 6l-2.5 2.5"></path><path d="M11 18l-3 3M8.5 15.5l-3 .5-1.5 1.5 2.5 2.5 1.5-1.5.5-3"></path>'
  ];
  const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';

  // Segunda-feira da semana que o funcionário está vendo (atual ou próxima)
  function getViewedMonday() {
    const st = S();
    const data = st.currentMenuData || {};
    if (st.viewingNextWeek) return data.nextWeekMonday ? new Date(data.nextWeekMonday) : global.getNextMenuMonday(data);
    return data.weekMonday ? new Date(data.weekMonday) : global.__weekCalendar.mondayOf(new Date());
  }

  function getWeekDates() {
    const monday = getViewedMonday();
    return weekDays.map((_, i) => global.__weekCalendar.addDays(monday, i));
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Nome do prato do dia, quando o ADM digitou o cardápio (menuText); senão a descrição padrão
  function getDishText(dayId, optIndex) {
    const mt = (S().weeklyMenu.menuText || {})[dayId];
    if (!mt || typeof mt !== 'object') return '';
    if (optIndex === 0) return mt.principal || '';
    if (optIndex === 1) return mt.opcao || '';
    return '';
  }

  function isDayDone(st, i) { return !!(st.userChoices[i] && st.userChoices[i].choice); }

  // Próximo dia sem escolha depois de "from" (dá a volta na semana); -1 se todos feitos
  function findPendingDay(st, from) {
    for (let k = 1; k <= weekDays.length; k++) {
      const i = (from + k) % weekDays.length;
      if (!isDayDone(st, i)) return i;
    }
    return -1;
  }

  // Feriados entram sozinhos como "FERIADO"; dia que deixou de ser feriado volta a pedir escolha
  function syncHolidayChoices(st) {
    weekDays.forEach((day, i) => {
      const isHoliday = st.userActiveHolidays.includes(getDayId(day));
      if (isHoliday) st.userChoices[i] = { day, choice: 'FERIADO', notes: '' };
      else if (st.userChoices[i] && st.userChoices[i].choice === 'FERIADO') st.userChoices[i] = undefined;
    });
  }

  function renderWizardStep(index) {
    const st = S();
    const wizardContainer = document.getElementById('order-wizard-container');
    if (!st.dayNotes) st.dayNotes = {};
    clearTimeout(st.wizardAdvanceTimer);
    syncHolidayChoices(st);
    // Índice fora da semana (ou dia já resolvido no início) = vai para o primeiro dia pendente
    if (!(index >= 0 && index < weekDays.length)) {
      const pending = findPendingDay(st, weekDays.length - 1);
      index = pending === -1 ? 0 : pending;
    }
    st.currentDayIndex = index;
    wizardContainer.classList.remove('hidden');

    const dates = getWeekDates();
    const day = weekDays[index];
    const dayId = getDayId(day);
    const isHoliday = st.userActiveHolidays.includes(dayId);
    const current = st.userChoices[index];

    document.getElementById('wizard-days').innerHTML = weekDays.map((d, i) => {
      const holiday = st.userActiveHolidays.includes(getDayId(d));
      const done = !holiday && isDayDone(st, i);
      const cls = ['day-chip', i === index ? 'active' : '', holiday ? 'holiday' : '', done ? 'done' : ''].join(' ');
      const mark = holiday ? '<span class="chip-mark">feriado</span>' : (done ? `<span class="chip-mark">${CHECK_ICON}</span>` : '<span class="chip-mark"></span>');
      const label = `${d}, ${pad2(dates[i].getDate())}/${pad2(dates[i].getMonth() + 1)}${holiday ? ', feriado' : (done ? ', escolhido' : '')}`;
      return `<button type="button" role="tab" class="${cls}" data-day-index="${i}" aria-selected="${i === index}" aria-label="${label}"><span class="chip-day">${SHORT_DAYS[i]}</span><span class="chip-date">${pad2(dates[i].getDate())}</span>${mark}</button>`;
    }).join('');

    document.getElementById('wizard-day-title').textContent = `${day.replace('-feira', '')} · ${pad2(dates[index].getDate())}/${pad2(dates[index].getMonth() + 1)}`;
    document.getElementById('wizard-day-hint').classList.toggle('hidden', isHoliday);
    document.getElementById('wizard-holiday').classList.toggle('hidden', !isHoliday);
    document.getElementById('wizard-notes-label').classList.toggle('hidden', isHoliday);
    const holidayInfo = isHoliday && global.isHolidayDate ? global.isHolidayDate(dates[index]) : null;
    document.getElementById('wizard-holiday-name').textContent = holidayInfo && holidayInfo.isHoliday ? holidayInfo.evento : 'Feriado';
    const dayText = (st.weeklyMenu.menuText || {})[dayId];
    const garnish = !isHoliday && dayText && typeof dayText === 'object' ? (dayText.guarnicao || '') : '';
    document.getElementById('wizard-garnish').textContent = garnish ? 'Guarnição: ' + garnish : '';
    document.getElementById('wizard-garnish').classList.toggle('hidden', !garnish);

    const optionsContainer = document.getElementById('wizard-options');
    optionsContainer.classList.toggle('hidden', isHoliday);
    optionsContainer.innerHTML = isHoliday ? '' : mealOptions.map((opt, i) => {
      const on = current && current.choice === opt.name;
      const dish = getDishText(dayId, i);
      return `<button type="button" data-value="${esc(opt.name)}" aria-pressed="${!!on}" class="wizard-btn option-card${on ? ' selected' : ''}">
        <span class="option-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${OPTION_ICONS[i] || OPTION_ICONS[0]}</svg></span>
        <span class="option-text"><span class="option-name">${esc(opt.name)}</span><span class="option-desc${dish ? ' dish' : ''}">${esc(dish || opt.description)}</span></span>
        ${on ? `<span class="option-check">${CHECK_ICON}</span>` : ''}
      </button>`;
    }).join('');

    const notesInput = document.getElementById('wizard-notes');
    notesInput.value = st.dayNotes[index] || (current && current.choice !== 'FERIADO' ? current.notes || '' : '');
    // Observação fica recolhida; o botão mostra "Obs. ✓" quando o dia já tem uma
    const notesToggle = document.getElementById('wizard-notes-toggle');
    document.getElementById('order-wizard').classList.remove('notes-open');
    notesToggle.classList.toggle('hidden', isHoliday);
    notesToggle.classList.toggle('has-note', !!notesInput.value);
    notesToggle.textContent = notesInput.value ? 'Obs. ✓' : '+ Obs.';
    notesToggle.setAttribute('aria-expanded', 'false');
    updateWizardProgress();
  }

  function updateWizardProgress() {
    const st = S();
    const workDays = weekDays.filter(d => !st.userActiveHolidays.includes(getDayId(d))).length;
    const done = weekDays.filter((d, i) => !st.userActiveHolidays.includes(getDayId(d)) && isDayDone(st, i)).length;
    const complete = findPendingDay(st, weekDays.length - 1) === -1;
    document.getElementById('wizard-progress-text').textContent = workDays === 0
      ? 'Semana sem almoço (feriados)'
      : (complete ? 'Tudo escolhido' : `${done} de ${workDays} dias`);
    document.getElementById('wizard-progress-fill').style.width = `${workDays ? Math.round(done / workDays * 100) : 100}%`;
    const nextBtn = document.getElementById('wizard-next');
    nextBtn.classList.toggle('ready', complete);
    document.getElementById('wizard-next-text').textContent = complete ? 'Revisar pedido' : 'Próximo dia';
  }

  // Data da semana em texto ("02 a 06/11") para a revisão do pedido
  function getWeekRangeText() {
    const dates = getWeekDates();
    const first = dates[0], last = dates[dates.length - 1];
    return `${pad2(first.getDate())}/${pad2(first.getMonth() + 1)} a ${pad2(last.getDate())}/${pad2(last.getMonth() + 1)}`;
  }

  // ===== Feriados (legado - checkboxes) =====
  function renderHolidayCheckboxes() {
    const st = S();
    const container = document.getElementById('holiday-selector');
    if (!container) return;
    container.innerHTML = '';
    const savedNextHolidays = st.currentMenuData.nextHolidays || [];
    weekDays.forEach(day => {
      const dayId = getDayId(day);
      const isChecked = savedNextHolidays.includes(dayId) ? 'checked' : '';
      container.innerHTML += `<label class="flex items-center space-x-2 cursor-pointer select-none bg-white dark:bg-slate-800 p-2 rounded shadow-sm border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition"><input type="checkbox" value="${dayId}" class="holiday-checkbox w-5 h-5 text-orange-500 rounded focus:ring-orange-500" ${isChecked}><span class="text-gray-700 dark:text-slate-300 font-bold">${day}</span></label>`;
    });
  }

  // ===== Troca de views (user / admin) =====
  async function showUserView() {
    const st = S();
    if (st.adminUnsubscribe) { st.adminUnsubscribe(); st.adminUnsubscribe = null; }
    st.allOrders = [];
    const containerOrders = document.getElementById('ordersTableContainer');
    if (containerOrders) containerOrders.innerHTML = '<p class="text-gray-500 font-medium">A carregar pedidos...</p>';
    document.getElementById('admin-view').classList.add('hidden');
    document.getElementById('admin-login-modal').classList.add('hidden');
    document.getElementById('user-view').classList.remove('hidden');
    // v3.2: bottom bar do funcionario visivel apenas na visao de usuario
    document.body.classList.add('show-user-tabs');
    const rgfInput = document.getElementById('employeeRGF');
    if (!rgfInput.value && localStorage.getItem('employeeRGF')) { rgfInput.value = localStorage.getItem('employeeRGF'); }
    // Nome salvo neste aparelho: o pedido já aparece com o cardápio salvo, sem esperar a internet
    const nameInput = document.getElementById('employeeName');
    if (rgfInput.value && !nameInput.value) nameInput.value = global.cachedEmployeeName(rgfInput.value);
    // O cardápio começa a carregar junto (antes esperava o nome do funcionário chegar)
    global.loadAndDisplayMenu();
    // Quando o nome chega, refaz a tela do pedido (o cardápio pode ter chegado antes)
    if (rgfInput.value && await global.findEmployeeByRGF(rgfInput.value)) await global.validateForm();
    // Inicia checker de notificações para funcionário
    if (global.startNotificationChecker) {
      global.startNotificationChecker(false, rgfInput.value, document.getElementById('employeeName').value);
    }
  }

  function showAdminView() {
    const st = S();
    document.getElementById('user-view').classList.add('hidden');
    document.getElementById('admin-view').classList.remove('hidden');
    // v3.2: esconde a bottom bar do funcionario
    document.body.classList.remove('show-user-tabs');
    document.getElementById('admin-login-modal').classList.add('hidden');
    localStorage.setItem('currentAppView', 'admin');
    // Foca na Proxima Semana se ela ja existir na hora de abrir o painel
    setAdminTab(!!st.currentMenuData.nextMenuImageBase64);
    // Renderiza a aba Cardápio (onde fica o calendário de feriados)
    if (global.showAdminPanel) global.showAdminPanel('menu');
    global.loadAndDisplayMenu();
    global.loadAndRenderEmployees();
    // Inicia checker de notificações para admin
    if (global.startNotificationChecker) {
      global.startNotificationChecker(true, 'admin', 'Admin');
    }
  }

  // ===== Abas admin (semana atual / proxima) =====
  function setAdminTab(isNextWeek) {
    const st = S();
    st.adminViewingNextWeek = isNextWeek;
    const curBtn = document.getElementById('admin-view-current');
    const nextBtn = document.getElementById('admin-view-next');
    if (isNextWeek) {
      nextBtn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-orange-600', 'dark:text-orange-400');
      nextBtn.classList.remove('text-gray-600', 'dark:text-slate-400', 'hover:bg-gray-200', 'dark:hover:bg-slate-700');
      curBtn.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-orange-600', 'dark:text-orange-400');
      curBtn.classList.add('text-gray-600', 'dark:text-slate-400', 'hover:bg-gray-200', 'dark:hover:bg-slate-700');
    } else {
      curBtn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-orange-600', 'dark:text-orange-400');
      curBtn.classList.remove('text-gray-600', 'dark:text-slate-400', 'hover:bg-gray-200', 'dark:hover:bg-slate-700');
      nextBtn.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-orange-600', 'dark:text-orange-400');
      nextBtn.classList.add('text-gray-600', 'dark:text-slate-400', 'hover:bg-gray-200', 'dark:hover:bg-slate-700');
    }
    global.loadAdminData();
    // Garante que o calendário de feriados seja (re)criado e os feriados preselecionados
    // sempre que a aba Próxima Semana for ativada
    if (isNextWeek && global.bindHolidayCalendarHandlers) {
      global.bindHolidayCalendarHandlers();
    }
  }

  // ===== Tabela de pedidos =====
  // Nome curto da opção para caber no cartão
  function shortChoice(choice) {
    const c = String(choice || '');
    if (c === 'Prato Principal') return 'Principal';
    if (c === 'Filé de frango') return 'Frango';
    return c;
  }

  function renderOrdersTable(orders) {
    const st = S();
    const container = document.getElementById('ordersTableContainer');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const holidays = (st.adminViewingNextWeek ? st.currentMenuData.nextHolidays : st.currentMenuData.holidays) || [];
    const filteredOrders = orders.filter(doc => doc.data().employeeName.toLowerCase().includes(searchTerm));

    // Resumo por dia (o que a cozinha precisa saber): quantos de cada opção
    const summary = weekDays.map((day, i) => {
      const dayId = getDayId(day);
      const allHoliday = orders.length > 0 && orders.every(doc => doc.data()[dayId] === 'FERIADO');
      if (holidays.includes(dayId) || allHoliday) return `<div class="day-sum holiday"><strong>${day.slice(0, 3)}</strong><span>Feriado</span></div>`;
      const counts = {};
      orders.forEach(doc => { const c = doc.data()[dayId]; if (c && c !== 'FERIADO') counts[c] = (counts[c] || 0) + 1; });
      const parts = mealOptions.map(o => counts[o.name] ? `<span>${shortChoice(o.name)} <b>${counts[o.name]}</b></span>` : '').join('');
      return `<div class="day-sum"><strong>${day.slice(0, 3)}</strong>${parts || '<span>—</span>'}</div>`;
    }).join('');

    if (filteredOrders.length === 0) {
      container.innerHTML = `<div class="day-sums">${summary}</div><p class="empty-note">Nenhum pedido encontrado nesta seleção.</p>`;
      return;
    }
    const cards = filteredOrders.map(doc => {
      const order = doc.data();
      const days = weekDays.map(day => {
        const dayId = getDayId(day);
        const choice = order[dayId];
        const notes = order[`${dayId}_notes`];
        if (choice === 'FERIADO' || holidays.includes(dayId)) return `<span class="o-day holiday"><small>${day.slice(0, 3)}</small>Feriado</span>`;
        if (!choice) return `<span class="o-day empty"><small>${day.slice(0, 3)}</small>—</span>`;
        return `<span class="o-day"${notes ? ` title="${esc(notes)}"` : ''}><small>${day.slice(0, 3)}</small>${esc(shortChoice(choice))}${notes ? '<i>obs.</i>' : ''}</span>`;
      }).join('');
      const notesList = weekDays.map(day => {
        const n = order[`${getDayId(day)}_notes`];
        return n ? `<li><b>${day.slice(0, 3)}:</b> ${esc(n)}</li>` : '';
      }).join('');
      return `<div class="order-row">
        <div class="order-row-head">
          <div><strong>${esc(order.employeeName)}</strong><span>RGF ${esc(order.employeeRGF || '—')}</span></div>
          <div class="order-row-actions">
            <button type="button" data-id="${doc.id}" class="edit-order-btn btn-ghost">Editar</button>
            <button type="button" data-id="${doc.id}" data-name="${esc(order.employeeName)}" class="delete-order-btn btn-ghost danger">Excluir</button>
          </div>
        </div>
        <div class="o-days">${days}</div>
        ${notesList ? `<ul class="o-notes">${notesList}</ul>` : ''}
      </div>`;
    }).join('');
    container.innerHTML = `<div class="day-sums">${summary}</div><div class="order-rows">${cards}</div>`;
  }

  // ===== Status de pedidos (ja pediram / nao pediram) =====
  async function renderOrderStatus(orders) {
    const container = document.getElementById('order-status-container');
    container.innerHTML = '<p class="text-gray-500 font-medium">A processar...</p>';
    try {
      const employeeSnapshot = await fb.getDocs(fb.query(global.getFuncionariosCollectionRef(), fb.orderBy("nome")));
      const allEmployees = employeeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const orderedRGFs = new Set(orders.map(orderDoc => orderDoc.data().employeeRGF));
      const haveOrdered = allEmployees.filter(emp => orderedRGFs.has(emp.id));
      const haveNotOrdered = allEmployees.filter(emp => !orderedRGFs.has(emp.id));
      global.__adminStats = { done: haveOrdered.length, total: allEmployees.length, pending: haveNotOrdered.map(e => String(e.nome || '').split(/\s+/)[0]) };
      if (global.renderAdminHome) global.renderAdminHome();
      const chips = (list, cls) => list.map(e => `<span class="name-chip ${cls}">${esc(e.nome)}</span>`).join('');
      let html = `<div class="status-pills">
          <div class="status-pill ok"><b>${haveOrdered.length}</b><span>já pediram</span></div>
          <div class="status-pill ${haveNotOrdered.length ? 'warn' : 'ok'}"><b>${haveNotOrdered.length}</b><span>faltam</span></div>
        </div>
        ${haveNotOrdered.length ? `<p class="status-label">Ainda não pediram</p><div class="name-chips">${chips(haveNotOrdered, 'warn')}</div>` : '<p class="status-label">Todos os funcionários fizeram o pedido.</p>'}
        ${haveOrdered.length ? `<details class="status-more"><summary>Ver quem já pediram (${haveOrdered.length})</summary><div class="name-chips">${chips(haveOrdered, 'ok')}</div></details>` : ''}`;
      container.innerHTML = html;
    } catch (error) { container.innerHTML = '<p class="text-red-500 font-bold">Falha ao carregar status.</p>'; }
  }

  // ===== Editar pedido (modal) =====
  function openEditOrderModal(orderId) {
    const st = S();
    const orderDoc = st.allOrders.find(d => d.id === orderId);
    if (!orderDoc) return;
    const order = orderDoc.data();
    document.getElementById('edit-order-id').value = orderId;
    document.getElementById('edit-order-employeeName').value = order.employeeName;
    const optionsContainer = document.getElementById('edit-menu-options');
    optionsContainer.innerHTML = '';
    const editHolidays = st.adminViewingNextWeek ? (st.currentMenuData.nextHolidays || []) : (st.currentMenuData.holidays || []);
    weekDays.forEach(day => {
      const dayId = getDayId(day);
      if (editHolidays.includes(dayId)) return;
      const currentChoice = order[dayId] || '';
      const currentNotes = order[`${dayId}_notes`] || '';
      let selectHTML = `<select id="edit-choice-${dayId}" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg mb-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 font-medium"><option value="">(Nenhuma opção selecionada)</option>${mealOptions.map(opt => `<option value="${opt.name}" ${currentChoice === opt.name ? 'selected' : ''}>${opt.name}</option>`).join('')}</select>`;
      optionsContainer.innerHTML += `<div class="p-3 border rounded-lg bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700"><label class="block font-bold text-gray-700 dark:text-slate-300 mb-2">${day}</label>${selectHTML}<input type="text" id="edit-notes-${dayId}" value="${esc(currentNotes)}" placeholder="Anotações (ex: sem cebola)" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-100 font-medium"></div>`;
    });
    document.getElementById('edit-order-modal').classList.remove('hidden');
  }

  // ===== Atualiza a view do usuario (imagem + badge de semana) =====
  function updateUserViewUI() {
  const st = S();
  // ===== Badge da semana: referências do DOM (listener de clique vive no main() do app.js) ====
  const badgeText = document.getElementById('week-badge-text');
  const badgeContainer = document.getElementById('week-badge-indicator');

  // ===== Caixa de recado do encarregado =====
  // Mostra apenas se houver um recado definido no menuData da semana atual
  const recadoCaixa = document.getElementById('recado-caixa');
  const recadoTexto = document.getElementById('recado-texto');
  if (recadoCaixa && recadoTexto) {
    const recado = st.currentMenuData.recado || '';
    if (recado && recado.trim()) {
      recadoTexto.textContent = recado.trim();
      recadoCaixa.classList.remove('hidden');
    } else {
      recadoCaixa.classList.add('hidden');
    }
  }

  if (badgeText && badgeContainer) {
    if (st.viewingNextWeek) {
      st.weeklyMenu.menuImageBase64 = st.currentMenuData.nextMenuImageBase64;
      st.userActiveHolidays = st.currentMenuData.nextHolidays || [];
      // v3.2: texto extraído via OCR (se existir)
      st.weeklyMenu.menuText = st.currentMenuData.nextMenuText || {};
    } else {
      st.weeklyMenu.menuImageBase64 = st.currentMenuData.menuImageBase64;
      st.userActiveHolidays = st.currentMenuData.holidays || [];
      // v3.2: texto extraído via OCR (se existir)
      st.weeklyMenu.menuText = st.currentMenuData.menuText || {};
    }
  }

  // v3.2: renderiza o cardápio em TEXTO (acessível, sem zoom)
  if (typeof renderMenuTextForUser === 'function') {
    renderMenuTextForUser(st.weeklyMenu.menuText || {});
  }

    const menuImage = document.getElementById('menu-image');
    const menuLoading = document.getElementById('menu-image-loading');
    let imageChanged = null;

    if (menuImage) {
      if (st.weeklyMenu.menuImageBase64) {
        imageChanged = menuImage.src !== st.weeklyMenu.menuImageBase64;
        menuImage.classList.add('opacity-0');
        menuLoading.classList.remove('hidden');
        if (imageChanged) {
          menuImage.src = st.weeklyMenu.menuImageBase64;
        } else {
          setTimeout(global.handleImageLoad, 50);
        }
        // v3.1: só reinicia a seleção se o cardápio realmente mudou.
        // Snapshot sem mudança de imagem NÃO pode apagar/reexibir as escolhas.
        if (imageChanged || st.userChoices.length === 0) {
          st.currentDayIndex = 0;
          st.userChoices = [];
          st.dayNotes = {};
          // O wizard fica OCULTO aqui; validateForm()/checkExistingOrder()
          // só o exibem depois de confirmar que não há pedido existente.
          // (elimina o "flash" da seleção reaparecendo por segundos)
          const wizardContainer = document.getElementById('order-wizard-container');
          if (wizardContainer) wizardContainer.classList.add('hidden');
        }
      } else {
        menuImage.src = '';
        menuLoading.classList.add('hidden');
      }
    }
    if (imageChanged !== null) st.menuImageChanged = imageChanged;
    validateForm();
  }

  function handleImageLoad() {
    const img = document.getElementById('menu-image');
    const loading = document.getElementById('menu-image-loading');
    if (img && img.src && img.src !== window.location.href) {
      img.classList.remove('opacity-0');
      if (loading) loading.classList.add('hidden');
    }
  }

  global.showToast = showToast;
  global.showCustomConfirm = showCustomConfirm;
  global.updateDarkModeButton = updateDarkModeButton;
  global.toggleDarkMode = toggleDarkMode;
  global.renderWizardStep = renderWizardStep;
  global.updateWizardProgress = updateWizardProgress;
  global.findPendingDay = findPendingDay;
  global.getWeekRangeText = getWeekRangeText;
  global.renderHolidayCheckboxes = renderHolidayCheckboxes;
  global.showUserView = showUserView;
  global.showAdminView = showAdminView;
  global.setAdminTab = setAdminTab;
  global.renderOrdersTable = renderOrdersTable;
  global.renderOrderStatus = renderOrderStatus;
  global.openEditOrderModal = openEditOrderModal;
  global.updateUserViewUI = updateUserViewUI;
  global.handleImageLoad = handleImageLoad;
})(window);