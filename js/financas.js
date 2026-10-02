// Cardapio Quatinga v3 - financas.js
// Aba de Financas do funcionario: login por RGF+senha (hash SHA-256 com salt),
// lancamentos mensais, resumo do mes, exportacao em PDF (jsPDF).
// Colecoes Firestore:
//   funcionarios_senhas/{rgf} -> { senhaHash: string }
//   financas/{rgf}/lancamentos/{docId} -> {mes, ano, categoria, valor, tipo, descricao, createdAt}
// Carregado apos userhelp.js. Escopo global via window.

(function (global) {
  const fb = global.fb;

  const CATEGORIAS = [
    { id: 'cartao', label: '💳 Cartão de Crédito' },
    { id: 'aluguel', label: '🏠 Aluguel' },
    { id: 'supermercado', label: '🛒 Supermercado' },
    { id: 'transporte', label: '🚗 Transporte' },
    { id: 'saude', label: '⚕️ Saúde' },
    { id: 'lazer', label: '🎉 Lazer' },
    { id: 'educacao', label: '📚 Educação' },
    { id: 'outros', label: '💸 Outros' },
  ];

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const SALT = 'quatinga-financas-2026';

  // Estado local da aba
  const F = {
    rgf: null,
    autenticado: false,
    mesAtual: null,
    anoAtual: null,
    lancamentos: [],
    unsubscribe: null,
  };

  // ===== Hash SHA-256 =====
  async function sha256(texto) {
    const enc = new TextEncoder().encode(texto);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function fmtMoney(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    if (isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // ===== Referências Firestore =====
  function senhaRef(rgf) {
    return fb.db.collection('funcionarios_senhas').doc(rgf);
  }

  function lancamentosRef(rgf) {
    return fb.db.collection('financas').doc(rgf).collection('lancamentos');
  }

  // ===== Telas =====
  function telas() {
    return {
      login: document.getElementById('fin-login'),
      cadastro: document.getElementById('fin-cadastro'),
      painel: document.getElementById('fin-painel'),
    };
  }

  function mostrarTela(nome) {
    const t = telas();
    if (!t.login) return;
    t.login.classList.toggle('hidden', nome !== 'login');
    t.cadastro.classList.toggle('hidden', nome !== 'cadastro');
    t.painel.classList.toggle('hidden', nome !== 'painel');
  }

  function setStatus(elId, msg, tipo) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden', 'text-red-600', 'text-green-600', 'text-blue-600',
      'dark:text-red-400', 'dark:text-green-400', 'dark:text-blue-400');
    el.classList.add(tipo === 'error' ? 'text-red-600' : tipo === 'ok' ? 'text-green-600' : 'text-blue-600',
      tipo === 'error' ? 'dark:text-red-400' : tipo === 'ok' ? 'dark:text-green-400' : 'dark:text-blue-400');
    if (!msg) el.classList.add('hidden');
  }

  // ===== Login / Cadastro =====
  async function verificarRgf(rgf) {
    const doc = await fb.getDoc(senhaRef(rgf));
    return doc.exists ? doc.data().senhaHash : null;
  }

  async function handleIdentificar(e) {
    e.preventDefault();
    const input = document.getElementById('fin-rgf-input');
    const rgf = (input.value || '').trim().replace(/\D/g, '');
    if (!rgf) { setStatus('fin-status', 'Digite seu RGF.', 'error'); return; }

    // Se já tem senha salva no dispositivo, tenta login direto
    const senhaSalva = localStorage.getItem('fin_senha_' + rgf);
    try {
      const hashSalvo = await verificarRgf(rgf);
      if (hashSalvo && senhaSalva) {
        const hashTentativa = await sha256(senhaSalva + SALT);
        if (hashTentativa === hashSalvo) {
          entrar(rgf);
          return;
        }
        localStorage.removeItem('fin_senha_' + rgf); // senha mudou em outro aparelho
      }
      if (hashSalvo) {
        // Tem senha: mostra campo de senha do login
        F.rgf = rgf;
        document.getElementById('fin-senha-wrap').classList.remove('hidden');
        document.getElementById('fin-senha-input').focus();
        setStatus('fin-status', 'RGF encontrado. Digite sua senha.', 'info');
      } else {
        // Não tem senha: vai pro cadastro
        F.rgf = rgf;
        mostrarTela('cadastro');
        setStatus('fin-cad-status', 'Primeiro acesso: crie sua senha. Só você a conhece.', 'info');
      }
    } catch (err) {
      setStatus('fin-status', 'Erro ao consultar: ' + err.message, 'error');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const senha = (document.getElementById('fin-senha-input').value || '').trim();
    if (!senha) { setStatus('fin-status', 'Digite a senha.', 'error'); return; }
    try {
      const hashSalvo = await verificarRgf(F.rgf);
      const hashTentativa = await sha256(senha + SALT);
      if (hashTentativa === hashSalvo) {
        if (document.getElementById('fin-lembrar').checked) {
          localStorage.setItem('fin_senha_' + F.rgf, senha);
        }
        entrar(F.rgf);
      } else {
        setStatus('fin-status', 'Senha incorreta.', 'error');
      }
    } catch (err) {
      setStatus('fin-status', 'Erro ao entrar: ' + err.message, 'error');
    }
  }

  async function handleCadastrar(e) {
    e.preventDefault();
    const s1 = (document.getElementById('fin-cad-senha1').value || '').trim();
    const s2 = (document.getElementById('fin-cad-senha2').value || '').trim();
    if (s1.length < 4) { setStatus('fin-cad-status', 'A senha precisa ter pelo menos 4 dígitos.', 'error'); return; }
    if (s1 !== s2) { setStatus('fin-cad-status', 'As senhas não conferem.', 'error'); return; }
    try {
      const hash = await sha256(s1 + SALT);
      await fb.setDoc(senhaRef(F.rgf), { senhaHash: hash });
      if (document.getElementById('fin-cad-lembrar').checked) {
        localStorage.setItem('fin_senha_' + F.rgf, s1);
      }
      entrar(F.rgf);
    } catch (err) {
      setStatus('fin-cad-status', 'Erro ao salvar senha: ' + err.message, 'error');
    }
  }

  function entrar(rgf) {
    F.rgf = rgf;
    F.autenticado = true;
    const h = new Date();
    F.mesAtual = h.getMonth();
    F.anoAtual = h.getFullYear();
    mostrarTela('painel');
    document.getElementById('fin-rgf-label').textContent = 'RGF ' + rgf;
    renderMesSeletor();
    iniciarListenerLancamentos();
    setStatus('fin-status', '', 'info');
  }

  function sair() {
    if (F.unsubscribe) { F.unsubscribe(); F.unsubscribe = null; }
    F.rgf = null;
    F.autenticado = false;
    F.lancamentos = [];
    document.getElementById('fin-senha-wrap').classList.add('hidden');
    document.getElementById('fin-senha-input').value = '';
    document.getElementById('fin-rgf-input').value = '';
    mostrarTela('login');
  }

  // ===== Lançamentos =====
  function iniciarListenerLancamentos() {
    if (F.unsubscribe) F.unsubscribe();
    const q = fb.query(lancamentosRef(F.rgf),
      fb.where('ano', '==', F.anoAtual),
      fb.where('mes', '==', F.mesAtual),
      fb.orderBy('createdAt', 'desc'));
    F.unsubscribe = fb.onSnapshot(q, (snap) => {
      F.lancamentos = [];
      snap.forEach(doc => F.lancamentos.push({ id: doc.id, ...doc.data() }));
      renderPainel();
    }, (err) => {
      // Sem orderBy composto/index se falhar: fallback sem order
      const q2 = fb.query(lancamentosRef(F.rgf),
        fb.where('ano', '==', F.anoAtual),
        fb.where('mes', '==', F.mesAtual));
      F.unsubscribe = fb.onSnapshot(q2, (snap) => {
        F.lancamentos = [];
        snap.forEach(doc => F.lancamentos.push({ id: doc.id, ...doc.data() }));
        renderPainel();
      });
    });
  }

  function mudarMes(delta) {
    let m = F.mesAtual + delta;
    let a = F.anoAtual;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    F.mesAtual = m; F.anoAtual = a;
    renderMesSeletor();
    if (F.autenticado) iniciarListenerLancamentos();
  }

  function renderMesSeletor() {
    const el = document.getElementById('fin-mes-label');
    if (el) el.textContent = MESES[F.mesAtual] + ' ' + F.anoAtual;
  }

  function renderPainel() {
    const listaEl = document.getElementById('fin-lista');
    if (!listaEl) return;

    let entradas = 0, saidas = 0;
    const catMaisGasta = {};

    F.lancamentos.forEach(l => {
      const v = Math.abs(parseFloat(l.valor));
      if (l.tipo === 'entrada') entradas += v;
      else {
        saidas += v;
        catMaisGasta[l.categoria] = (catMaisGasta[l.categoria] || 0) + v;
      }
    });

    const sobra = entradas - saidas;
    document.getElementById('fin-entradas').textContent = fmtMoney(entradas);
    document.getElementById('fin-saidas').textContent = fmtMoney(saidas);
    const sobraEl = document.getElementById('fin-sobra');
    sobraEl.textContent = fmtMoney(sobra);
    sobraEl.className = 'text-xl font-bold ' + (sobra >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400');

    if (F.lancamentos.length === 0) {
      listaEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Nenhum lançamento neste mês. Toque em "+ Adicionar" para começar.</p>';
      return;
    }

    const catLabel = (id) => (CATEGORIAS.find(c => c.id === id) || { label: id }).label;
    listaEl.innerHTML = F.lancamentos.map(l => {
      const v = Math.abs(parseFloat(l.valor));
      const neg = l.tipo !== 'entrada';
      return `<div class="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
        <div class="min-w-0">
          <p class="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">${l.descricao || catLabel(l.categoria)}</p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400">${catLabel(l.categoria)} · ${String(l.dia || '').padStart(2, '0')}/${String(l.mes + 1).padStart(2, '0')}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="font-bold text-sm ${neg ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}">${neg ? '−' : '+'} ${fmtMoney(v)}</span>
          <button type="button" data-del="${l.id}" class="fin-del text-red-500 hover:text-red-700 text-lg font-bold px-1" title="Excluir">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  async function handleAddLancamento(e) {
    e.preventDefault();
    if (!F.autenticado) return;
    const cat = document.getElementById('fin-add-categoria').value;
    const valorRaw = (document.getElementById('fin-add-valor').value || '').replace(',', '.');
    const valor = Math.abs(parseFloat(valorRaw));
    const descricao = (document.getElementById('fin-add-descricao').value || '').trim();
    const dia = parseInt(document.getElementById('fin-add-dia').value, 10) || new Date().getDate();
    const tipo = document.querySelector('input[name="fin-add-tipo"]:checked')?.value || 'saida';

    if (!valor || isNaN(valor) || valor <= 0) {
      global.showToast('Digite um valor válido.', 'error');
      return;
    }
    try {
      await fb.setDoc(lancamentosRef(F.rgf).doc(), {
        mes: F.mesAtual,
        ano: F.anoAtual,
        dia,
        categoria: cat,
        valor: tipo === 'saida' ? -valor : valor,
        tipo,
        descricao,
        createdAt: fb.Timestamp.now(),
      });
      global.showToast('Lançamento salvo!', 'success');
      document.getElementById('fin-add-valor').value = '';
      document.getElementById('fin-add-descricao').value = '';
      document.getElementById('fin-add-modal').classList.add('hidden');
    } catch (err) {
      global.showToast('Erro ao salvar: ' + err.message, 'error');
    }
  }

  async function handleDeleteLancamento(id) {
    global.showCustomConfirm('Excluir este lançamento?', async () => {
      try {
        await fb.deleteDoc(lancamentosRef(F.rgf).doc(id));
        global.showToast('Lançamento excluído.', 'success');
      } catch (err) {
        global.showToast('Erro ao excluir.', 'error');
      }
    });
  }

  async function handleTrocarSenha(e) {
    e.preventDefault();
    const atual = (document.getElementById('fin-troca-atual').value || '').trim();
    const n1 = (document.getElementById('fin-troca-nova1').value || '').trim();
    const n2 = (document.getElementById('fin-troca-nova2').value || '').trim();
    if (n1.length < 4) { setStatus('fin-troca-status', 'Nova senha precisa de 4+ dígitos.', 'error'); return; }
    if (n1 !== n2) { setStatus('fin-troca-status', 'Senhas novas não conferem.', 'error'); return; }
    try {
      const hashSalvo = await verificarRgf(F.rgf);
      if (await sha256(atual + SALT) !== hashSalvo) {
        setStatus('fin-troca-status', 'Senha atual incorreta.', 'error');
        return;
      }
      await fb.setDoc(senhaRef(F.rgf), { senhaHash: await sha256(n1 + SALT) });
      if (localStorage.getItem('fin_senha_' + F.rgf)) localStorage.setItem('fin_senha_' + F.rgf, n1);
      setStatus('fin-troca-status', 'Senha alterada!', 'ok');
      document.getElementById('fin-troca-modal').classList.add('hidden');
    } catch (err) {
      setStatus('fin-troca-status', 'Erro: ' + err.message, 'error');
    }
  }

  // ===== Exportar PDF =====
  function exportarPDF() {
    if (!F.lancamentos.length && !confirm('Sem lançamentos neste mês. Exportar mesmo assim?')) return;
    const doc = new jspdf.jsPDF();
    const titulo = `Finanças — RGF ${F.rgf} — ${MESES[F.mesAtual]}/${F.anoAtual}`;
    doc.setFontSize(16);
    doc.text(titulo, 14, 18);

    let entradas = 0, saidas = 0;
    F.lancamentos.forEach(l => {
      const v = Math.abs(parseFloat(l.valor));
      if (l.tipo === 'entrada') entradas += v; else saidas += v;
    });

    doc.setFontSize(11);
    doc.text(`Entradas: ${fmtMoney(entradas)}`, 14, 30);
    doc.text(`Saídas:    ${fmtMoney(saidas)}`, 14, 37);
    doc.text(`Sobra:     ${fmtMoney(entradas - saidas)}`, 14, 44);

    const catLabel = (id) => (CATEGORIAS.find(c => c.id === id) || { label: id }).label.replace(/^[^ ]+ /, '');
    const rows = F.lancamentos.map(l => [
      `${String(l.dia || '').padStart(2, '0')}/${String(l.mes + 1).padStart(2, '0')}/${l.ano}`,
      l.descricao || catLabel(l.categoria),
      catLabel(l.categoria),
      (l.tipo === 'entrada' ? '+' : '−') + ' ' + fmtMoney(Math.abs(parseFloat(l.valor))),
    ]);

    doc.autoTable({
      head: [['Data', 'Descrição', 'Categoria', 'Valor']],
      body: rows,
      startY: 52,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`financas_${F.rgf}_${F.anoAtual}-${String(F.mesAtual + 1).padStart(2, '0')}.pdf`);
  }

  // ===== Bindings =====
  function bindFinancas() {
    const sec = document.getElementById('user-financas-section');
    if (!sec) return;

    document.getElementById('fin-identificar-form').addEventListener('submit', handleIdentificar);
    document.getElementById('fin-login-form').addEventListener('submit', handleLogin);
    document.getElementById('fin-cadastro-form').addEventListener('submit', handleCadastrar);
    document.getElementById('fin-cad-cancel').addEventListener('click', () => mostrarTela('login'));
    document.getElementById('fin-sair').addEventListener('click', sair);
    document.getElementById('fin-mes-prev').addEventListener('click', () => mudarMes(-1));
    document.getElementById('fin-mes-next').addEventListener('click', () => mudarMes(1));
    document.getElementById('fin-novo-btn').addEventListener('click', () => {
      document.getElementById('fin-add-modal').classList.remove('hidden');
    });
    document.querySelectorAll('#fin-add-modal .cancel-modal-btn').forEach(b =>
      b.addEventListener('click', () => document.getElementById('fin-add-modal').classList.add('hidden')));
    document.getElementById('fin-add-form').addEventListener('submit', handleAddLancamento);
    document.getElementById('fin-lista').addEventListener('click', (e) => {
      const btn = e.target.closest('.fin-del');
      if (btn) handleDeleteLancamento(btn.dataset.del);
    });
    document.getElementById('fin-trocar-senha').addEventListener('click', () => {
      document.getElementById('fin-troca-modal').classList.remove('hidden');
    });
    document.querySelectorAll('#fin-troca-modal .cancel-modal-btn').forEach(b =>
      b.addEventListener('click', () => document.getElementById('fin-troca-modal').classList.add('hidden')));
    document.getElementById('fin-troca-form').addEventListener('submit', handleTrocarSenha);
    document.getElementById('fin-exportar').addEventListener('click', exportarPDF);

    // Data padrão do lançamento = hoje
    const hoje = new Date().getDate();
    const diaEl = document.getElementById('fin-add-dia');
    if (diaEl) diaEl.value = hoje;

    mostrarTela('login');
  }

  global.initFinancas = bindFinancas;
})(window);
