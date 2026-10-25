// Cardapio Quatinga v2 - order.js
// Fluxo do funcionario: findEmployeeByRGF, displayExistingOrder, checkExistingOrder,
// handleWizardSelection, validateForm, openConfirmationModal, submitOrder.
// Carregado em 6o lugar no index.html. Escopo global via window.

(function (global) {
  const fb = global.fb;
  const auth = global.auth;
  const weekDays = global.weekDays;
  const getDayId = global.getDayId;
  const esc = global.escapeHtml;
  const S = function () { return global.__state; };

  // ===== Busca funcionario por RGF (com autofill do nome) =====
  async function findEmployeeByRGF(rgf) {
    const nameInput = document.getElementById('employeeName');
    if (!rgf || !auth.currentUser) { nameInput.value = ''; nameInput.placeholder = 'Preenchido automaticamente'; return false; }
    try {
      const docSnap = await fb.getDoc(fb.doc(global.db, "funcionarios", rgf));
      if (docSnap.exists) {
        nameInput.value = docSnap.data().nome;
        nameInput.placeholder = 'Preenchido automaticamente';
        return true;
      } else {
        nameInput.value = '';
        nameInput.placeholder = 'RGF não encontrado';
        return false;
      }
    } catch (error) {
      nameInput.value = '';
      nameInput.placeholder = 'Erro';
      return false;
    }
  }

  // ===== Mostra pedido existente =====
  function displayExistingOrder(orderData) {
    const st = S();
    const detailsContainer = document.getElementById('existing-order-details');
    detailsContainer.innerHTML = '';
    document.getElementById('existing-order-title').textContent = st.viewingNextWeek ? "Pedido da próxima semana feito!" : "Pedido feito!";
    detailsContainer.innerHTML = weekDays.map(day => {
      const dayId = getDayId(day);
      return orderData[dayId] ? summaryRow(day, orderData[dayId], orderData[`${dayId}_notes`]) : '';
    }).join('');
  }

  // Linha do resumo (pedido feito e revisão): dia à esquerda, prato e observação à direita
  // Com o cardápio digitado, mostra o nome do prato (e a guarnição) em vez de só "Opção"
  function summaryRow(day, choice, notes) {
    const holiday = choice === 'FERIADO';
    const mt = ((S().weeklyMenu || {}).menuText || {})[getDayId(day)];
    const field = { 'Prato Principal': 'principal', 'Opção': 'opcao' }[choice];
    const dish = !holiday && field && mt && typeof mt === 'object' ? (mt[field] || '') : '';
    const garnish = dish && mt.guarnicao ? mt.guarnicao : '';
    const main = holiday ? 'Feriado' : esc(dish || choice);
    const label = dish ? `<span class="summary-label">${esc(choice)}</span>` : '';
    return `<div class="summary-row${holiday ? ' holiday' : ''}"><span class="summary-day">${esc(day.replace('-feira', ''))}</span><span class="summary-choice">${label}${main}${garnish ? `<small>com ${esc(garnish)}</small>` : ''}${notes ? `<small class="summary-note">${esc(notes)}</small>` : ''}</span></div>`;
  }

  // ===== Verifica se ja existe pedido do funcionario =====
  async function checkExistingOrder(rgf) {
    const st = S();
    if (!rgf || !auth.currentUser) return;
    try {
      const q = fb.query(fb.collection(global.db, "pedidosDaSemana"), fb.where("employeeRGF", "==", rgf));
      const snapshot = await fb.getDocs(q);
      const wizardContainer = document.getElementById('order-wizard-container');
      const existingContainer = document.getElementById('existing-order-container');
      const publicReportBtnContainer = document.getElementById('publicReportButtonContainer');
      let latestOrder = null;
      let latestTime = 0;
      // Pedido da semana atual, mesmo vendo a próxima: alimenta a caixa "Hoje o seu almoço é"
      let currentOrder = null;
      let currentTime = 0;
      if (!snapshot.empty) {
        snapshot.forEach(doc => {
          const data = doc.data();
          const isNext = !!data.isNextWeek;
          const time = data.timestamp ? fb.safeToMillis(data.timestamp) : 0;
          if (isNext === st.viewingNextWeek && time >= latestTime) { latestTime = time; latestOrder = data; }
          if (!isNext && time >= currentTime) { currentTime = time; currentOrder = data; }
        });
      }
      st.todayOrder = currentOrder;
      if (global.renderToday) global.renderToday();
      if (latestOrder) {
        displayExistingOrder(latestOrder);
        wizardContainer.classList.add('hidden');
        existingContainer.classList.remove('hidden');
        publicReportBtnContainer.classList.remove('hidden');
        return;
      }
      existingContainer.classList.add('hidden');
      publicReportBtnContainer.classList.add('hidden');
      // v3.1: se a imagem do cardápio não mudou e o usuário já está escolhendo,
      // NÃO zera as escolhas nem volta pro passo 0 (fix do bug visual).
      const stImgChanged = st.menuImageChanged;
      if (stImgChanged || st.userChoices.length === 0) {
        st.currentDayIndex = -1;
        st.userChoices = [];
        st.dayNotes = {};
      }
      renderWizardStep(st.currentDayIndex);
      // Tem pedido para fazer: a tela de pedido (foto grande + escolha) abre sozinha,
      // uma vez por RGF e semana; "Voltar" leva à tela normal
      const autoKey = rgf + '|' + (st.viewingNextWeek ? 'next' : 'cur');
      const homeVisible = document.getElementById('form-container')?.offsetParent !== null;
      if (st.orderScreenAutoKey !== autoKey && homeVisible && st.weeklyMenu.menuImageBase64 && typeof menuViewerOpen === 'function') {
        st.orderScreenAutoKey = autoKey;
        if (!(typeof MENU_VIEWER !== 'undefined' && MENU_VIEWER.isOpen)) menuViewerOpen();
      }
    } catch (error) { console.error(error); }
  }

  // ===== Selecao no wizard =====
  // Marca a opção do dia ativo e, depois de mostrar a marcação, passa sozinho
  // para o próximo dia que falta (os chips deixam voltar a qualquer dia)
  function handleWizardSelection(event) {
    const st = S();
    const choiceBtn = event.target.closest('.wizard-btn');
    if (!choiceBtn) return;
    const index = st.currentDayIndex;
    if (!(index >= 0 && index < weekDays.length)) return;
    st.userChoices[index] = {
      day: weekDays[index],
      choice: choiceBtn.dataset.value,
      notes: document.getElementById('wizard-notes').value.trim()
    };
    renderWizardStep(index);
    const pending = global.findPendingDay(st, index);
    if (pending !== -1) {
      st.wizardAdvanceTimer = setTimeout(() => {
        if (st.currentDayIndex === index) renderWizardStep(pending);
      }, 350);
    }
  }

  // Botão da barra: "Próximo dia" vai ao próximo pendente; com tudo escolhido abre a revisão
  function handleWizardNext() {
    const st = S();
    const pending = global.findPendingDay(st, st.currentDayIndex);
    if (pending === -1) openConfirmationModal();
    else renderWizardStep(pending);
  }

  function handleWizardDayChip(event) {
    const chip = event.target.closest('.day-chip');
    if (!chip) return;
    renderWizardStep(Number(chip.dataset.dayIndex));
  }

  // Observação fica guardada por dia, mesmo antes de escolher o prato
  function handleWizardNotes(event) {
    const st = S();
    const index = st.currentDayIndex;
    if (!st.dayNotes) st.dayNotes = {};
    st.dayNotes[index] = event.target.value;
    const current = st.userChoices[index];
    if (current && current.choice !== 'FERIADO') current.notes = event.target.value.trim();
  }

  // ===== Valida formulario e decide o que mostrar =====
  async function validateForm() {
    const st = S();
    if (!auth.currentUser) return;
    const nameInput = document.getElementById('employeeName');
    const rgfInput = document.getElementById('employeeRGF');
    const name = nameInput?.value.trim();
    const rgf = rgfInput?.value.trim();
    const guidanceSection = document.getElementById('guidanceSection');
    const orderSection = document.getElementById('order-section');
    const publicReportBtnContainer = document.getElementById('publicReportButtonContainer');
    const isValidUser = name && rgf;

    if (isValidUser && !st.autoSwitchDone && st.currentMenuData.nextMenuImageBase64) {
      try {
        const q = fb.query(fb.collection(global.db, "pedidosDaSemana"), fb.where("employeeRGF", "==", rgf));
        const snap = await fb.getDocs(q);
        let hasNextOrder = false;
        snap.forEach(doc => { if (doc.data().isNextWeek === true) hasNextOrder = true; });
        if (!hasNextOrder) {
          st.viewingNextWeek = true;
          st.autoSwitchDone = true;
          updateUserViewUI();
          return;
        } else { st.autoSwitchDone = true; }
      } catch (err) { st.autoSwitchDone = true; }
    }

    if (st.weeklyMenu.menuImageBase64) {
      if (!isValidUser) {
        orderSection.classList.add('hidden');
        publicReportBtnContainer.classList.add('hidden');
        guidanceSection.classList.remove('hidden');
        document.getElementById('guidanceText').textContent = 'Por favor, insira o seu RGF para começar.';
      } else {
        guidanceSection.classList.add('hidden');
        orderSection.classList.remove('hidden');
        await checkExistingOrder(rgf);
        if (document.activeElement === rgfInput) {
          setTimeout(() => { document.getElementById('order-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
        }
      }
    } else {
      orderSection.classList.add('hidden');
      publicReportBtnContainer.classList.add('hidden');
      guidanceSection.classList.remove('hidden');
      document.getElementById('guidanceText').textContent = 'Nenhum cardápio disponível para a seleção atual.';
    }
  }

  // ===== Modal de confirmacao do pedido =====
  function openConfirmationModal() {
    const st = S();
    // Finalizado de dentro do zoom: fecha o visualizador, senão a confirmação abre por trás dele
    st.reviewFromOrderScreen = typeof MENU_VIEWER !== 'undefined' && MENU_VIEWER.isOpen;
    if (st.reviewFromOrderScreen && typeof menuViewerClose === 'function') menuViewerClose();
    st.tempOrderData = {
      employeeName: document.getElementById('employeeName').value.trim(),
      employeeRGF: document.getElementById('employeeRGF').value.trim(),
      timestamp: fb.serverTimestamp()
    };
    const summaryContainer = document.getElementById('confirmation-summary');
    // userChoices é indexado pelo dia (0 = segunda): os chips deixam escolher fora de ordem
    const items = st.userChoices.filter(item => item && item.day);
    items.forEach(item => {
      const dayId = getDayId(item.day);
      st.tempOrderData[dayId] = item.choice;
      if (item.notes && item.choice !== 'FERIADO') st.tempOrderData[`${dayId}_notes`] = item.notes;
    });
    summaryContainer.innerHTML = items.map(item => summaryRow(item.day, item.choice, item.choice === 'FERIADO' ? '' : item.notes)).join('');
    document.getElementById('confirmation-week').textContent = `Semana de ${global.getWeekRangeText()}`;
    document.getElementById('confirmation-modal').classList.remove('hidden');
  }

  // ===== Envia pedido =====
  async function submitOrder() {
    const st = S();
    if (!auth.currentUser) return;
    const button = document.getElementById('submitOrder');
    button.disabled = true; button.textContent = navigator.onLine ? 'A enviar...' : 'Salvando offline...';
    try {
      st.tempOrderData.isNextWeek = st.viewingNextWeek;
      // O Firebase salva localmente de forma sincrona.
      const orderPromise = fb.addDoc(fb.collection(global.db, "pedidosDaSemana"), st.tempOrderData);
      // Avisa o ADM (com internet vai na hora; offline fica guardado e vai quando voltar)
      const orderForNotify = { ...st.tempOrderData };
      orderPromise.then(() => {
        if (global.triggerOrderDoneNotification) global.triggerOrderDoneNotification(orderForNotify);
      }).catch(() => {});
      if (!navigator.onLine && global.triggerOrderDoneNotification) global.triggerOrderDoneNotification(orderForNotify);
      document.getElementById('confirmation-modal').classList.add('hidden');
      document.getElementById('form-container').classList.add('hidden');
      document.getElementById('success-message').classList.remove('hidden');
      if (navigator.onLine) {
        await orderPromise;
        document.getElementById('success-text').textContent = `Obrigado, ${st.tempOrderData.employeeName}. O seu pedido foi registado com sucesso.`;
        showToast("Pedido enviado com sucesso!", 'success');
      } else {
        document.getElementById('success-text').textContent = `Obrigado, ${st.tempOrderData.employeeName}. O seu pedido foi salvo no celular e será enviado automaticamente assim que houver internet.`;
        showToast("Salvo offline!", 'info');
      }
    } catch (error) {
      showToast("Erro ao processar pedido.", 'error');
    } finally {
      button.disabled = false; button.textContent = 'Confirmar e enviar';
    }
  }

  global.findEmployeeByRGF = findEmployeeByRGF;
  global.displayExistingOrder = displayExistingOrder;
  global.checkExistingOrder = checkExistingOrder;
  global.handleWizardSelection = handleWizardSelection;
  global.handleWizardNext = handleWizardNext;
  global.handleWizardDayChip = handleWizardDayChip;
  global.handleWizardNotes = handleWizardNotes;
  // Toda validação termina redesenhando a tela de início (home.js)
  global.validateForm = async function () {
    try { await validateForm(); } finally { if (global.renderHome) global.renderHome(); }
  };
  global.openConfirmationModal = openConfirmationModal;
  global.submitOrder = submitOrder;
})(window);