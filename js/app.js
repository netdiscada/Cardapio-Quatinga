// Cardapio Quatinga v3 - app.js
// Bootstrap/orquestracao: estado global compartilhado, setupPWA, upload/cropper de
// imagem do cardapio (v3: drag-and-drop + preview), calendario interativo de
// feriados, busca de funcionarios, status online/offline, e wiring de TODOS os
// event listeners (main). Carregado por ULTIMO no index.html. Escopo global via window.

(function (global) {
  const fb = global.fb;
  const auth = global.auth;
  const APP_CONFIG = global.APP_CONFIG;

  // =====================================================================
  // ESTADO GLOBAL compartilhado entre os modulos (equivalente as variaveis
  // de topo do v1.x)
  // =====================================================================
  global.__state = {
    currentMenuData: { menuImageBase64: '', holidays: [], nextMenuImageBase64: '', nextHolidays: [], targetRotationDate: null },
    weeklyMenu: {},
    userActiveHolidays: [],
    viewingNextWeek: false,
    adminViewingNextWeek: false,
    autoSwitchDone: false,
    menuUnsubscribe: null,
    adminUnsubscribe: null,
    anonymousLoginPromise: null,
    isLoggingInAsAdmin: false,
    isRotatingWeekLock: false,
    allOrders: [],
    tempOrderData: {},
    userChoices: [],
    currentDayIndex: 0,
    cropperInstance: null,
    finalImageBase64: null
  };

  // =====================================================================
  // PWA (manifest + service worker) — porta do setupPWA do v1.x
  // =====================================================================
  function setupPWA() {
    try {
      // O manifest agora e o arquivo manifest.json (com icone PNG): o iPhone so aceita
      // notificacoes do site instalado na tela inicial, e nao le manifest gerado em blob.

      // O Service Worker (sw-v2.js) e registrado pelo script inline no fim do index.html.
      // Registrar outro (sw.js) aqui fazia os dois se substituirem a cada carregamento.

      // Pre-carrega dados principais no cache do Firestore (pra funcionar offline)
      setTimeout(() => {
        try {
          if (global.getMenuDocRef) global.getMenuDocRef().get().catch(() => {});
          // Lista de funcionários: as regras só deixam o ADM ler a coleção inteira
          const isAdm = global.auth && global.auth.currentUser && global.auth.currentUser.uid === APP_CONFIG.ADMIN_UID;
          if (isAdm && global.getFuncionariosCollectionRef) global.getFuncionariosCollectionRef().get().catch(() => {});
        } catch (e) { /* offline ou cota */ }
      }, 2000);
    } catch (e) { console.log("PWA setup falhou"); }
  }
  setupPWA();

  // =====================================================================
  // v3: Upload de imagem com drag-and-drop (dropArea) + preview com info
  // =====================================================================
  function bindImageUploadHandlers() {
    const st = global.__state;
    const dropArea = document.getElementById('dropArea');
    const resetBtn = document.getElementById('resetUpload');
    const cropBtn = document.getElementById('cropImageBtn');

    // Input file invisível reutilizável (suporta clique na dropArea)
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/jpg,image/webp';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    function handleFileSelection(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast("Arquivo inválido. Envie uma imagem (JPG/PNG).", "error");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("Imagem muito grande (máx 5MB).", "error");
        return;
      }
      const feedback = document.getElementById('uploadFeedback');
      if (feedback) feedback.textContent = `Processando: ${file.name}...`;
      const reader = new FileReader();
      reader.onload = (e) => {
        const cropperImage = document.getElementById('cropper-image');
        cropperImage.src = e.target.result;
        document.getElementById('cropper-modal').classList.remove('hidden');
        if (st.cropperInstance) st.cropperInstance.destroy();
        st.cropperInstance = new Cropper(cropperImage, {
          viewMode: 1, dragMode: 'move', autoCropArea: 0.95, restore: false, guides: true,
          center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false,
        });
        if (feedback) feedback.textContent = '';
      };
      reader.readAsDataURL(file);
    }

    if (dropArea) {
      dropArea.addEventListener('click', () => fileInput.click());

      ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropArea.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropArea.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
        });
      });
      dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) handleFileSelection(files[0]);
      });
    }

    fileInput.addEventListener('change', function (event) {
      if (event.target.files && event.target.files[0]) {
        handleFileSelection(event.target.files[0]);
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        st.finalImageBase64 = null;
        fileInput.value = '';
        const previewContainer = document.getElementById('imagePreviewContainer');
        if (previewContainer) previewContainer.classList.add('hidden');
        const uploadBtn = document.getElementById('uploadImageBtn');
        if (uploadBtn) uploadBtn.disabled = true;
        showToast("Upload redefinido.", "info");
      });
    }

    if (cropBtn) {
      cropBtn.addEventListener('click', () => {
        if (!st.finalImageBase64) {
          showToast("Confirme o recorte da imagem atual primeiro.", "info");
          return;
        }
        const cropperImage = document.getElementById('cropper-image');
        cropperImage.src = st.finalImageBase64;
        document.getElementById('cropper-modal').classList.remove('hidden');
        if (st.cropperInstance) st.cropperInstance.destroy();
        st.cropperInstance = new Cropper(cropperImage, {
          viewMode: 1, dragMode: 'move', autoCropArea: 0.95, restore: false, guides: true,
          center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false,
        });
      });
    }

    // ===== Cancel/Confirm do cropper =====
    document.getElementById('cancel-crop-btn').addEventListener('click', () => {
      document.getElementById('cropper-modal').classList.add('hidden');
      st.finalImageBase64 = null;
      if (st.cropperInstance) { st.cropperInstance.destroy(); st.cropperInstance = null; }
    });

    document.getElementById('confirm-crop-btn').addEventListener('click', async () => {
      if (!st.cropperInstance) return;
      const btn = document.getElementById('confirm-crop-btn');
      const originalText = btn.textContent;
      btn.disabled = true; btn.textContent = "⏳ Processando...";
      try {
        const canvas = st.cropperInstance.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200, fillColor: '#fff', imageSmoothingEnabled: true, imageSmoothingQuality: 'high', });
        if (!canvas) throw new Error("Falha ao gerar o canvas.");
        canvas.toBlob(async (blob) => {
          if (!blob) { showToast("Erro no recorte.", "error"); btn.disabled = false; btn.textContent = originalText; return; }
          try {
            const options = { maxSizeMB: 0.45, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressFn = window.imageCompression || imageCompression;
            const compressedBlob = await compressFn(blob, options);
            const reader = new FileReader();
            reader.readAsDataURL(compressedBlob);
            reader.onloadend = () => {
              st.finalImageBase64 = reader.result;
              // Preview v3
              const preview = document.getElementById('imagePreview');
              const previewContainer = document.getElementById('imagePreviewContainer');
              if (preview) preview.src = st.finalImageBase64;
              if (global.renderMenuTextEditor) global.renderMenuTextEditor();
              if (previewContainer) previewContainer.classList.remove('hidden');
              const dimEl = document.getElementById('imageDimensions');
              const sizeEl = document.getElementById('imageSize');
              if (dimEl) dimEl.textContent = `${canvas.width} x ${canvas.height}px`;
              if (sizeEl) sizeEl.textContent = `${(compressedBlob.size / 1024).toFixed(0)} KB`;
              document.getElementById('uploadImageBtn').disabled = false;
              document.getElementById('cropper-modal').classList.add('hidden');
              st.cropperInstance.destroy(); st.cropperInstance = null;
              btn.disabled = false; btn.textContent = originalText; showToast("Imagem processada e pronta!", "success");
            };
          } catch (compErr) { showToast("Falha na compressão.", "error"); btn.disabled = false; btn.textContent = originalText; }
        }, 'image/jpeg', 0.85);
      } catch (err) { showToast("Erro ao processar imagem.", "error"); btn.disabled = false; btn.textContent = originalText; }
    });

    // ===== Salvar cardapio da proxima semana =====
    document.getElementById('uploadImageBtn').addEventListener('click', async () => {
      const uploadBtn = document.getElementById('uploadImageBtn');
      try {
        if (!auth.currentUser) { showToast("Sessão expirada. Recarregue a página.", "error"); return; }
        if (!st.finalImageBase64) { showToast("Você precisa selecionar e recortar uma imagem primeiro.", "error"); return; }
        uploadBtn.disabled = true; uploadBtn.innerHTML = "⏳ Salvando no banco de dados...";
        // v3: feriados vem do calendario interativo (currentMenuData.nextHolidays)
        let selectedHolidays = [];
        if (st.currentMenuData && Array.isArray(st.currentMenuData.nextHolidays)) {
          selectedHolidays = st.currentMenuData.nextHolidays;
        } else {
          selectedHolidays = Array.from(document.querySelectorAll('.holiday-checkbox:checked')).map(cb => cb.value);
        }
        // Semana do cardapio novo e virada automatica no sabado 00:00 antes dela (db.js)
        const nextMonday = global.getNextMenuMonday(st.currentMenuData);
        await fb.setDoc(global.getMenuDocRef(), { nextMenuImageBase64: st.finalImageBase64, nextHolidays: selectedHolidays, nextWeekMonday: nextMonday.getTime(), targetRotationDate: global.getRotationTime(nextMonday), recado: document.getElementById('proximaSemanaRecado')?.value?.trim() || '' }, { merge: true });
        showToast("Cardápio da Próxima Semana salvo e disponível!", "success");
        document.getElementById('whatsapp-notification-container').classList.remove('hidden');
        // Avisa todos os funcionarios (push pelo Cloudflare Worker)
        if (global.triggerNewMenuNotification) {
          global.triggerNewMenuNotification(true);
        }
        st.finalImageBase64 = null; uploadBtn.innerHTML = "✅ Salvo com sucesso!";
      } catch (error) {
        uploadBtn.disabled = false; uploadBtn.textContent = "Tentar Salvar Novamente";
        if (error.code === 'resource-exhausted' || (error.message && error.message.includes('large'))) { showToast("Erro: A imagem ainda está muito pesada para o banco de dados.", "error"); }
        else { showToast("Falha na conexão. Tente novamente.", "error"); }
      }
    });
  }

  // =====================================================================
  // Status online/offline
  // =====================================================================
  function updateOnlineStatus() {
    const banner = document.getElementById('offline-banner');
    if (navigator.onLine) {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }
  }

  // =====================================================================
  // CLIQUE NA NOTIFICACAO (APK e site). O Worker manda data.action:
  //   order  -> funcionario: abre a tela de pedido da semana certa
  //   orders -> ADM: abre a aba Pedidos
  //   pdf    -> ADM: abre a aba Pedidos e ja gera o PDF ("todos concluiram")
  // =====================================================================
  function waitFor(check, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function poll() {
        if (check()) return resolve(true);
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(poll, 250);
      })();
    });
  }

  async function handleNotificationAction(action, isNextWeekRaw) {
    if (!action) return;
    const isNextWeek = String(isNextWeekRaw) === 'true';
    const st = global.__state;
    // App acabou de abrir pela notificacao: espera login e cardapio carregarem
    await waitFor(() => !!(auth && auth.currentUser), 15000);
    await new Promise(r => setTimeout(r, 800));
    const isAdmin = auth.currentUser && auth.currentUser.uid === APP_CONFIG.ADMIN_UID;

    if (action === 'order') {
      if (localStorage.getItem('currentAppView') === 'admin') {
        localStorage.setItem('currentAppView', 'user');
        await global.showUserView();
      }
      if (isNextWeek && !(st.currentMenuData && st.currentMenuData.nextMenuImageBase64)) {
        await waitFor(() => !!(st.currentMenuData && st.currentMenuData.nextMenuImageBase64), 8000);
      }
      if (st.viewingNextWeek !== isNextWeek && (!isNextWeek || st.currentMenuData.nextMenuImageBase64)) {
        st.viewingNextWeek = isNextWeek;
        st.autoSwitchDone = true;
        if (typeof global.updateUserViewUI === 'function') global.updateUserViewUI();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const rgfInput = document.getElementById('employeeRGF');
      if (rgfInput && !rgfInput.value) rgfInput.focus();
      return;
    }

    if (action === 'orders' || action === 'pdf') {
      if (!isAdmin) {
        document.getElementById('admin-login-modal').classList.remove('hidden');
        showToast('Entre como ADM para ver os pedidos.', 'info');
        return;
      }
      if (localStorage.getItem('currentAppView') !== 'admin' || document.getElementById('admin-view').classList.contains('hidden')) {
        global.showAdminView();
      }
      st.allOrders = [];
      global.setAdminTab(isNextWeek);
      if (global.showAdminPanel) global.showAdminPanel('orders');
      if (action === 'pdf') {
        const loaded = await waitFor(() => st.allOrders && st.allOrders.length > 0, 15000);
        if (loaded && global.generateAndShareReport) global.generateAndShareReport();
      }
    }
  }
  global.handleNotificationAction = handleNotificationAction;

  // Site: o clique abre a pagina com ?notif=acao&next=true|false
  function handleNotificationFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('notif');
    if (!action) return;
    const next = params.get('next');
    params.delete('notif'); params.delete('next');
    const query = params.toString();
    history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
    handleNotificationAction(action, next);
  }

  // Site ja aberto: o service worker avisa a pagina do clique
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'notification-click') handleNotificationAction(msg.action, msg.isNextWeek);
    });
  }

  // =====================================================================
  // NOTIFICACOES PUSH (Capacitor). So roda dentro do APK; no PWA ignora.
  // Permissao, token FCM e associacao ao RGF ficam em pushRegistration.js;
  // aqui tratamos as notificacoes recebidas com o app aberto e os cliques.
  // =====================================================================
  function setupPushNotifications() {
    if (!window.Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return;
    const Push = Capacitor.Plugins.PushNotifications;
    if (!Push) return;
    const Local = Capacitor.Plugins.LocalNotifications;
    // Com o app aberto o Android nao mostra o push na barra: repassa para LocalNotifications
    Push.addListener('pushNotificationReceived', (n) => {
      if (!n) return;
      const title = n.title || 'Cardápio Quatinga';
      try { showToast(title, 'info', 4000); } catch (e) {}
      if (Local) {
        Local.schedule({
          notifications: [{
            id: Date.now() % 2147483647, title, body: n.body || '', extra: n.data || {},
            channelId: 'cardapio_notifications', smallIcon: 'ic_notification'
          }]
        }).catch((e) => console.warn('LocalNotifications falhou:', e));
      }
    });
    // Toque na notificacao com o app fechado/em segundo plano
    Push.addListener('pushNotificationActionPerformed', (event) => {
      const data = (event && event.notification && event.notification.data) || {};
      handleNotificationAction(data.action, data.isNextWeek);
    });
    // Toque na notificacao repassada com o app aberto
    if (Local) {
      Local.addListener('localNotificationActionPerformed', (event) => {
        const data = (event && event.notification && event.notification.extra) || {};
        handleNotificationAction(data.action, data.isNextWeek);
      });
    }
  }

  // =====================================================================
  // MAIN — wiring de TODOS os listeners (equivale ao main() do v1.x)
  // =====================================================================
  function main() {
    const adminViewCurrent = document.getElementById('admin-view-current');
    if (adminViewCurrent) adminViewCurrent.addEventListener('click', () => setAdminTab(false));
    const adminViewNext = document.getElementById('admin-view-next');
    if (adminViewNext) adminViewNext.addEventListener('click', () => setAdminTab(true));

    const btnTurnWeek = document.getElementById('btn-turn-week');
    if (btnTurnWeek) btnTurnWeek.addEventListener('click', global.turnWeek);
    const btnClearCurrentOrders = document.getElementById('btn-clear-current-orders');
    if (btnClearCurrentOrders) btnClearCurrentOrders.addEventListener('click', global.clearCurrentOrders);

    const rgfInput = document.getElementById('employeeRGF');
    let rgfDebounceTimeout;
    if (rgfInput) {
      rgfInput.addEventListener('input', () => {
        clearTimeout(rgfDebounceTimeout);
        rgfDebounceTimeout = setTimeout(async () => {
          global.__state.autoSwitchDone = false;
          const val = rgfInput.value.trim();
          localStorage.setItem('employeeRGF', val);
          await findEmployeeByRGF(val);
          await validateForm();
        }, 400);
      });
      rgfInput.addEventListener('blur', () => localStorage.setItem('employeeRGF', rgfInput.value));
    }

    const wizardOptions = document.getElementById('wizard-options');
    if (wizardOptions) wizardOptions.addEventListener('click', handleWizardSelection);
    document.getElementById('wizard-days')?.addEventListener('click', global.handleWizardDayChip);
    document.getElementById('wizard-next')?.addEventListener('click', global.handleWizardNext);
    document.getElementById('wizard-notes')?.addEventListener('input', global.handleWizardNotes);
    document.getElementById('wizard-notes-toggle')?.addEventListener('click', (e) => {
      const wizard = document.getElementById('order-wizard');
      const open = wizard.classList.toggle('notes-open');
      e.currentTarget.setAttribute('aria-expanded', String(open));
      if (open) document.getElementById('wizard-notes').focus();
    });
    document.getElementById('wizard-notes')?.addEventListener('input', (e) => {
      const t = document.getElementById('wizard-notes-toggle');
      t.classList.toggle('has-note', !!e.target.value.trim());
      t.textContent = e.target.value.trim() ? 'Obs. ✓' : '+ Obs.';
    });
    const submitOrderBtn = document.getElementById('submitOrder');
    if (submitOrderBtn) submitOrderBtn.addEventListener('click', submitOrder);

    const btnEditWizard = document.getElementById('btn-edit-wizard');
    // Editar mantém as escolhas: só fecha a revisão e volta ao primeiro dia
    // Se a revisão veio da tela de pedido (foto grande), volta para ela
    const backToOrderScreen = () => {
      if (global.__state.reviewFromOrderScreen && typeof menuViewerOpen === 'function') menuViewerOpen();
    };
    if (btnEditWizard) btnEditWizard.addEventListener('click', () => {
      document.getElementById('confirmation-modal').classList.add('hidden');
      renderWizardStep(0);
      backToOrderScreen();
    });
    // Tocar fora da bandeja de revisão fecha (igual a Editar)
    document.getElementById('confirmation-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'confirmation-modal') { e.currentTarget.classList.add('hidden'); backToOrderScreen(); }
    });

    const btnViewPublicReport = document.getElementById('btn-view-public-report');
    if (btnViewPublicReport) btnViewPublicReport.addEventListener('click', openPublicReportModal);
    document.querySelectorAll('.cancel-modal-btn, #custom-confirm-cancel-btn').forEach(btn => { btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.add('hidden')); });
    const switchToAdmin = document.getElementById('switchToAdmin');
    if (switchToAdmin) switchToAdmin.addEventListener('click', () => {
      if (auth?.currentUser && auth.currentUser.uid === APP_CONFIG.ADMIN_UID) { localStorage.setItem('currentAppView', 'admin'); showAdminView(); }
      else { document.getElementById('admin-login-modal').classList.remove('hidden'); }
    });

    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) adminLoginForm.addEventListener('submit', handleAdminLogin);
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', handleAdminLogout);
    const switchToUserFromAdmin = document.getElementById('switchToUserFromAdmin');
    if (switchToUserFromAdmin) switchToUserFromAdmin.addEventListener('click', () => { localStorage.setItem('currentAppView', 'user'); showUserView(); });
    const addEmployeeForm = document.getElementById('add-employee-form');
    if (addEmployeeForm) addEmployeeForm.addEventListener('submit', handleAddEmployee);
    const employeeListContainer = document.getElementById('employee-list-container');
    if (employeeListContainer) employeeListContainer.addEventListener('click', (e) => {
      if (e.target.closest('.edit-employee-btn')) openEmployeeEditModal(e.target.closest('.edit-employee-btn').dataset.id, e.target.closest('.edit-employee-btn').dataset.name);
      if (e.target.closest('.delete-employee-btn')) handleDeleteEmployee(e.target.closest('.delete-employee-btn').dataset.id, e.target.closest('.delete-employee-btn').dataset.name);
    });
    const editEmployeeForm = document.getElementById('edit-employee-form');
    if (editEmployeeForm) editEmployeeForm.addEventListener('submit', handleSaveEmployeeChanges);
    const ordersTableContainer = document.getElementById('ordersTableContainer');
    if (ordersTableContainer) ordersTableContainer.addEventListener('click', (e) => {
      if (e.target.closest('.edit-order-btn')) openEditOrderModal(e.target.closest('.edit-order-btn').dataset.id);
      if (e.target.closest('.delete-order-btn')) handleDeleteOrder(e.target.closest('.delete-order-btn').dataset.id, e.target.closest('.delete-order-btn').dataset.name);
    });

    document.getElementById('edit-order-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const st = global.__state;
      if (!auth.currentUser) return;
      const orderId = document.getElementById('edit-order-id').value;
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const updateData = {};
      const editHolidays = st.adminViewingNextWeek ? (st.currentMenuData.nextHolidays || []) : (st.currentMenuData.holidays || []);
      global.weekDays.forEach(day => {
        const dayId = getDayId(day);
        if (editHolidays.includes(dayId)) return;
        const selectEl = document.getElementById(`edit-choice-${dayId}`);
        const notesEl = document.getElementById(`edit-notes-${dayId}`);
        if (selectEl) { updateData[dayId] = selectEl.value; updateData[`${dayId}_notes`] = notesEl.value.trim(); }
      });
      submitBtn.disabled = true; submitBtn.textContent = 'Salvando...';
      try {
        await fb.updateDoc(fb.collection(global.db, "pedidosDaSemana").doc(orderId), updateData);
        showToast("Pedido atualizado com sucesso!", 'success');
        document.getElementById('edit-order-modal').classList.add('hidden');
      } catch (error) { showToast("Erro ao salvar.", 'error'); }
      finally { submitBtn.disabled = false; submitBtn.textContent = 'Salvar Alterações'; }
    });

    document.getElementById('searchInput').addEventListener('input', () => renderOrdersTable(global.__state.allOrders));

    document.getElementById('generateReportBtn').addEventListener('click', generateAndShareReport);
    document.getElementById('notifyWhatsAppBtn').addEventListener('click', handleWhatsAppNotification);
    document.getElementById('deleteNextWeekBtn')?.addEventListener('click', async () => {
      showCustomConfirm("⚠️ APAGAR o cardápio da próxima semana? Os funcionários deixam de ver o cardápio novo e TODOS os pedidos já feitos para a próxima semana serão apagados.", async () => {
        if (!auth.currentUser) return;
        const btn = document.getElementById('deleteNextWeekBtn');
        btn.disabled = true; btn.textContent = "A apagar...";
        try {
          await fb.updateDoc(global.getMenuDocRef(), { nextMenuImageBase64: '', nextHolidays: [], nextWeekMonday: null, targetRotationDate: null, recado: '', nextMenuText: {} });
          const snap = await fb.getDocs(fb.collection(global.db, "pedidosDaSemana"));
          const batch = fb.writeBatch(global.db);
          snap.forEach(d => { if (d.data().isNextWeek === true) batch.delete(d.ref); });
          await batch.commit();
          showToast("Próxima semana apagada.", "success");
        } catch (error) { showToast("Erro ao apagar.", "error"); }
        finally { btn.disabled = false; btn.textContent = "🗑️ Apagar cardápio da próxima semana"; }
      });
    });

    // v3.3: abre o visualizador fullscreen (pinch-zoom + botões fixos)
    const menuImage = document.getElementById('menu-image');
    menuImage.addEventListener('click', () => { if (typeof menuViewerOpen === 'function') menuViewerOpen(); });
    document.getElementById('menu-fullscreen-btn')?.addEventListener('click', () => { if (typeof menuViewerOpen === 'function') menuViewerOpen(); });

    // ===== v3: init userhelp ANTES dos handlers do calendario (precisa de isHolidayDate) ====
    if (global.initUserHelp) global.initUserHelp();
    if (global.bindHolidayCalendarHandlers) global.bindHolidayCalendarHandlers();
    if (global.bindEmployeeSearchHandler) global.bindEmployeeSearchHandler();
    if (global.bindRgfConsultHandler) global.bindRgfConsultHandler();
    if (global.initFinancas) global.initFinancas();

    // ===== v3: Toggle do formulario de adicionar funcionario =====
    const toggleAddEmployeeFormBtn = document.getElementById('toggleAddEmployeeForm');
    if (toggleAddEmployeeFormBtn) {
      toggleAddEmployeeFormBtn.addEventListener('click', () => {
        const form = document.getElementById('add-employee-form');
        form.classList.toggle('hidden');
      });
    }

    // ===== v3: Abas do painel ADM (Sidebar/TabBar) =====
    const adminTabsNav = document.getElementById('admin-tabs');
    if (adminTabsNav) {
      const panelIds = { menu: 'menu-management-section', employees: 'employee-management-section', orders: 'order-status-section' };
      const extraOrderPanel = document.getElementById('orders-section');

      const showPanel = (name) => {
        // Esconde/mostra painéis conforme a aba ativa
        document.querySelectorAll('#admin-view section[data-admin-panel]').forEach(sec => {
          sec.classList.toggle('hidden', sec.dataset.adminPanel !== name);
        });
        // Atualiza botões
        document.querySelectorAll('#admin-tabs .admin-tab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.adminTab === name);
        });
        // O botão FAB de PDF só faz sentido na aba de pedidos
        const fab = document.getElementById('generateReportBtn');
        if (fab) fab.classList.toggle('hidden', name !== 'orders');
        // Guarda a aba ativa
        global.__state.adminActiveTab = name;

        // Garante que o calendário de feriados seja (re)criado e os feriados
        // preselecionados sempre que a aba Cardápio for ativada
        if (name === 'menu' && global.bindHolidayCalendarHandlers) {
          global.bindHolidayCalendarHandlers();
        }
      };

      adminTabsNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.admin-tab-btn');
        if (!btn) return;
        showPanel(btn.dataset.adminTab);
      });

      // Aba inicial (ou última usada)
      showPanel(global.__state.adminActiveTab || 'menu');

      // Garante que o calendário de feriados seja inicializado mesmo quando a
      // página recarrega diretamente em outra aba (ex: orders). O calendário
      // só existe no DOM quando a aba Cardápio está ativa, então bind
      // só funciona se o elemento estiver presente.
      if (global.bindHolidayCalendarHandlers && document.getElementById('holidayCalendar')) {
        global.bindHolidayCalendarHandlers();
      }

      // Expõe showPanel para uso externo (ui.js showAdminView precisa chamá-lo)
      global.showAdminPanel = showPanel;
    }

    // ===== Badge da semana clicável (adicionado uma única vez aqui, no main) ====
    // FORA do bloco adminTabsNav para funcionar na visão do usuário também
    const badgeText = document.getElementById('week-badge-text');
    const badgeContainer = document.getElementById('week-badge-indicator');
    if (badgeText && badgeContainer) {
      badgeContainer.style.cursor = 'pointer';
      badgeContainer.title = 'Alternar entre semana atual e próxima semana';
      badgeContainer.addEventListener('click', () => {
        const st = global.__state;
        const temProxima = st.currentMenuData && st.currentMenuData.nextMenuImageBase64;
        if (!temProxima && !st.viewingNextWeek) {
          showToast('Não há cardápio da próxima semana disponível.', 'info');
          return;
        }
        st.viewingNextWeek = !st.viewingNextWeek;
        if (typeof global.updateUserViewUI === 'function') global.updateUserViewUI();
        showToast(
          st.viewingNextWeek ? 'Visualizando cardápio da próxima semana' : 'Visualizando cardápio da semana atual',
          'info',
          2500
        );
      });
    }
  }
  // =====================================================================
  // BOOT
  // =====================================================================
  updateDarkModeButton();
  document.getElementById('darkModeToggle').addEventListener('click', global.toggleDarkMode);
  document.getElementById('menu-image').addEventListener('load', global.handleImageLoad);

  window.addEventListener('online', () => { updateOnlineStatus(); showToast("Conexão restabelecida!", "success"); });
  window.addEventListener('offline', () => { updateOnlineStatus(); showToast("Você está offline. Alterações serão salvas no celular.", "info", 5000); });
  updateOnlineStatus();

  bindImageUploadHandlers();
  main();

  // ===== Notificacoes Push (FCM via Capacitor) — roda somente no APK =====
  setupPushNotifications();

  // Dispara o listener de auth (login anonimo / admin)
  setupAuthStateListener();

  // Site aberto pelo clique numa notificacao
  handleNotificationFromUrl();
})(window);