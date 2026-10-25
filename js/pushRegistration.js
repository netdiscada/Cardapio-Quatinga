// Cardapio Quatinga v3 - pushRegistration.js
// Registra o token FCM do aparelho na colecao deviceTokens (role funcionario/admin, rgf, active).
//  - APK: token nativo pelo plugin PushNotifications do Capacitor
//  - Site: token web pelo Firebase Cloud Messaging (service worker sw-v2.js)
// O token e salvo de novo quando o login muda (ADM entra/sai) e quando o RGF muda.

(function (global) {
  const db = global.db;
  const auth = global.auth;
  const APP_CONFIG = global.APP_CONFIG;

  // Chave publica "Certificados push da Web" do projeto (Firebase > Cloud Messaging)
  const WEB_PUSH_VAPID_KEY = 'BIL4MyC_jrf2cmwU5EUnEWBE4rQGNzg9Eiu2rf48QpRnxLtFpck-iBidDn4jGy993CKza2Td3-YBgwVhmvmD6ww';

  const isNative = !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

  function currentRole() {
    return auth?.currentUser?.uid === APP_CONFIG.ADMIN_UID ? 'admin' : 'funcionario';
  }

  function currentRgf() {
    const rgfEl = document.getElementById('employeeRGF');
    return rgfEl?.value?.trim() || localStorage.getItem('employeeRGF') || null;
  }

  async function saveToken(token, platform) {
    if (!token || !auth?.currentUser) return;
    const role = currentRole();
    try {
      await db.collection('deviceTokens').doc(token).set({
        token,
        rgf: role === 'admin' ? null : currentRgf(),
        role,
        active: true,
        platform,
        updatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('[pushRegistration] Token salvo:', token.substring(0, 20) + '...', 'role:', role, 'platform:', platform);
    } catch (err) {
      console.error('[pushRegistration] Erro ao salvar token:', err);
    }
  }

  function saveKnownTokens() {
    const native = localStorage.getItem('fcmToken');
    const web = localStorage.getItem('fcmWebToken');
    if (isNative && native) saveToken(native, 'android');
    if (!isNative && web) saveToken(web, 'web');
  }

  // ===== NATIVO (Capacitor/FCM) =====
  let nativeListenersAdded = false;
  async function registerNativeToken() {
    const Push = global.Capacitor?.Plugins?.PushNotifications;
    if (!isNative || !Push) return;
    try {
      const perm = await Push.requestPermissions();
      console.log('[pushRegistration] Permissão nativa:', perm.receive);
      global.__pushStatus = perm.receive;
      if (global.renderHome) global.renderHome();
      if (perm.receive !== 'granted') return;

      if (!nativeListenersAdded) {
        nativeListenersAdded = true;
        await Push.addListener('registration', async (tokenObj) => {
          const token = tokenObj?.value || tokenObj?.token;
          if (!token) return;
          localStorage.setItem('fcmToken', token);
          await saveToken(token, 'android');
        });
        await Push.addListener('registrationError', (err) => {
          console.error('[pushRegistration] registrationError nativo:', err);
        });
      }
      await Push.register();
    } catch (e) {
      console.error('[pushRegistration] Falha nativa:', e);
    }
  }

  // ===== SITE (Firebase Cloud Messaging web) =====
  function webPushSupported() {
    return !isNative && 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window && !!global.firebase?.messaging;
  }

  function sameKey(buffer, base64url) {
    if (!buffer) return false;
    const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64url.length % 4) % 4);
    const expected = atob(padded);
    const actual = new Uint8Array(buffer);
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) if (actual[i] !== expected.charCodeAt(i)) return false;
    return true;
  }

  let webMessageListenerAdded = false;
  async function registerWebPush() {
    if (!webPushSupported() || Notification.permission !== 'granted') return;
    try {
      if (!(await global.firebase.messaging.isSupported())) return;
      const reg = await navigator.serviceWorker.ready;
      // Inscricao antiga (Web Push com outra chave) impede o FCM de funcionar: remove
      const old = await reg.pushManager.getSubscription();
      if (old && !sameKey(old.options && old.options.applicationServerKey, WEB_PUSH_VAPID_KEY)) {
        await old.unsubscribe();
      }
      const messaging = global.firebase.messaging();
      const token = await messaging.getToken({ vapidKey: WEB_PUSH_VAPID_KEY, serviceWorkerRegistration: reg });
      if (!token) return;
      localStorage.setItem('fcmWebToken', token);
      await saveToken(token, 'web');

      // Com o site aberto o navegador nao mostra o push sozinho: mostra pelo service worker
      if (!webMessageListenerAdded) {
        webMessageListenerAdded = true;
        messaging.onMessage((payload) => {
          const n = payload.notification || {};
          const data = payload.data || {};
          try { global.showToast && global.showToast(n.title || 'Cardápio Quatinga', 'info', 4000); } catch (e) {}
          reg.showNotification(n.title || 'Cardápio Quatinga', {
            body: n.body || '',
            icon: 'icon.png',
            tag: data.action || 'cardapio',
            data: { action: data.action, isNextWeek: data.isNextWeek }
          }).catch(() => {});
        });
      }
    } catch (e) {
      console.error('[pushRegistration] Falha no push do site:', e);
    }
  }

  // Site: o iPhone (e varios navegadores) so deixam pedir permissao depois de um toque.
  // O botao "Ativar" fica no cartao de avisos da tela de inicio (home.js).
  function showEnableButton() {
    if (!webPushSupported() || Notification.permission !== 'default') return;
    global.__pushStatus = 'default';
    global.enableWebPush = async () => {
      const perm = await Notification.requestPermission();
      global.__pushStatus = perm;
      if (perm === 'granted') {
        global.showToast && global.showToast('Notificações ativadas!', 'success');
        registerWebPush();
      }
      if (global.renderHome) global.renderHome();
    };
    if (global.renderHome) global.renderHome();
  }

  // Re-registra/associa token ao digitar RGF
  function bindRgfReassociation() {
    const rgfEl = document.getElementById('employeeRGF');
    if (!rgfEl) return;
    rgfEl.addEventListener('change', saveKnownTokens);
  }

  function init() {
    bindRgfReassociation();
    if (!auth) return;
    let started = false;
    auth.onAuthStateChanged((user) => {
      if (!user) return;
      if (!started) {
        started = true;
        registerNativeToken();
        registerWebPush();
        showEnableButton();
      } else {
        // ADM entrou ou saiu: atualiza o papel do aparelho
        saveKnownTokens();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.registerDeviceToken = registerNativeToken; // compatibilidade
  global.registerWebPush = registerWebPush;
})(window);
