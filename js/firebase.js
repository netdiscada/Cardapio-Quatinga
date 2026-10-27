// Cardapio Quatinga v2 - firebase.js
// Inicializacao do Firebase (build compat v9/v10, equivalente funcional aos ES-modules
// do v1.x) com cache local offline multi-abas (habilitado por padrao no build compat).
// Carregado em 2o lugar no index.html (depois de config.js). Escopo global via window.

(function (global) {
  let app = null;
  let db = null;
  let auth = null;

  try {
    const config = global.firebaseConfig;
    app = global.firebase.initializeApp(config);
    // No build compat o Firestore ja vem com persistencia offline multi-abas habilitada
    // por padrao (equivalente ao persistentLocalCache + persistentMultipleTabManager do v1.x).
    db = global.firebase.firestore(app);
    // Habilita persistência offline do Firestore (cache no celular)
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    auth = global.firebase.auth(app);
    trustSavedLogin(auth);
  } catch (error) {
    console.error("Erro ao inicializar Firebase: ", error);
    if (global.showToast) {
      global.showToast("Erro crítico de conexão: O app não conseguiu acessar o banco de dados.", 'error', 10000);
    }
  }

  // Sinal ruim com dados ligados: ao abrir, o Firebase Auth confere no servidor o login
  // salvo (renova o token e consulta a conta) antes de liberar o banco — até o cache do
  // celular — e cada chamada espera até 30 s. Com dados desligados falha na hora; com sinal
  // ruim o app ficava parado em "Aguardando cardápio...". Aqui o login salvo vale na hora
  // e a conferência roda por trás (se a conta não valer mais, o Auth desloga sozinho).
  function trustSavedLogin(compatAuth) {
    const impl = compatAuth && compatAuth._delegate;
    if (!impl || typeof impl.reloadAndSetCurrentUserOrClear !== 'function' || typeof impl.directlySetCurrentUser !== 'function') return;
    const original = impl.reloadAndSetCurrentUserOrClear;
    impl.reloadAndSetCurrentUserOrClear = function (user) {
      impl.reloadAndSetCurrentUserOrClear = original; // só vale para a abertura
      impl._initializationPromise.then(() => user.reload()).catch(() => {});
      return impl.directlySetCurrentUser(user);
    };
  }

  global.app = app;
  global.db = db;
  global.auth = auth;

  global.serverTimestamp = function () {
    return global.firebase.firestore.FieldValue.serverTimestamp();
  };

  // Refs de dados (funcoes para acesso tardio, pois db pode ser nulo se a init falhar)
  global.getMenuDocRef = function () {
    return global.db.doc("cardapio/semanal");
  };
  global.getFuncionariosCollectionRef = function () {
    return global.db.collection("funcionarios");
  };
})(window);