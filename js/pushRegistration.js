// Cardapio Quatinga v3 - pushRegistration.js
// Registra o token FCM do dispositivo no Firestore (coleção deviceTokens)
// com role (funcionario/admin) e active=true — lido pelo Cloudflare Worker
// Incluir no index.html ANTES de app.js (já incluído).

(function (global) {
  const db = global.db;
  const auth = global.auth;
  const APP_CONFIG = global.APP_CONFIG;

  async function saveTokenToFirestore(token, role, rgf) {
    try {
      await db.collection('deviceTokens').doc(token).set({
        token: token,
        rgf: rgf || null,
        role: role, // 'funcionario' | 'admin'
        active: true,
        platform: 'android',
        updatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('Token FCM salvo no Firestore (role: ' + role + ')');
    } catch (err) {
      console.error('Erro ao salvar token FCM:', err);
    }
  }

  async function registerDeviceToken() {
    if (!window.Capacitor || !Capacitor.isNativePlatform || !Capacitor.Plugins || !Capacitor.Plugins.PushNotifications) {
      console.log('PushNotifications indisponível (fora do APK) — registro de token ignorado.');
      return;
    }
    const Push = Capacitor.Plugins.PushNotifications;
    try {
      // Garante permissão (Android 13+)
      const perm = await Push.requestPermissions();
      if (perm.receive !== 'granted') {
        console.warn('Permissão de notificação negada.');
        return;
      }

      // Listener: token recebido do FCM
      await Push.addListener('registration', async (tokenObj) => {
        const token = tokenObj && (tokenObj.value || tokenObj.token);
        if (!token) return;

        // Determina role
        const isAdmin = !!(auth && auth.currentUser && auth.currentUser.uid === APP_CONFIG.ADMIN_UID);
        const role = isAdmin ? 'admin' : 'funcionario';

        // Pega RGF do input (se existir) para associar token ao funcionário
        const rgfEl = document.getElementById('employeeRGF');
        const rgf = rgfEl && rgfEl.value ? rgfEl.value.trim() : null;

        await saveTokenToFirestore(token, role, rgf);
        localStorage.setItem('fcmToken', token);
      });

      await Push.addListener('registrationError', (err) => {
        console.error('Erro no registro FCM:', err);
      });

      // Registra (dispara o listener 'registration')
      await Push.register();
      console.log('Registro FCM solicitado.');
    } catch (e) {
      console.warn('pushRegistration falhou:', e);
    }
  }

  // Re-registra quando o usuário digita o RGF (associa token ao funcionário)
  function bindRgfReassociation() {
    const rgfEl = document.getElementById('employeeRGF');
    if (!rgfEl) return;
    rgfEl.addEventListener('change', async () => {
      const token = localStorage.getItem('fcmToken');
      const isAdmin = !!(auth && auth.currentUser && auth.currentUser.uid === APP_CONFIG.ADMIN_UID);
      if (token) await saveTokenToFirestore(token, isAdmin ? 'admin' : 'funcionario', rgfEl.value.trim());
    });
  }

  // Inicia após DOM pronto e usuário logado (anônimo ou admin)
  function init() {
    bindRgfReassociation();
    if (auth && auth.currentUser) {
      registerDeviceToken();
    } else if (auth) {
      const unsub = auth.onAuthStateChanged((user) => {
        if (user) {
          registerDeviceToken();
          unsub && unsub();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.registerDeviceToken = registerDeviceToken;
})(window);