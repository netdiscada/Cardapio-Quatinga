// Cardapio Quatinga v3 - notificationTrigger.js
// Pede ao Cloudflare Worker para disparar os push (FCM) do APK e do site.
// O Worker confere o login (ID token do Firebase) e monta os textos; aqui so dizemos o que aconteceu.
// Incluir no index.html ANTES de app.js: <script src="js/notificationTrigger.js"></script>

(function (global) {
  const auth = global.auth;

  const NOTIFY_ENDPOINT = 'https://cardapio-push.menino-belu90.workers.dev';
  const PENDING_KEY = 'pendingOrderNotifications';

  async function callNotifyEndpoint(payload) {
    const user = auth && auth.currentUser;
    if (!user) throw new Error('sem login');
    const idToken = await user.getIdToken();
    const res = await fetch(NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    console.log('[notify]', payload.type, res.status, data);
    if (!res.ok) throw new Error('notify ' + res.status);
    return data;
  }

  // Usado pela aba Dev (aviso personalizado e estatisticas)
  global.callNotifyEndpoint = callNotifyEndpoint;

  // ADM lancou cardapio -> todos os funcionarios
  global.triggerNewMenuNotification = async function (isNextWeek) {
    try { await callNotifyEndpoint({ type: 'new_menu', isNextWeek: isNextWeek !== false }); }
    catch (e) { console.warn('Aviso de cardapio novo falhou:', e); }
  };

  // Funcionario terminou o pedido -> ADM ("Fulano completou seu cardapio" e, se for o
  // ultimo, "todos concluiram"). Se estiver sem internet, guarda e manda depois.
  function readPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (e) { return []; }
  }
  function writePending(list) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (e) {}
  }

  async function flushPendingOrderNotifications() {
    const pending = readPending();
    if (!pending.length || !navigator.onLine || !(auth && auth.currentUser)) return;
    const restantes = [];
    for (const item of pending) {
      try {
        const data = await callNotifyEndpoint({ type: 'order_done', rgf: item.rgf, isNextWeek: item.isNextWeek });
        // Pedido offline ainda nao chegou ao Firestore: tenta de novo mais tarde
        if (data && data.error === 'Pedido nao encontrado' && Date.now() - item.at < 3 * 24 * 3600 * 1000) restantes.push(item);
      } catch (e) {
        restantes.push(item);
      }
    }
    writePending(restantes);
    if (restantes.length) setTimeout(flushPendingOrderNotifications, 60000);
  }

  global.triggerOrderDoneNotification = function (orderData) {
    const rgf = String(orderData.employeeRGF || '').trim();
    if (!rgf) return;
    const pending = readPending().filter(p => !(p.rgf === rgf && p.isNextWeek === !!orderData.isNextWeek));
    pending.push({ rgf, isNextWeek: !!orderData.isNextWeek, at: Date.now() });
    writePending(pending);
    flushPendingOrderNotifications();
  };

  window.addEventListener('online', () => setTimeout(flushPendingOrderNotifications, 5000));
  if (auth) auth.onAuthStateChanged(user => { if (user) setTimeout(flushPendingOrderNotifications, 3000); });
})(window);
