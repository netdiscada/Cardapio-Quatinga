// Cardapio Quatinga v2 - config.js
// Configuracao central do app (extraida fielmente do v1.x).
// Carregado PRIMEIRO no index.html como script classico (escopo global via window).

(function (global) {
  // ===== MODO TESTE (dados falsos) =====
  // Só liga em http://localhost:8091 (servidor de teste do PC; o site publicado e o APK nunca
  // usam essa porta). Troca o Firebase pelos emuladores do PC, desliga o push e simula o Worker,
  // para testar tudo sem tocar no cardápio verdadeiro. Ver js/testMode.js.
  global.__TEST_MODE = global.location.hostname === 'localhost' && global.location.port === '8091';
  if (global.__TEST_MODE) {
    document.write('<script src="js/testMode.js?t=' + Date.now() + '"><\/script>');
  }

  // ===== Firebase Config ===== (identica ao v1.x) =====
  global.firebaseConfig = global.__TEST_MODE ? {
    apiKey: 'fake-api-key',
    authDomain: 'localhost',
    projectId: 'demo-cardapio',
    storageBucket: 'demo-cardapio.appspot.com',
    messagingSenderId: '1',
    appId: '1:1:web:fake',
  } : {
    apiKey: "AIzaSyDVaHDQ-gqnRHCEPopne1kzhIKAo2gIIGQ",
    authDomain: "cardapio-8ddea.firebaseapp.com",
    projectId: "cardapio-8ddea",
    storageBucket: "cardapio-8ddea.appspot.com",
    messagingSenderId: "1019677985212",
    appId: "1:1019677985212:web:57c7820a62585a867dc3b9",
  };

  // ===== APP Config ===== (identico ao v1.x) =====
  global.APP_CONFIG = {
    ADMIN_UID: 'LqAXao4FuOQAvzS3uQAd9et6OnK2',
  };

  // ===== Constantes do dominio ===== (identicas ao v1.x) =====
  global.weekDays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
  global.mealOptions = [
    { name: "Prato Principal", emoji: "🍽️", description: "A opção do dia, conforme a imagem" },
    { name: "Opção", emoji: "🍲", description: "A segunda opção do dia, se houver" },
    { name: "Omelete", emoji: "🍳", description: "Opção fixa" },
    { name: "Filé de frango", emoji: "🍗", description: "Opção fixa" }
  ];

  // ===== Helpers ===== =====
  function getDayId(dayName) {
    return dayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();
  }
  global.getDayId = getDayId;

  // Escapa texto livre (nome, anotacoes) antes de inserir via innerHTML
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  global.escapeHtml = escapeHtml;
})(window);
