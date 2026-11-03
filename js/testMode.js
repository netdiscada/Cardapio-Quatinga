// Cardapio Quatinga - testMode.js
// SÓ carrega em http://localhost:8091 (ver config.js). Banco e login são emuladores FALSOS do PC
// (Firestore 8080, Auth 9099); aqui ficam a faixa "MODO TESTE" e o Worker simulado, para que nada
// de teste chegue ao cardápio verdadeiro nem aos funcionários.

(function (global) {
  function addBanner() {
    if (document.getElementById('test-mode-banner')) return;
    const b = document.createElement('div');
    b.id = 'test-mode-banner';
    b.textContent = 'MODO TESTE · dados falsos';
    b.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99999;' +
      'background:#DC2626;color:#fff;font:800 10px/1 system-ui,sans-serif;letter-spacing:.06em;' +
      'padding:3px 12px;border-radius:0 0 8px 8px;pointer-events:none;text-transform:uppercase;';
    document.body.appendChild(b);
  }
  if (document.body) addBanner();
  else document.addEventListener('DOMContentLoaded', addBanner);

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // Respostas falsas no formato do Worker (push-worker/worker.js)
  global.fakeNotifyEndpoint = async function (payload) {
    console.log('[teste] Worker simulado:', payload && payload.type);
    const type = payload && payload.type;
    if (type === 'stats') {
      return {
        aparelhos: { app: 1, site: 2, semRgf: 0, adm: 1 },
        funcionarios: 5,
        comAviso: 3,
        listaComAviso: [
          { rgf: '111111', nome: 'FUNCIONÁRIO TESTE UM', app: 1, site: 1 },
          { rgf: '222222', nome: 'FUNCIONÁRIO TESTE DOIS', app: 0, site: 1 },
          { rgf: '333333', nome: 'FUNCIONÁRIO TESTE TRÊS', app: 1, site: 0 }
        ],
        semAviso: [
          { rgf: '444444', nome: 'FUNCIONÁRIO TESTE QUATRO' },
          { rgf: '555555', nome: 'FUNCIONÁRIO TESTE CINCO' }
        ]
      };
    }
    if (type === 'menu_ai') {
      await wait(1500);
      const dia = (principal, opcao, guarnicao) => ({ principal, opcao, guarnicao });
      return {
        provider: 'gemini', model: 'modo-teste', ms: 1500,
        days: {
          segundafeira: dia('', '', ''),
          tercafeira: dia('Lasanha de carne', 'Frango grelhado', 'Salada de alface e tomate'),
          quartafeira: dia('Bife acebolado', 'Omelete de legumes', 'Arroz e feijão tropeiro'),
          quintafeira: dia('Feijoada completa', 'Peixe assado', 'Couve refogada'),
          sextafeira: dia('Strogonoff de frango', 'Linguiça acebolada', 'Batata palha')
        }
      };
    }
    if (type && String(type).indexOf('fin_') === 0) return { error: 'Finanças não funciona no modo teste' };
    if (type === 'ai_config') return { error: 'Configuração da IA não funciona no modo teste' };
    return { ok: true, sent: 0, fake: true };
  };
})(window);
