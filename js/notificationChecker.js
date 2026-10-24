// Cardapio Quatinga v3 - notificationChecker.js
// Lembrete local para o funcionário que ainda não pediu (funciona offline/APK/PWA)
// Incluir no index.html ANTES de app.js: <script src="js/notificationChecker.js"></script>

(function (global) {
  const fb = global.fb;
  const auth = global.auth;
  const APP_CONFIG = global.APP_CONFIG;

  // Estado do checker
  const checkerState = {
    intervalId: null,
    isAdmin: false,
    employeeRGF: null,
    employeeName: null
  };

  // Permissão para notificações do navegador
  async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  // Mostra notificação local (funciona no APK via Capacitor e no PWA)
  function showLocalNotification(title, body, data = {}) {
    // APK: notificacao local vem do plugin LocalNotifications
    // (PushNotifications nao tem schedule(); a chamada falhava sem mostrar nada)
    const LocalNotif = window.Capacitor && Capacitor.isNativePlatform && Capacitor.Plugins.LocalNotifications;
    if (LocalNotif) {
      LocalNotif.schedule({
        notifications: [{
          title,
          body,
          id: Date.now() % 2147483647, // id precisa caber em int32 no Android
          extra: data,
          schedule: { at: new Date(Date.now() + 100) }
        }]
      }).catch(e => console.warn('LocalNotifications falhou:', e));
      return;
    }
    // Fallback: Notification API do navegador (PWA/Chrome)
    if ('Notification' in window && Notification.permission === 'granted') {
      const icon = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%232563eb%27 rx=%2720%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2760%27 text-anchor=%27middle%27 fill=%27white%27%3E%F0%9F%8D%B2%3C/text%3E%3C/svg%3E';
      const options = { body, icon, badge: icon, tag: data.tag || 'cardapio-notification', data };
      // No Chrome Android 'new Notification()' lanca TypeError; la so funciona via Service Worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then(reg => reg.showNotification(title, options))
          .catch(e => console.warn('showNotification falhou:', e));
        return;
      }
      const notif = new Notification(title, options);
      notif.onclick = () => { window.focus(); notif.close(); };
    }
  }

  // Lembrete para funcionário: a cada 15 min avisa se não fez pedido da semana atual
  async function checkEmployeeReminder() {
    try {
      const rgf = checkerState.employeeRGF;
      if (!rgf) return;

      // Verifica se já fez pedido da semana atual (não nextWeek)
      const q = fb.query(
        fb.collection(global.db, 'pedidosDaSemana'),
        fb.where('employeeRGF', '==', rgf),
        fb.where('isNextWeek', '==', false)
      );
      const snap = await fb.getDocs(q);

      // Se já fez pedido, não lembra
      if (!snap.empty) return;

      // Verifica se tem cardápio da semana atual disponível
      const menuSnap = await fb.getDoc(global.getMenuDocRef());
      if (!menuSnap.exists || !menuSnap.data().menuImageBase64) return;

      // Controle de tempo: só lembra a cada 15 min (900000 ms)
      const now = Date.now();
      const lastReminder = checkerState.lastReminderTime || 0;
      if (now - lastReminder < 15 * 60 * 1000) return;

      // Mostra lembrete
      showLocalNotification(
        '⏰ Lembrete: Faça seu pedido!',
        'O cardápio desta semana está disponível. Não esqueça de escolher seus pratos!',
        { type: 'reminder', tag: 'reminder-' + Date.now() }
      );
      checkerState.lastReminderTime = now;
    } catch (e) { console.warn('checkEmployeeReminder error:', e); }
  }

  // Loop principal. Cardapio novo, pedidos e "todos concluiram" chegam por push real
  // (notificationTrigger.js + Cloudflare Worker); aqui fica so o lembrete do funcionario.
  async function runChecks() {
    if (!auth.currentUser || checkerState.isAdmin) return;
    await checkEmployeeReminder();
  }

  // Inicia o checker (chamado após login)
  global.startNotificationChecker = async function(isAdmin, rgf, name) {
    checkerState.isAdmin = isAdmin;
    checkerState.employeeRGF = rgf;
    checkerState.employeeName = name;

    // Pede permissão
    await requestNotificationPermission();

    // Para intervalo anterior se existir
    if (checkerState.intervalId) clearInterval(checkerState.intervalId);

    // Roda a cada 30 segundos (ajustável)
    checkerState.intervalId = setInterval(runChecks, 30000);
    console.log('Notification checker iniciado (30s interval)');
  };

  // Para o checker (logout)
  global.stopNotificationChecker = function() {
    if (checkerState.intervalId) {
      clearInterval(checkerState.intervalId);
      checkerState.intervalId = null;
    }
    checkerState.isAdmin = false;
    checkerState.employeeRGF = null;
    checkerState.employeeName = null;
    console.log('Notification checker parado');
  };

  // Exposição para debug
  global.__notificationChecker = checkerState;
})(window);