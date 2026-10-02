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
    return fb.doc(global.db, 'funcionarios_senhas', rgf);
  }

  function lancamentosRef(rgf) {
    return fb.doc(global.db, 'financas', rgf).collection('lancamentos');
  }
  function lancamentoRef(rgf, id) {
    return lancamentosRef(rgf).doc(id);
  }

  // ===== API Prefeitura (contracheque) =====
  const PREFEITURA_API = 'https://dadosadm.mogidascruzes.sp.gov.br/api';

  // Mescla de recebimento: a folha do mês X é recebida no mês X+1
  function mesRecebimento(mes, ano) {
    let m = mes + 1, a = ano;
    if (m > 11) { m = 0; a++; }
    return { mes: m, ano: a };
  }

  async function consultarContracheque(rgf) {
    const hoje = new Date();
    // Cache: verifica se já consultou nas últimas 24h
    const cacheKey = `fin_cc_${rgf}_${hoje.getFullYear()}`;
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      try {
        const c = JSON.parse(cache);
        if (Date.now() - c.timestamp < 86400000) return c.dados;
      } catch (e) { /* ignora cache quebrado */ }
    }

    const anoAtual = hoje.getFullYear();
    let results = [];
    for (let ano = anoAtual; ano >= anoAtual - 1 && results.length === 0; ano--) {
      try {
        const resp = await fetch(`${PREFEITURA_API}/folha_pagamento?matricula=${rgf}&ano=${ano}`);
        if (!resp.ok) continue;
        const data = await resp.json();
        if (data.results && data.results.length > 0) results = data.results;
      } catch (e) { /* offline ou erro */ }
    }
    if (!results.length) return null;
    const mensais = results.filter(r => r.tipo_folha === 'Folha de Pagamento Mensal');
    const pool = mensais.length > 0 ? mensais : results;
    // Lista todas as folhas (últimos 12 meses), ordenadas da mais recente
    const folhas = pool.sort((a, b) => (b.ano * 12 + b.mes) - (a.ano * 12 + a.mes));
    const latest = folhas[0];
    let verbas = [];
    try {
      const respF = await fetch(`${PREFEITURA_API}/detalhe_folha?idfunselec=${latest.idfunselec}`);
      if (respF.ok) {
        const fd = await respF.json();
        if (fd.results) verbas = fd.results;
      }
    } catch (e) { /* detalhe opcional */ }
    const dados = {
      folhas: [],
      latest: null,
    };
    // Processa CADA folha com suas verbas (adiantamento vem do detalhe)
    for (const f of folhas) {
      let verbasFolha = [];
      try {
        const respF = await fetch(`${PREFEITURA_API}/detalhe_folha?idfunselec=${f.idfunselec}`);
        if (respF.ok) {
          const fd = await respF.json();
          if (fd.results) verbasFolha = fd.results;
        }
      } catch (e) { /* sem detalhe */ }
      const adiantamentoVerbaF = verbasFolha.find(v => v.desnoverba && v.desnoverba.includes('ADIANTAMENTO'));
      const adiantamentoF = adiantamentoVerbaF ? Math.abs(parseFloat(adiantamentoVerbaF.valorverba)) : 0;
      const liquidoF = parseFloat(f.liquido) || 0;
      dados.folhas.push({
        mes: f.mes - 1, ano: f.ano,
        liquido: liquidoF,
        adiantamento: adiantamentoF,
        salarioDia5: Math.max(0, liquidoF - adiantamentoF),
        nome: f.nome,
      });
    }
    dados.latest = dados.folhas[0];
    // Salva no cache (24h)
    localStorage.setItem(cacheKey, JSON.stringify({ dados, timestamp: Date.now() }));
    return dados;
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
    fixosRecorrentes(F.mesAtual, F.anoAtual);
    contrachequeAuto();
  }

  // ===== Entradas automáticas do contracheque =====
  async function contrachequeAuto(silencioso) {
    try {
      const dados = await consultarContracheque(F.rgf);
      if (!dados) {
        if (!silencioso) global.showToast('Contracheque não encontrado na prefeitura.', 'error');
        return;
      }
      F.contracheque = dados;
      // Mescla as entradas do contracheque nos meses corretos de recebimento
      mesclarEntradasRecebimento(dados);
      if (!silencioso) global.showToast('Entradas do contracheque atualizadas!', 'success');
    } catch (err) {
      if (!silencioso) global.showToast('Erro ao consultar contracheque.', 'error');
    }
  }

  async function mesclarEntradasRecebimento(dados) {
    // Para cada folha, o recebimento é no mês seguinte (como você explicou)
    for (const folha of dados.folhas) {
      const rec = mesRecebimento(folha.mes, folha.ano);
      await mesclarEntradasMes(folha, rec.mes, rec.ano);
    }
  }

  async function mesclarEntradasMes(folha, mes, ano) {
    const snap = await fb.getDocs(fb.query(lancamentosRef(F.rgf),
      fb.where('ano', '==', ano), fb.where('mes', '==', mes)));
    let temAdiant = false, temSalario = false;
    snap.forEach(d => {
      const l = d.data();
      if (l.origem === 'adiantamento') temAdiant = d.ref;
      if (l.origem === 'salario') temSalario = d.ref;
    });

    const batch = fb.writeBatch(global.db);
    const mesOrigem = MESES[folha.mes];
    if (folha.adiantamento > 0) {
      const payload = {
        mes, ano, dia: 20, competencia: 'dia20',
        categoria: 'salario', valor: folha.adiantamento, tipo: 'entrada',
        descricao: `Adiantamento ${mesOrigem}/${folha.ano}`, origem: 'adiantamento',
        createdAt: fb.serverTimestamp(),
      };
      if (temAdiant) batch.update(temAdiant, payload);
      else batch.set(lancamentosRef(F.rgf).doc(), payload);
    }
    if (folha.salarioDia5 > 0) {
      const payload = {
        mes, ano, dia: 5, competencia: 'dia5',
        categoria: 'salario', valor: folha.salarioDia5, tipo: 'entrada',
        descricao: `Salário ${mesOrigem}/${folha.ano}`, origem: 'salario',
        createdAt: fb.serverTimestamp(),
      };
      if (temSalario) batch.update(temSalario, payload);
      else batch.set(lancamentosRef(F.rgf).doc(), payload);
    }
    await batch.commit();
  }

  async function fixosRecorrentes(mes, ano) {
    try {
      const snap = await fb.getDocs(fb.query(lancamentosRef(F.rgf),
        fb.where('fixo', '==', true)));
      if (snap.empty) return;
      // Verifica se já existem fixos NESTE mês
      const snapMes = await fb.getDocs(fb.query(lancamentosRef(F.rgf),
        fb.where('ano', '==', ano), fb.where('mes', '==', mes), fb.where('fixo', '==', true)));
      const existentes = new Set();
      snapMes.forEach(d => existentes.add(d.data().descricao + '|' + d.data().categoria));

      const batch = fb.writeBatch(global.db);
      let criados = 0;
      snap.forEach(d => {
        const l = d.data();
        const chave = (l.descricao || '') + '|' + l.categoria;
        // Clona fixo de OUTRO mês que ainda não existe neste mês
        if (!(l.mes === mes && l.ano === ano) && !existentes.has(chave)) {
          existentes.add(chave); // marca pra não duplicar
          batch.set(lancamentosRef(F.rgf).doc(), {
            ...l, // copia todos os campos
            mes,  // sobrescreve mes
            ano,  // sobrescreve ano
            createdAt: fb.serverTimestamp(),
          });
          criados++;
        }
      });
      if (criados) await batch.commit();
    } catch (e) { console.warn('Fixos recorrentes:', e); }
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

  // Auto-recorrente + contracheque quando muda o mês
  function mudarMes(delta) {
    let m = F.mesAtual + delta;
    let a = F.anoAtual;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    F.mesAtual = m; F.anoAtual = a;
    renderMesSeletor();
    if (F.autenticado) {
      fixosRecorrentes(m, a);
      iniciarListenerLancamentos();
      contrachequeAuto(true);
    }
  }

  function renderMesSeletor() {
    const el = document.getElementById('fin-mes-label');
    if (el) el.textContent = MESES[F.mesAtual] + ' ' + F.anoAtual;
  }

  function renderPainel() {
    const listaEl = document.getElementById('fin-lista');
    if (!listaEl) return;

    // Separa por competência (dia 5 = salário | dia 20 = adiantamento)
    const grupos = { dia5: [], dia20: [] };
    F.lancamentos.forEach(l => {
      const g = l.competencia === 'dia20' ? 'dia20' : 'dia5';
      grupos[g].push(l);
    });

    const soma = (arr) => arr.reduce((s, l) => s + parseFloat(l.valor), 0);
    const inD5 = soma(grupos.dia5.filter(l => l.tipo === 'entrada'));
    const outD5 = Math.abs(soma(grupos.dia5.filter(l => l.tipo !== 'entrada')));
    const inD20 = soma(grupos.dia20.filter(l => l.tipo === 'entrada'));
    const outD20 = Math.abs(soma(grupos.dia20.filter(l => l.tipo !== 'entrada')));
    const sobraD5 = inD5 - outD5, sobraD20 = inD20 - outD20;
    const total = sobraD5 + sobraD20;

    // Atualiza cards
    const setTxt = (id, v, neg) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = fmtMoney(v);
        if (neg !== undefined) el.className = 'text-sm font-bold ' + (neg ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400');
      }
    };
    setTxt('fin-d20', inD20);
    setTxt('fin-d5', inD5);
    setTxt('fin-sobra-d20', sobraD20, sobraD20 < 0);
    setTxt('fin-sobra-d5', sobraD5, sobraD5 < 0);
    setTxt('fin-sobra', total, total < 0);

    // Lista
    const catLabel = (id) => (CATEGORIAS.find(c => c.id === id) || { label: id }).label;
    if (!F.lancamentos.length) {
      listaEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Nenhum lançamento neste mês. Toque em "+ Adicionar" para começar.</p>';
      return;
    }
    const renderGrupo = (titulo, itens) => {
      if (!itens.length) return '';
      return `<p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mt-3 mb-1">${titulo}</p>` +
        itens.map(l => {
          const v = Math.abs(parseFloat(l.valor));
          const neg = l.tipo !== 'entrada';
          const fixoBadge = l.fixo ? ' <span title="Fixo mensal" class="text-blue-500">📌</span>' : '';
          // Se descricao já tem (N/N), não repete
          const parcBadge = (l.parcela && !(l.descricao || '').includes(l.parcela)) ? ` <span class="text-amber-500">(${l.parcela})</span>` : '';
          return `<div class="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
            <div class="min-w-0">
              <p class="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">${l.descricao || catLabel(l.categoria)}${fixoBadge}${parcBadge}</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">${catLabel(l.categoria)} · ${String(l.dia || '').padStart(2, '0')}/${String(l.mes + 1).padStart(2, '0')}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span class="font-bold text-sm ${neg ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}">${neg ? '−' : '+'} ${fmtMoney(v)}</span>
              <button type="button" data-edit="${l.id}" class="fin-edit text-blue-500 hover:text-blue-700 text-lg font-bold px-1" title="Editar">✏️</button>
              <button type="button" data-del="${l.id}" data-grupo="${l.grupoParcela || ''}" data-fixo="${l.fixo ? '1' : ''}" class="fin-del text-red-500 hover:text-red-700 text-lg font-bold px-1" title="Excluir">🗑️</button>
            </div>
          </div>`;
        }).join('');
    };
    listaEl.innerHTML =
      renderGrupo('💵 Dia 20 — Adiantamento', grupos.dia20) +
      renderGrupo('💰 Dia 5 — Salário', grupos.dia5);
  }

  async function handleAddLancamento(e) {
    e.preventDefault();
    if (!F.autenticado) return;
    const editId = document.getElementById('fin-add-id').value;
    const cat = document.getElementById('fin-add-categoria').value;
    const valorRaw = (document.getElementById('fin-add-valor').value || '').replace(',', '.');
    const valor = Math.abs(parseFloat(valorRaw));
    const descricao = (document.getElementById('fin-add-descricao').value || '').trim();
    const dia = parseInt(document.getElementById('fin-add-dia').value, 10) || new Date().getDate();
    const tipo = document.querySelector('input[name="fin-add-tipo"]:checked')?.value || 'saida';
    const competencia = document.querySelector('input[name="fin-add-comp"]:checked')?.value || 'dia5';
    const fixo = document.getElementById('fin-add-fixo').checked;
    const parcelas = parseInt(document.getElementById('fin-add-parcelas').value, 10) || 1;
    const tipoValor = document.querySelector('input[name="fin-add-tipo-valor"]:checked')?.value || 'parcela';

    if (!valor || isNaN(valor) || valor <= 0) {
      global.showToast('Digite um valor válido.', 'error');
      return;
    }

    const batch = fb.writeBatch(global.db);
    const basePayload = {
      categoria: cat, tipo, dia, competencia,
    };

    if (editId) {
      // EDIÇÃO: atualiza só este lançamento
      const docRef = lancamentosRef(F.rgf).doc(editId);
      const payload = {
        ...basePayload,
        valor: tipo === 'saida' ? -valor : valor,
        descricao: descricao || null,
      };
      if (fixo) {
        payload.fixo = true;
        delete payload.parcela; delete payload.grupoParcela;
      } else if (parcelas > 1) {
        const valorParcela = tipoValor === 'total' ? Math.round((valor / parcelas) * 100) / 100 : valor;
        payload.valor = tipo === 'saida' ? -valorParcela : valorParcela;
        payload.parcela = `1/${parcelas}`;
        payload.grupoParcela = `parc_${F.anoAtual}_${F.mesAtual}_${(descricao || 'lanc').replace(/\s+/g, '_')}`;
      } else {
        payload.fixo = false;
        delete payload.parcela; delete payload.grupoParcela;
      }
      batch.set(docRef, payload);
    } else if (fixo) {
      batch.set(lancamentosRef(F.rgf).doc(), {
        ...basePayload,
        mes: F.mesAtual, ano: F.anoAtual,
        valor: tipo === 'saida' ? -valor : valor,
        fixo: true,
        descricao: descricao || null,
        createdAt: fb.serverTimestamp(),
      });
    } else if (parcelas > 1) {
      // Por parcela: valor já é de cada parcela. Por total: divide o valor total.
      const valorParcela = tipoValor === 'total' ? Math.round((valor / parcelas) * 100) / 100 : valor;
      const grupoParcela = `parc_${F.anoAtual}_${F.mesAtual}_${(descricao || 'lanc').replace(/\s+/g, '_')}`;
      for (let i = 1; i <= parcelas; i++) {
        let m = F.mesAtual + (i - 1), a = F.anoAtual;
        while (m > 11) { m -= 12; a++; }
        batch.set(lancamentosRef(F.rgf).doc(), {
          ...basePayload,
          mes: m, ano: a,
          valor: tipo === 'saida' ? -valorParcela : valorParcela,
          parcela: `${i}/${parcelas}`,
          descricao: descricao || `Parcela ${i}/${parcelas}`,
          grupoParcela,
          createdAt: fb.serverTimestamp(),
        });
      }
    } else {
      batch.set(lancamentosRef(F.rgf).doc(), {
        ...basePayload,
        mes: F.mesAtual, ano: F.anoAtual,
        valor: tipo === 'saida' ? -valor : valor,
        descricao: descricao || null,
        createdAt: fb.serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      global.showToast(editId ? 'Lançamento atualizado!' : fixo ? 'Fixo salvo! Será repetido todo mês.' : parcelas > 1 ? `${parcelas} parcelas criadas!` : 'Lançamento salvo!', 'success');
      document.getElementById('fin-add-valor').value = '';
      document.getElementById('fin-add-descricao').value = '';
      document.getElementById('fin-add-parcelas').value = '1';
      document.getElementById('fin-add-parcels-wrap').classList.remove('hidden');
      document.getElementById('fin-add-parc-valor').textContent = '';
      document.getElementById('fin-add-fixo').checked = false;
      document.getElementById('fin-add-modal').classList.add('hidden');
    } catch (err) {
      global.showToast('Erro ao salvar: ' + err.message, 'error');
    }
  }

  // Auto-recorrente: ao abrir um mês novo, clona os fixos
  async function handleDeleteLancamento(id, grupoParcela, fixo) {
    // Sempre usa o modal próprio (não depende de showCustomConfirm)
    const modal = document.getElementById('fin-excluir-modal');
    const msgEl = document.getElementById('fin-excluir-msg');
    const btnTodos = document.getElementById('fin-excluir-todos');
    if (grupoParcela || fixo === '1') {
      msgEl.textContent = fixo === '1'
        ? 'Este lançamento é FIXO. Apagar somente este mês ou TODOS os meses?'
        : 'Este lançamento faz parte de um parcelamento. Apagar somente este mês ou TODOS os meses?';
      btnTodos.classList.remove('hidden');
    } else {
      msgEl.textContent = 'Excluir este lançamento?';
      btnTodos.classList.add('hidden');
    }
    modal.classList.remove('hidden');
    F._delContext = { id, grupoParcela, fixo: fixo === '1' };
  }

  async function handleExcluirUm() {
    document.getElementById('fin-excluir-modal').classList.add('hidden');
    if (!F._delContext) return;
    const { id } = F._delContext;
    F._delContext = null;
    try {
      await fb.deleteDoc(lancamentosRef(F.rgf).doc(id));
      global.showToast('Lançamento excluído com sucesso!', 'success');
      // Força atualização da lista
      escutarMes();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      global.showToast('Erro: ' + err.message, 'error');
    }
  }

  async function handleExcluirTodos() {
    document.getElementById('fin-excluir-modal').classList.add('hidden');
    if (!F._delContext) return;
    const ctx = F._delContext;
    F._delContext = null;
    try {
      const alvo = F.lancamentos.find(x => x.id === ctx.id);
      const snap = await fb.getDocs(fb.query(lancamentosRef(F.rgf)));
      const batch = fb.writeBatch(global.db);
      let count = 0;
      snap.forEach(d => {
        const l = d.data();
        const mesmaParcela = ctx.grupoParcela && l.grupoParcela === ctx.grupoParcela;
        const mesmoFixo = ctx.fixo && l.fixo === true && alvo &&
          (l.descricao || '') === (alvo.descricao || '') &&
          l.categoria === alvo.categoria;
        if (mesmaParcela || mesmoFixo) {
          batch.delete(d.ref);
          count++;
        }
      });
      if (count > 0) await batch.commit();
      global.showToast(count > 0 ? `${count} lançamento(s) excluído(s) com sucesso!` : 'Nada para excluir.', 'success');
      escutarMes();
    } catch (err) {
      console.error('Erro ao excluir todos:', err);
      global.showToast('Erro: ' + err.message, 'error');
    }
  }

  // Remove duplicatas do mês atual (mesma descrição+categoria+valor+parcela no mesmo mês)
  async function limparDuplicados() {
    try {
      const snap = await fb.getDocs(fb.query(lancamentosRef(F.rgf),
        fb.where('ano', '==', F.anoAtual), fb.where('mes', '==', F.mesAtual)));
      if (snap.empty) { global.showToast('Nenhum lançamento neste mês.', 'success'); return; }
      const vistos = new Set();
      const batch = fb.writeBatch(global.db);
      let removidos = 0;
      snap.forEach(d => {
        const l = d.data();
        const chave = [l.tipo, l.categoria, l.descricao || '', String(l.valor), l.dia || '', l.parcela || '', l.fixo ? 'F' : '', l.origem || ''].join('|');
        if (vistos.has(chave)) {
          batch.delete(d.ref);
          removidos++;
        } else {
          vistos.add(chave);
        }
      });
      if (removidos > 0) {
        await batch.commit();
        global.showToast(`🧹 ${removidos} duplicado(s) removido(s)!`, 'success');
      } else {
        global.showToast('Nenhum duplicado neste mês.', 'success');
      }
    } catch (err) {
      global.showToast('Erro ao limpar: ' + err.message, 'error');
    }
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

  // ===== Editar lançamento =====
  function handleEditLancamento(id) {
    const l = F.lancamentos.find(x => x.id === id);
    if (!l) return;
    document.getElementById('fin-add-titulo').textContent = '✏️ Editar Lançamento';
    document.getElementById('fin-add-id').value = l.id;
    document.getElementById('fin-add-valor').value = String(Math.abs(parseFloat(l.valor))).replace('.', ',');
    document.getElementById('fin-add-descricao').value = l.descricao || '';
    document.getElementById('fin-add-dia').value = l.dia || new Date().getDate();
    document.getElementById('fin-add-categoria').value = l.categoria || 'outros';
    // Tipo
    document.querySelector(`input[name="fin-add-tipo"][value="${l.tipo || 'saida'}"]`).checked = true;
    // Competência
    document.querySelector(`input[name="fin-add-comp"][value="${l.competencia || 'dia5'}"]`).checked = true;
    // Fixo / Parcela
    const isFixo = l.fixo === true;
    document.getElementById('fin-add-fixo').checked = isFixo;
    document.getElementById('fin-add-parcels-wrap').classList.toggle('hidden', isFixo);
    if (isFixo) {
      document.getElementById('fin-add-parcelas').value = '1';
      document.getElementById('fin-add-parc-valor').textContent = '';
    } else if (l.parcela) {
      const partes = l.parcela.split('/');
      document.getElementById('fin-add-parcelas').value = partes[1] || '1';
      document.querySelector('input[name="fin-add-tipo-valor"][value="parcela"]').checked = true;
    } else {
      document.getElementById('fin-add-parcelas').value = '1';
      document.getElementById('fin-add-parc-valor').textContent = '';
      document.querySelector('input[name="fin-add-tipo-valor"][value="parcela"]').checked = true;
    }
    document.getElementById('fin-add-modal').classList.remove('hidden');
  }

  // ===== Exportar PDF =====
  function exportarPDF() {
    if (!F.lancamentos.length && !confirm('Sem lançamentos neste mês. Exportar mesmo assim?')) return;
    const doc = new jspdf.jsPDF();
    const titulo = `Finanças — RGF ${F.rgf} — ${MESES[F.mesAtual]}/${F.anoAtual}`;
    doc.setFontSize(16);
    doc.text(titulo, 14, 18);

    const grupos = { dia5: [], dia20: [] };
    F.lancamentos.forEach(l => {
      const g = l.competencia === 'dia20' ? 'dia20' : 'dia5';
      grupos[g].push(l);
    });
    const soma = (arr) => arr.reduce((s, l) => s + parseFloat(l.valor), 0);
    const inD5 = soma(grupos.dia5.filter(l => l.tipo === 'entrada'));
    const outD5 = Math.abs(soma(grupos.dia5.filter(l => l.tipo !== 'entrada')));
    const inD20 = soma(grupos.dia20.filter(l => l.tipo === 'entrada'));
    const outD20 = Math.abs(soma(grupos.dia20.filter(l => l.tipo !== 'entrada')));

    doc.setFontSize(11);
    doc.text(`Dia 20 (Adiantamento):  ${fmtMoney(inD20)}`, 14, 28);
    doc.text(`Dia 5  (Salario):       ${fmtMoney(inD5)}`, 14, 35);
    doc.text(`Sobra Dia 20:           ${fmtMoney(inD20 - outD20)}`, 14, 44);
    doc.text(`Sobra Dia 5:            ${fmtMoney(inD5 - outD5)}`, 14, 51);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL:                  ${fmtMoney(inD5 + inD20 - outD5 - outD20)}`, 14, 60);
    doc.setFont(undefined, 'normal');

    const catLabel = (id) => (CATEGORIAS.find(c => c.id === id) || { label: id }).label.replace(/^[^ ]+ /, '');
    const rows = F.lancamentos.map(l => [
      `${String(l.dia || '').padStart(2, '0')}/${String(l.mes + 1).padStart(2, '0')}/${l.ano}`,
      (l.descricao || catLabel(l.categoria)) + (l.parcela ? ` (${l.parcela})` : ''),
      catLabel(l.categoria),
      l.competencia === 'dia20' ? 'Dia 20' : 'Dia 5',
      (l.tipo === 'entrada' ? '+' : '−') + ' ' + fmtMoney(Math.abs(parseFloat(l.valor))),
    ]);

    doc.autoTable({
      head: [['Data', 'Descrição', 'Categoria', 'Competência', 'Valor']],
      body: rows,
      startY: 68,
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
      document.getElementById('fin-add-titulo').textContent = '📝 Novo Lançamento';
      document.getElementById('fin-add-id').value = '';
      document.getElementById('fin-add-form').reset();
      document.getElementById('fin-add-parcelas').value = '1';
      document.getElementById('fin-add-parc-valor').textContent = '';
      document.getElementById('fin-add-parcels-wrap').classList.remove('hidden');
      document.getElementById('fin-add-fixo').checked = false;
    });
    document.querySelectorAll('#fin-add-modal .cancel-modal-btn').forEach(b =>
      b.addEventListener('click', () => document.getElementById('fin-add-modal').classList.add('hidden')));
    document.getElementById('fin-add-form').addEventListener('submit', handleAddLancamento);
    document.getElementById('fin-lista').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.fin-edit');
      if (editBtn) { handleEditLancamento(editBtn.dataset.edit); return; }
      const delBtn = e.target.closest('.fin-del');
      if (delBtn) handleDeleteLancamento(delBtn.dataset.del, delBtn.dataset.grupo, delBtn.dataset.fixo);
    });
    document.getElementById('fin-trocar-senha').addEventListener('click', () => {
      document.getElementById('fin-troca-modal').classList.remove('hidden');
    });
    document.querySelectorAll('#fin-troca-modal .cancel-modal-btn').forEach(b =>
      b.addEventListener('click', () => document.getElementById('fin-troca-modal').classList.add('hidden')));
    document.getElementById('fin-troca-form').addEventListener('submit', handleTrocarSenha);
    document.getElementById('fin-exportar').addEventListener('click', exportarPDF);
    document.getElementById('fin-limpar-dup').addEventListener('click', limparDuplicados);

    // Excluir modal
    const finExcluirModal = document.getElementById('fin-excluir-modal');
    if (finExcluirModal) {
      document.getElementById('fin-excluir-um').addEventListener('click', handleExcluirUm);
      document.getElementById('fin-excluir-todos').addEventListener('click', handleExcluirTodos);
      document.getElementById('fin-excluir-cancelar').addEventListener('click', () => {
        finExcluirModal.classList.add('hidden');
        F._delContext = null;
      });
    }

    // Calculadora modal — tipo
    function abrirCalcTipo() {
      document.getElementById('fin-calc-tipo-modal').classList.remove('hidden');
      document.getElementById('fin-calc-campos').classList.add('hidden');
      document.getElementById('fin-calc-resultado').classList.add('hidden');
    }

    function abrirCalcForm(tipo) {
      document.getElementById('fin-calc-tipo-modal').classList.add('hidden');
      document.getElementById('fin-calc-campos').classList.remove('hidden');
      document.getElementById('fin-calc-resultado').classList.add('hidden');
      document.getElementById('fin-calc-dias-wrap').classList.toggle('hidden', tipo !== 'falta');
      document.getElementById('fin-calc-titulo').textContent =
        tipo === 'desconto' ? '📉 Simular Desconto' :
        tipo === 'aumento' ? '📈 Simular Aumento' :
        tipo === 'falta' ? '🚫 Simular Falta' :
        '💰 Projeção 13º / Férias';

      // Preenche com dados do contracheque
      let salario = 0;
      if (F.contracheque) salario = F.contracheque.liquido;
      document.getElementById('fin-calc-salario').value = salario.toFixed(2);
      F._calcTipo = tipo;
    }

    function calcular() {
      const tipo = F._calcTipo;
      const salario = parseFloat((document.getElementById('fin-calc-salario').value || '0').replace(',', '.'));
      const perc = parseFloat((document.getElementById('fin-calc-perc').value || '0').replace(',', '.'));
      const dias = parseInt(document.getElementById('fin-calc-dias').value, 10) || 0;
      const resEl = document.getElementById('fin-calc-resultado');

      let html = '';
      if (tipo === 'desconto' && salario && perc) {
        const novoSalario = salario - (salario * perc / 100);
        html = `<p class="text-sm text-gray-500 dark:text-gray-400">Salário atual:</p>
          <p class="text-lg font-bold text-gray-800 dark:text-gray-100">${fmtMoney(salario)}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Desconto de ${perc}%:</p>
          <p class="text-lg font-bold text-red-600 dark:text-red-400">− ${fmtMoney(salario * perc / 100)}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Salário com desconto:</p>
          <p class="text-xl font-bold text-green-700 dark:text-green-400">${fmtMoney(novoSalario)}</p>`;
      } else if (tipo === 'aumento' && salario && perc) {
        const novoSalario = salario + (salario * perc / 100);
        html = `<p class="text-sm text-gray-500 dark:text-gray-400">Salário atual:</p>
          <p class="text-lg font-bold text-gray-800 dark:text-gray-100">${fmtMoney(salario)}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Aumento de ${perc}%:</p>
          <p class="text-lg font-bold text-green-600 dark:text-green-400">+ ${fmtMoney(salario * perc / 100)}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Salário com aumento:</p>
          <p class="text-xl font-bold text-green-700 dark:text-green-400">${fmtMoney(novoSalario)}</p>`;
      } else if (tipo === 'falta' && salario && dias) {
        const valorDia = salario / 30;
        const desconto = valorDia * dias;
        const novoSalario = salario - desconto;
        html = `<p class="text-sm text-gray-500 dark:text-gray-400">Salário atual:</p>
          <p class="text-lg font-bold text-gray-800 dark:text-gray-100">${fmtMoney(salario)}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Faltas (${dias} dia${dias !== 1 ? 's' : ''}):</p>
          <p class="text-lg font-bold text-red-600 dark:text-red-400">− ${fmtMoney(desconto)}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Salário com falta:</p>
          <p class="text-xl font-bold text-green-700 dark:text-green-400">${fmtMoney(novoSalario)}</p>`;
      } else if (tipo === '13ferias' && salario) {
        const decimo = salario; // simplificado
        const ferias = salario + (salario / 3);
        html = `<p class="text-sm text-gray-500 dark:text-gray-400">Com base no salário de ${fmtMoney(salario)}:</p>
          <div class="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p class="text-sm font-bold text-green-800 dark:text-green-400">🎄 Décimo Terceiro:</p>
            <p class="text-xl font-bold text-green-700 dark:text-green-500">${fmtMoney(decimo)}</p>
          </div>
          <div class="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p class="text-sm font-bold text-blue-800 dark:text-blue-400">🏖️ Férias (salário + 1/3):</p>
            <p class="text-xl font-bold text-blue-700 dark:text-blue-500">${fmtMoney(ferias)}</p>
          </div>`;
      } else {
        html = '<p class="text-red-500 text-sm">Preencha os campos.</p>';
      }

      resEl.innerHTML = html;
      resEl.classList.remove('hidden');
    }

    // Botão de calculadora no painel
    const finCalcBtn = document.getElementById('fin-calculadora-btn');
    if (finCalcBtn) finCalcBtn.addEventListener('click', abrirCalcTipo);
    document.getElementById('fin-calc-voltar').addEventListener('click', () => {
      document.getElementById('fin-calc-campos').classList.add('hidden');
      document.getElementById('fin-calc-resultado').classList.add('hidden');
      document.getElementById('fin-calc-tipo-modal').classList.remove('hidden');
    });
    document.getElementById('fin-calc-fechar-campos').addEventListener('click', () => {
      document.getElementById('fin-calc-modal').classList.add('hidden');
      document.getElementById('fin-calc-resultado').innerHTML = '';
      document.getElementById('fin-calc-perc').value = '';
      document.getElementById('fin-calc-dias').value = '';
    });
    document.getElementById('fin-calc-calcular').addEventListener('click', calcular);
    document.querySelectorAll('[data-calc-tipo]').forEach(btn => {
      btn.addEventListener('click', () => abrirCalcForm(btn.dataset.calcTipo));
    });
    // Fechar modal clicando fora
    document.getElementById('fin-calc-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('fin-calc-modal')) {
        document.getElementById('fin-calc-modal').classList.add('hidden');
      }
    });

    // Data padrão do lançamento = hoje
    const hoje = new Date().getDate();
    const diaEl = document.getElementById('fin-add-dia');
    if (diaEl) diaEl.value = hoje;

    // Segurança: o checkbox "📌 Fixo" precisa existir antes de bindar
    const fixoCb = document.getElementById('fin-add-fixo');
    if (fixoCb) {
      const parcInput = document.getElementById('fin-add-parcelas');
      const parcWrap = document.getElementById('fin-add-parcels-wrap');
      const parcValor = document.getElementById('fin-add-parc-valor');
      const atualizarParc = () => {
        const v = Math.abs(parseFloat((document.getElementById('fin-add-valor').value || '0').replace(',', '.')));
        const p = parseInt(parcInput.value, 10) || 1;
        parcValor.textContent = p > 1 ? ` = ${p}x de ${fmtMoney(v / p)}` : '';
      };
      fixoCb.addEventListener('change', (e) => {
        parcWrap.classList.toggle('hidden', e.target.checked);
        if (e.target.checked) { parcInput.value = 1; parcValor.textContent = ''; }
      });
      parcInput.addEventListener('input', atualizarParc);
      document.getElementById('fin-add-valor').addEventListener('input', atualizarParc);
    }

    mostrarTela('login');
  }

  global.initFinancas = bindFinancas;
})(window);
