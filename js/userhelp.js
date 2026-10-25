// Cardapio Quatinga v3.2 - userhelp.js
// Abas do funcionario: Feriados, Pagamento (com consulta RGF), Ponto.
// Dados embutidos do calendario administrativo e escala de pagamento de Mogi das Cruzes (2026).

(function (global) {
  // ===== Feriados e pontos facultativos 2026 (prefeitura de Mogi das Cruzes) =====
  // 'data' usa o ano implicito 2026; o ultimo item e 01/01/2027.
  const HOLIDAYS_2026 = [
    { data: '01/01', evento: 'Dia da Confraternização Universal e da Paz', dia: 'Quinta' },
    { data: '02/01', evento: 'Facultativo', dia: 'Sexta' },
    { data: '16/02', evento: 'Facultativo', dia: 'Segunda' },
    { data: '17/02', evento: 'Carnaval', dia: 'Terça' },
    { data: '18/02', evento: 'Cinzas (Ponto Facultativo até 13h)', dia: 'Quarta' },
    { data: '03/04', evento: 'Paixão de Cristo', dia: 'Sexta' },
    { data: '20/04', evento: 'Facultativo', dia: 'Segunda' },
    { data: '21/04', evento: 'Tiradentes', dia: 'Terça' },
    { data: '01/05', evento: 'Dia do Trabalho', dia: 'Sexta' },
    { data: '04/06', evento: 'Corpus Christi', dia: 'Quinta' },
    { data: '05/06', evento: 'Facultativo', dia: 'Sexta' },
    { data: '09/07', evento: 'Data Magna do Estado de São Paulo', dia: 'Quinta' },
    { data: '10/07', evento: 'Facultativo', dia: 'Sexta' },
    { data: '26/07', evento: 'N. S. de Sant\'Ana - Padroeira da Cidade', dia: 'Domingo' },
    { data: '31/08', evento: 'Facultativo', dia: 'Segunda' },
    { data: '01/09', evento: 'Aniversário da Cidade', dia: 'Terça' },
    { data: '07/09', evento: 'Independência', dia: 'Segunda' },
    { data: '12/10', evento: 'Nossa Senhora Aparecida', dia: 'Segunda' },
    { data: '30/10', evento: 'Dia do Servidor Público', dia: 'Sexta' },
    { data: '02/11', evento: 'Finados', dia: 'Segunda' },
    { data: '15/11', evento: 'Proclamação da República', dia: 'Domingo' },
    { data: '20/11', evento: 'Consciência Negra', dia: 'Sexta' },
    { data: '24/12', evento: 'Véspera de Natal', dia: 'Quinta' },
    { data: '25/12', evento: 'Natal', dia: 'Sexta' },
    { data: '31/12', evento: 'Véspera de Ano Novo', dia: 'Quinta' },
    { data: '01/01/2027', evento: 'Dia da Confraternização Universal e da Paz', dia: 'Sexta' }
  ];

  // ===== Escala de pagamento 2026 (dia do pagamento e do adiantamento) =====
  const PAYMENT_2026 = [
    { mes: 'Janeiro', pag: 7, adi: 20 },
    { mes: 'Fevereiro', pag: 6, adi: 20 },
    { mes: 'Março', pag: 6, adi: 20 },
    { mes: 'Abril', pag: 7, adi: 17 },
    { mes: 'Maio', pag: 7, adi: 20 },
    { mes: 'Junho', pag: 3, adi: 19 },
    { mes: 'Julho', pag: 6, adi: 20 },
    { mes: 'Agosto', pag: 6, adi: 20 },
    { mes: 'Setembro', pag: 4, adi: 18 },
    { mes: 'Outubro', pag: 6, adi: 20 },
    { mes: 'Novembro', pag: 6, adi: 19, decimo: 13 }, // 1ª parcela 13º (oficial: 13/11)
    { mes: 'Dezembro', pag: 4, adi: 18, decimo: 11 }  // 2ª parcela 13º (oficial: 11/12)
  ];

  const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const PREFEITURA_API = "https://dadosadm.mogidascruzes.sp.gov.br/api";

  // ===== Render: Feriados =====
  function renderUserHolidays() {
    const listEl = document.getElementById('user-holidays-list');
    if (!listEl) return;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const anoAtual = hoje.getFullYear();
    
    // Prepara mapa de feriados por data para lookup rápido
    const feriadosMap = {};
    HOLIDAYS_2026.forEach(f => {
      const parts = f.data.split('/');
      const ano = parseInt(parts[2] || anoAtual, 10);
      const mes = parseInt(parts[1], 10) - 1;
      const dia = parseInt(parts[0], 10);
      const key = `${ano}-${mes}-${dia}`;
      if (!feriadosMap[key]) feriadosMap[key] = [];
      feriadosMap[key].push(f);
    });

    // Estado do calendário (mês atual sendo visualizado)
    let currentMonth = hoje.getMonth();
    let currentYear = hoje.getFullYear();

    function getMonthName(mes) {
      return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][mes];
    }

    function getDayNames() {
      return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    }

    function renderCalendar(mes, ano) {
      const primeiroDia = new Date(ano, mes, 1);
      const ultimoDia = new Date(ano, mes + 1, 0);
      const diasNoMes = ultimoDia.getDate();
      const diaSemanaInicio = primeiroDia.getDay(); // 0 = Dom
      const diaAtual = hoje.getDate();
      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();

      let html = `
        <div class="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-4 mb-4 border border-gray-100 dark:border-zinc-800">
          <!-- Header do calendário com navegação -->
          <div class="flex items-center justify-between mb-4">
            <button id="cal-prev" class="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Mês anterior">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-100 text-center flex-1">${getMonthName(mes)} de ${ano}</h3>
            <button id="cal-next" class="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Próximo mês">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
          
          <!-- Dias da semana -->
          <div class="grid grid-cols-7 gap-1 mb-1">
            ${getDayNames().map(d => `<div class="text-center text-xs font-bold text-gray-500 dark:text-gray-400 py-1">${d}</div>`).join('')}
          </div>
          
          <!-- Grid dos dias -->
          <div class="grid grid-cols-7 gap-1" id="calendar-grid">`;

      // Dias vazios antes do primeiro dia do mês
      for (let i = 0; i < diaSemanaInicio; i++) {
        html += '<div class="aspect-square"></div>';
      }

      // Dias do mês
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const key = `${ano}-${mes}-${dia}`;
        const feriados = feriadosMap[key] || [];
        const isHoje = (dia === diaAtual && mes === mesAtual && ano === anoAtual);
        const isFeriado = feriados.length > 0;
        const isFacultativo = feriados.some(f => /facultativo/i.test(f.evento));
        
        let classes = 'aspect-square flex flex-col items-center justify-center text-sm rounded-lg transition-all';
        if (isHoje) {
          classes += ' bg-blue-500 text-white font-bold shadow-lg ring-2 ring-blue-400';
        } else if (isFeriado) {
          classes += isFacultativo 
            ? ' bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-bold border-2 border-amber-300 dark:border-amber-700'
            : ' bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 font-bold border-2 border-red-300 dark:border-red-700';
        } else {
          classes += ' text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-800';
        }

        let tooltip = '';
        if (isFeriado) {
          tooltip = `title="${feriados.map(f => f.evento).join(', ')}"`;
        }

        html += `<div class="${classes}" ${tooltip} data-dia="${dia}">${dia}</div>`;
      }

      html += '</div></div>';
      return html;
    }

    function renderList() {
      let proximoIdx = -1;
      let html = '';
      HOLIDAYS_2026.forEach((f, i) => {
        const parts = f.data.split('/');
        const d = new Date(parseInt(parts[2] || anoAtual, 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        const passou = d < hoje;
        if (!passou && proximoIdx === -1) proximoIdx = i;
        const destaque = i === proximoIdx ? ' ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : (passou ? ' opacity-50 past-holiday' : '');
        const badge = i === proximoIdx ? '<span class="ml-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">PRÓXIMO</span>' : '';
        const facilito = /facultativo/i.test(f.evento) || /Facultativo/.test(f.evento);
        html += `<div class="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-100 dark:border-zinc-800${destaque}">
          <div class="min-w-0"><p class="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">${f.evento}${badge}</p></div>
          <div class="text-right whitespace-nowrap"><p class="text-sm font-bold ${facilito ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}">${f.data}</p><p class="text-[10px] text-gray-400">${f.dia}</p></div>
        </div>`;
      });
      if (proximoIdx >= 0) {
        const f = HOLIDAYS_2026[proximoIdx];
        const parts = f.data.split('/');
        const d = new Date(parseInt(parts[2] || anoAtual, 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        const dias = Math.ceil((d - hoje) / 86400000);
        html = `<div class="feature-card">
          <span class="feature-kicker">Próximo feriado ou ponto facultativo</span>
          <span class="feature-title">${f.evento}</span>
          <span class="feature-text">${f.dia}, ${f.data}</span>
          <span class="feature-chip">${dias === 0 ? 'É hoje!' : dias === 1 ? 'É amanhã!' : `Faltam ${dias} dias`}</span>
        </div>` + html;
      }
      return html;
    }

    // Render inicial
    listEl.innerHTML = `
      <div id="calendar-container">${renderCalendar(currentMonth, currentYear)}</div>
      <div class="border-t border-gray-200 dark:border-zinc-800 pt-4">
        <h3 class="font-bold text-gray-800 dark:text-gray-100 mb-3 text-sm">Lista de feriados</h3>
        <div id="holidays-list" class="space-y-1.5 hide-past">${renderList()}</div>
        <button type="button" id="toggle-past-holidays" class="btn-ghost w-full mt-3" onclick="const l=document.getElementById('holidays-list');l.classList.toggle('hide-past');this.textContent=l.classList.contains('hide-past')?'Mostrar feriados que já passaram':'Esconder feriados que já passaram'">Mostrar feriados que já passaram</button>
      </div>
      <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-3 text-right">fonte: prefeitura de Mogi das Cruzes</p>
    `;

    // Event delegation no container que NÃO é recriado
    listEl.addEventListener('click', (e) => {
      const prevBtn = e.target.closest('#cal-prev');
      const nextBtn = e.target.closest('#cal-next');
      if (prevBtn) {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        document.getElementById('calendar-container').innerHTML = renderCalendar(currentMonth, currentYear);
      } else if (nextBtn) {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        document.getElementById('calendar-container').innerHTML = renderCalendar(currentMonth, currentYear);
      }
    });
  }

  // ===== Render: Pagamento =====
  function renderUserPayment() {
    const tableEl = document.getElementById('user-payment-table');
    const nextEl = document.getElementById('user-next-payment');
    if (!tableEl) return;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    // Um cartão por mês: próximos primeiro; os que já passaram ficam atrás de um botão.
    // Cada data tem nome (Pagamento, Adiantamento, 13º) para não misturar.
    const fmt = (d) => String(d).padStart(2, '0');
    const row = (label, dia, mesIdx, cls) => {
      const data = new Date(2026, mesIdx, dia);
      const passou = data < hoje;
      return `<div class="pay-item ${cls}${passou ? ' done' : ''}"><span>${label}</span><strong>${fmt(dia)}/${fmt(mesIdx + 1)}</strong></div>`;
    };
    const cards = PAYMENT_2026.map((p, i) => {
      const ultimo = Math.max(p.pag, p.adi, p.decimo || 0);
      const passou = new Date(2026, i, ultimo) < hoje;
      const atual = hoje.getMonth() === i && hoje.getFullYear() === 2026;
      const itens = [row('Pagamento', p.pag, i, 'pay'), row('Adiantamento', p.adi, i, 'adv')];
      if (p.decimo) itens.push(row(i === 10 ? '13º salário · 1ª parcela' : '13º salário · 2ª parcela', p.decimo, i, 'bonus'));
      return `<div class="pay-month${passou ? ' past-month' : ''}${atual ? ' current' : ''}"><div class="pay-month-name">${p.mes}${atual ? ' <span>este mês</span>' : ''}</div><div class="pay-items">${itens.join('')}</div></div>`;
    });
    let html = `<div id="pay-months" class="pay-months hide-past">${cards.join('')}</div>
      <button type="button" class="btn-ghost w-full mt-3" onclick="const l=document.getElementById('pay-months');l.classList.toggle('hide-past');this.textContent=l.classList.contains('hide-past')?'Mostrar meses que já passaram':'Esconder meses que já passaram'">Mostrar meses que já passaram</button>`;
    tableEl.innerHTML = html;
    // Cartao do proximo evento (pagamento, adiantamento ou 13º)
    const allEvents = [];
    PAYMENT_2026.forEach((p, i) => {
      allEvents.push({ tipo: 'pagamento', label: 'Pagamento', data: new Date(2026, i, p.pag), cor: 'green' });
      allEvents.push({ tipo: 'adiantamento', label: 'Adiantamento', data: new Date(2026, i, p.adi), cor: 'blue' });
      if (p.decimo) {
        const isPrimeira = i === 10;
        allEvents.push({ 
          tipo: 'decimo', 
          label: isPrimeira ? '1ª parcela 13º' : '2ª parcela 13º', 
          data: new Date(2026, i, p.decimo), 
          cor: 'amber' 
        });
      }
    });
    const futuros = allEvents.filter(e => e.data >= hoje).sort((a, b) => a.data - b.data);
    const proximoEvento = futuros[0];
    
    if (nextEl && proximoEvento) {
      const dias = Math.ceil((proximoEvento.data - hoje) / 86400000);
      const corClasses = {
        green: 'text-green-600 dark:text-green-400',
        blue: 'text-blue-600 dark:text-blue-400',
        amber: 'text-amber-600 dark:text-amber-400'
      };
      const bgClasses = {
        green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50',
        blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50',
        amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50'
      };
      const c = corClasses[proximoEvento.cor] || corClasses.green;
      const bg = bgClasses[proximoEvento.cor] || bgClasses.green;
      nextEl.innerHTML = `<span class="feature-kicker">Próximo ${proximoEvento.label.toLowerCase()}</span>
        <span class="feature-title">Dia ${String(proximoEvento.data.getDate()).padStart(2, '0')}/${MES_ABREV[proximoEvento.data.getMonth()]}</span>
        <span class="feature-chip">${dias === 0 ? 'É hoje!' : dias === 1 ? 'É amanhã!' : `Faltam ${dias} dias`}</span>`;
      nextEl.className = 'feature-card';
    }
  }

  // ===== Abas do funcionario =====
  function bindUserTabs() {
    const nav = document.getElementById('user-tabs');
    if (!nav) return;

    const showUserPanel = (name) => {
      // Esconde o conteudo principal do cardapio quando sai da aba menu
      const menuContent = document.getElementById('form-container');
      const menuSections = document.querySelectorAll('#user-view > [data-user-panel], #user-view > section[data-user-panel]');
      document.querySelectorAll('#user-view section[data-user-panel]').forEach(sec => {
        sec.classList.toggle('hidden', sec.dataset.userPanel !== name);
      });
      // aba menu = mostra o fluxo normal (form-container), outras = escondem
      if (menuContent) menuContent.classList.toggle('hidden', name !== 'menu');
      // atualiza botoes
      document.querySelectorAll('#user-tabs .admin-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.userTab === name);
      });
      global.__state.userActiveTab = name;
    };

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-tab-btn');
      if (!btn) return;
      showUserPanel(btn.dataset.userTab);
    });

    showUserPanel(global.__state.userActiveTab || 'menu');
  }

  // ===== Consulta RGF (funcionario) =====
  function fmtMoneyUser(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    if (isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function fmtDateUser(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  function userRgfSetStatus(msg, type) {
    const el = document.getElementById('user-rgf-consult-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mb-4 text-sm font-semibold ' + (type === 'error' ? 'text-red-600 dark:text-red-400'
      : type === 'loading' ? 'text-blue-600 dark:text-blue-400'
      : 'text-green-600 dark:text-green-400');
  }

  // ===== Busca 13º salário (folha de 13º) =====
  async function fetchDecimoTerceiro(rgf, ano) {
    try {
      const resp = await fetch(`${PREFEITURA_API}/folha_pagamento?matricula=${rgf}&ano=${ano}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data.results) return null;
      console.log('[13º] Folhas encontradas:', data.results.map(r => ({ tipo: r.tipo_folha, mes: r.mes, ano: r.ano, id: r.idfunselec })));
      
      // Procura folha de 13º (busca mais ampla)
      const decimo = data.results.find(r => 
        r.tipo_folha && (
          r.tipo_folha.includes('13') || 
          r.tipo_folha.toLowerCase().includes('decimo') || 
          r.tipo_folha.toLowerCase().includes('décimo') ||
          r.tipo_folha.toLowerCase().includes('decimo terceiro') ||
          r.tipo_folha.toLowerCase().includes('13º') ||
          r.tipo_folha.toLowerCase().includes('decimo terceiro salario')
        )
      );
      
      // Fallback: se não achou por tipo, tenta achar por mês (dezembro/janeiro costuma ser 13º)
      if (!decimo) {
        const candidatos = data.results.filter(r => r.mes === 12 || r.mes === 1);
        if (candidatos.length > 0) {
          console.log('[13º] Fallback: usando folha de dez/jan como candidato a 13º', candidatos);
          // Pega a mais recente
          candidatos.sort((a, b) => (b.ano * 12 + b.mes) - (a.ano * 12 + a.mes));
          return await fetchDecimoTerceiroDetalhe(candidatos[0]);
        }
        return null;
      }
      
      return await fetchDecimoTerceiroDetalhe(decimo);
    } catch (e) {
      console.error('[13º] Erro:', e);
      return null;
    }
  }

  async function fetchDecimoTerceiroDetalhe(folha) {
    try {
      const respDet = await fetch(`${PREFEITURA_API}/detalhe_folha?idfunselec=${folha.idfunselec}`);
      if (respDet.ok) {
        const det = await respDet.json();
        if (det.results && det.results.length > 0) {
          const liquido = det.results.reduce((acc, v) => acc + (v.tipoVerba === 'Rendimentos' ? parseFloat(v.valorverba) : -parseFloat(v.valorverba)), 0);
          return { competencia: `${MES_ABREV[(folha.mes || 1) - 1]}/${folha.ano}`, liquido, verbas: det.results };
        }
      }
      return { competencia: `${MES_ABREV[(folha.mes || 1) - 1]}/${folha.ano}`, liquido: parseFloat(folha.liquido), verbas: [] };
    } catch (e) {
      console.error('[13º] Erro ao buscar detalhe:', e);
      return null;
    }
  }

  function userRgfRender(latest, verbas, decimo) {
    const resultEl = document.getElementById('user-rgf-consult-result');
    if (!resultEl) return;
    const badge = latest.situacao === 'Ativo'
      ? '<span class="inline-block px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Ativo</span>'
      : `<span class="inline-block px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">${latest.situacao || 'Inativo'}</span>`;
    // Busca o adiantamento nas verbas de desconto
    const adiantamentoVerba = verbas && verbas.find(v => v.desnoverba && v.desnoverba.includes('ADIANTAMENTO'));
    const adiantamentoValor = adiantamentoVerba ? Math.abs(parseFloat(adiantamentoVerba.valorverba)) : 0;
    const salarioRestante = parseFloat(latest.liquido) - adiantamentoValor;
    
    // Monta HTML do 13º se existir
    let decimoHtml = '';
    if (decimo) {
      decimoHtml = `
        <div class="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden mt-3">
          <div class="bg-amber-500 px-4 py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="text-white/80 text-[10px] font-semibold uppercase tracking-wide">13º Salário</p>
                <h3 class="text-lg font-bold text-white leading-tight truncate">${decimo.competencia}</h3>
              </div>
            </div>
          </div>
          <div class="p-4 space-y-2 bg-white dark:bg-zinc-900">
            <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Líquido 13º</span><span class="font-bold text-amber-700 dark:text-amber-400">${fmtMoneyUser(decimo.liquido)}</span></div>
          </div>
        </div>`;
    }
    
    let html = `
      <div class="rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div class="bg-blue-600 dark:bg-blue-500 px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-white/80 text-[10px] font-semibold uppercase tracking-wide">Matrícula ${latest.matricula.split('/')[0]}</p>
              <h3 class="text-lg font-bold text-white leading-tight truncate">${latest.nome}</h3>
            </div>
            ${badge}
          </div>
        </div>
        <div class="p-4 space-y-2 bg-white dark:bg-zinc-900">
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Função</span><span class="font-semibold text-gray-800 dark:text-gray-100 text-right">${latest.cargo || '—'}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Local</span><span class="font-semibold text-gray-800 dark:text-gray-100 text-right">${latest.localtrabalho || '—'}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Secretaria</span><span class="font-semibold text-gray-800 dark:text-gray-100 text-right">${latest.secretaria || '—'}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Tipo Contrato</span><span class="font-semibold text-gray-800 dark:text-gray-100 text-right">${latest.tipocontrato || '—'}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Admissão</span><span class="font-semibold text-gray-800 dark:text-gray-100 text-right">${latest.dataadmissao ? new Date(latest.dataadmissao).toLocaleDateString('pt-BR') : '—'}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Horas Semanais</span><span class="font-semibold text-gray-800 dark:text-gray-100 text-right">${latest.horas_semanais ? latest.horas_semanais.replace('.', ',') + 'h' : '—'}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Salário Base</span><span class="font-semibold text-gray-800 dark:text-gray-100 text-right">${fmtMoneyUser(latest.salariobase)}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Competência</span><span class="font-semibold text-gray-800 dark:text-gray-100">${MES_ABREV[(latest.mes || 1) - 1]}/${latest.ano}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Bruto</span><span class="font-bold text-green-700 dark:text-green-400">${fmtMoneyUser(latest.bruto)}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Líquido total</span><span class="font-bold text-blue-700 dark:text-blue-400">${fmtMoneyUser(latest.liquido)}</span></div>
          <div class="flex justify-between gap-2 text-sm border-t border-gray-100 dark:border-zinc-800 pt-2 mt-1"><span class="text-gray-500 dark:text-gray-400">Dia 20 (adiantamento)</span><span class="font-bold text-green-700 dark:text-green-400">${fmtMoneyUser(adiantamentoValor)}</span></div>
          <div class="flex justify-between gap-2 text-sm"><span class="text-gray-500 dark:text-gray-400">Dia 5 (salário)</span><span class="font-bold text-green-700 dark:text-green-400">${fmtMoneyUser(salarioRestante)}</span></div>
        </div>
      </div>`;
    if (verbas && verbas.length > 0) {
      const rend = verbas.filter(v => v.tipoVerba === 'Rendimentos');
      const desc = verbas.filter(v => v.tipoVerba === 'Descontos');
      const verbaRow = (v) => `<div class="flex justify-between gap-2 py-1 text-sm border-b border-gray-100 dark:border-zinc-800"><span class="text-gray-700 dark:text-gray-300 flex-1">${v.desnoverba}</span><span class="font-bold ${v.tipoVerba === 'Rendimentos' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'} whitespace-nowrap">${v.tipoVerba === 'Rendimentos' ? '+' : '−'} ${fmtMoneyUser(Math.abs(parseFloat(v.valorverba)))}</span></div>`;
      const totalR = rend.reduce((s, v) => s + Math.abs(parseFloat(v.valorverba)), 0);
      const totalD = desc.reduce((s, v) => s + Math.abs(parseFloat(v.valorverba)), 0);
      const liq = totalR - totalD;
      const temAdiantamento = desc.some(v => /ADIANTAMENTO/i.test(v.desnoverba));
      const notaAdiantamento = temAdiantamento
        ? `<p class="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">ℹ️ Inclui desconto de adiantamento salarial (valor pago antecipadamente no mês). O "líquido" acima é o valor final depositado.</p>`
        : '';
      html += `\n        <div class="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 mt-3">\n          <div class="flex flex-wrap justify-between items-center gap-2 mb-3">\n            <h4 class="font-bold text-gray-800 dark:text-gray-100">Contracheque — ${MES_ABREV[(latest.mes || 1) - 1]}/${latest.ano}</h4>\n            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">fonte: portal da transparência</span>\n          </div>\n          <p class="text-xs font-bold text-gray-400 uppercase mb-1">Rendimentos</p>\n          ${rend.map(verbaRow).join('')}\n          <p class="text-xs font-bold text-gray-400 uppercase mt-4 mb-1">Descontos</p>\n          ${desc.map(verbaRow).join('')}\n          <div class="mt-4 pt-3 border-t-2 border-gray-200 dark:border-zinc-700 grid grid-cols-3 gap-2 text-center">\n            <div><p class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Bruto</p><p class="font-bold text-green-700 dark:text-green-400 text-sm">${fmtMoneyUser(totalR)}</p></div>\n            <div><p class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Descontos</p><p class="font-bold text-red-600 dark:text-red-400 text-sm">${fmtMoneyUser(totalD)}</p></div>\n            <div><p class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Líquido</p><p class="font-bold text-blue-700 dark:text-blue-400 text-sm text-base">${fmtMoneyUser(liq)}</p></div>\n          </div>\n          ${notaAdiantamento}\n        </div>`;
    }
    resultEl.innerHTML = html;
  }

  async function handleUserRgfConsult(e) {
    e.preventDefault();
    const input = document.getElementById('user-rgf-consult-input');
    const resultEl = document.getElementById('user-rgf-consult-result');
    const btn = document.getElementById('user-rgf-consult-btn');
    if (!input || !resultEl) return;
    const termo = input.value.trim();
    if (!termo) { userRgfSetStatus('Digite um RGF ou nome para consultar.', 'error'); return; }

    // Tipo de pesquisa: valor salvo pelo popup, ou 'auto' (detecta automaticamente)
    const tipo = window.__rgfFiltroTipo || 'auto';

    // Normaliza RGF digitado com ou sem sufixo "/0": "22823/0" -> "22823"
    const parteInteira = termo.split('/')[0];
    const rgf = parteInteira.replace(/\D/g, '');
    // Só dígitos e barras = busca por RGF (certeza absoluta); senão = busca por nome
    const ehRGF = /^[\d\/]+$/.test(termo) && rgf.length > 0;

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Consultando...';
    resultEl.innerHTML = '';
    userRgfSetStatus(ehRGF ? 'Consultando RGF ' + termo + '...' : 'Buscando por nome "' + termo + '"...', 'loading');

    try {
      if (tipo === 'matricula' || ehRGF) {
        // ===== BUSCA POR MATRÍCULA (certeza absoluta) =====
        await consultarPorRGF(rgf);
      } else if (tipo === 'nome') {
        // ===== BUSCA POR NOME (múltiplos resultados) =====
        await consultarPorNome(termo);
      } else if (tipo === 'cargo') {
        await consultarPorCampo('cargo', termo);
      } else if (tipo === 'secretaria') {
        await consultarPorCampo('secretaria', termo);
      } else if (tipo === 'situacao') {
        await consultarPorCampo('situacao', termo);
      } else {
        // auto: detecta automaticamente
        if (ehRGF) {
          await consultarPorRGF(rgf);
        } else {
          await consultarPorNome(termo);
        }
      }
    } catch (err) {
      userRgfSetStatus('Erro na consulta: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  // ===== Consulta genérica por campo da API (cargo, secretaria, situacao) =====
  async function consultarPorCampo(campo, termo) {
    const resultEl = document.getElementById('user-rgf-consult-result');
    const anoAtual = new Date().getFullYear();
    let todosResultados = [];
    let pagina = 1;
    const maxPaginas = 10; // até 10 páginas (500 registros) para campos com muitos resultados

    while (pagina <= maxPaginas) {
      const resp = await fetch(`${PREFEITURA_API}/folha_pagamento?${campo}=${encodeURIComponent(termo)}&ano=${anoAtual}&page=${pagina}`);
      if (!resp.ok) break;
      const data = await resp.json();
      if (!data.results || data.results.length === 0) break;
      todosResultados = todosResultados.concat(data.results);
      if (!data.next) break;
      pagina++;
    }

    if (todosResultados.length === 0) {
      userRgfSetStatus('Nenhum registro encontrado para ' + campo + ' "' + termo + '".', 'error');
      return;
    }

    // Remove duplicados pela matrícula (parte antes do /), mantendo o mais recente
    const porFuncionario = new Map();
    todosResultados.forEach(r => {
      const chave = (r.matricula || '').split('/')[0];
      const existente = porFuncionario.get(chave);
      if (!existente || (r.ano * 12 + r.mes) > (existente.ano * 12 + existente.mes)) {
        porFuncionario.set(chave, r);
      }
    });

    const funcionarios = Array.from(porFuncionario.values());
    userRgfSetStatus(`${funcionarios.length} resultado${funcionarios.length !== 1 ? 's' : ''} para ${campo} "${termo}".`, 'success');
    userRgfRenderList(funcionarios);
  }

  // ===== Consulta por RGF (único resultado, certeza absoluta) =====
  async function consultarPorRGF(rgf) {
    const resultEl = document.getElementById('user-rgf-consult-result');
    const anoAtual = new Date().getFullYear();
    let results = [];
    for (let ano = anoAtual; ano >= anoAtual - 8 && results.length === 0; ano--) {
      const resp = await fetch(`${PREFEITURA_API}/folha_pagamento?matricula=${rgf}&ano=${ano}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.results && data.results.length > 0) results = data.results;
    }
    if (results.length === 0) {
      userRgfSetStatus('Nenhum registro encontrado para o RGF ' + rgf + '.', 'error');
      return;
    }
    const mensais = results.filter(r => r.tipo_folha === 'Folha de Pagamento Mensal');
    const pool = mensais.length > 0 ? mensais : results;
    const latest = pool.reduce((a, b) => ((b.ano * 12 + b.mes) > (a.ano * 12 + a.mes) ? b : a));
    userRgfSetStatus(`${latest.nome} — competência ${MES_ABREV[(latest.mes || 1) - 1]}/${latest.ano}.`, 'success');

    let verbas = null;
    try {
      const respF = await fetch(`${PREFEITURA_API}/detalhe_folha?idfunselec=${latest.idfunselec}`);
      if (respF.ok) {
        const fd = await respF.json();
        if (fd.results && fd.results.length > 0) verbas = fd.results;
      }
    } catch (_) { /* detalhe opcional */ }

    userRgfRender(latest, verbas);

    // Busca 13º em background
    const decimo = await fetchDecimoTerceiro(rgf, new Date().getFullYear());
    if (decimo) {
      userRgfRender(latest, verbas, decimo);
    }
  }

  // ===== Consulta por Nome (múltiplos resultados em tabela) =====
  async function consultarPorNome(termo) {
    const resultEl = document.getElementById('user-rgf-consult-result');
    const anoAtual = new Date().getFullYear();
    let todosResultados = [];
    let pagina = 1;
    const maxPaginas = 10; // até 10 páginas (500 registros)

    // Percorre páginas até encontrar resultados ou esgotar
    while (pagina <= maxPaginas) {
      const resp = await fetch(`${PREFEITURA_API}/folha_pagamento?nome=${encodeURIComponent(termo)}&ano=${anoAtual}&page=${pagina}`);
      if (!resp.ok) break;
      const data = await resp.json();
      if (!data.results || data.results.length === 0) break;
      todosResultados = todosResultados.concat(data.results);
      if (!data.next) break;
      pagina++;
    }

    if (todosResultados.length === 0) {
      userRgfSetStatus('Nenhum funcionário encontrado com o nome "' + termo + '".', 'error');
      return;
    }

    // Remove duplicados pela matrícula (parte antes do /), mantendo o mais recente
    const porFuncionario = new Map();
    todosResultados.forEach(r => {
      const chave = (r.matricula || '').split('/')[0];
      const existente = porFuncionario.get(chave);
      if (!existente || (r.ano * 12 + r.mes) > (existente.ano * 12 + existente.mes)) {
        porFuncionario.set(chave, r);
      }
    });

    const funcionarios = Array.from(porFuncionario.values());
    userRgfSetStatus(`${funcionarios.length} funcionário${funcionarios.length !== 1 ? 's' : ''} encontrado${funcionarios.length !== 1 ? 's' : ''} para "${termo}".`, 'success');
    userRgfRenderList(funcionarios);
  }

  // ===== Renderiza tabela de funcionários encontrados por nome =====
  function userRgfRenderList(funcionarios) {
    const resultEl = document.getElementById('user-rgf-consult-result');
    if (!resultEl) return;

    // Estado para refiltro local da tabela
    window.__rgfFiltroLista = funcionarios || window.__rgfFiltroLista || [];

    const html = `
      <div class="rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div class="bg-blue-600 dark:bg-blue-500 px-4 py-3">
          <h4 class="text-white font-bold text-sm uppercase tracking-wide">Selecione o funcionário</h4>
        </div>
        <div class="p-3">
          <!-- Campo de refinamento local (filtra sem chamar a API) -->
          <div class="mb-3">
            <input type="text" id="user-rgf-filtro-local" placeholder="Filtrar resultados (nome, RGF, cargo, secretaria...)" class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition-colors">
          </div>
          <div class="p-3 overflow-x-auto">
            <table id="user-rgf-tabela" class="min-w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-sm">
              <thead class="bg-gray-50 dark:bg-zinc-800">
                <tr>
                  <th class="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 text-left font-bold text-gray-700 dark:text-gray-300">RGF</th>
                  <th class="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 text-left font-bold text-gray-700 dark:text-gray-300">Nome</th>
                  <th class="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 text-left font-bold text-gray-700 dark:text-gray-300">Cargo</th>
                  <th class="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 text-left font-bold text-gray-700 dark:text-gray-300">Secretaria</th>
                  <th class="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 text-left font-bold text-gray-700 dark:text-gray-300">Situação</th>
                  <th class="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 text-left font-bold text-gray-700 dark:text-gray-300">Ação</th>
                </tr>
              </thead>
              <tbody id="user-rgf-tabela-corpo">
                ${funcionarios.map(f => `
                  <tr class="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer select-none rgf-list-row"
                      data-rgf="${f.matricula}"
                      data-nome="${f.nome}"
                      data-cargo="${f.cargo || '—'}"
                      data-secretaria="${f.secretaria || '—'}"
                      data-situacao="${f.situacao || '—'}"
                      data-idfunselec="${f.idfunselec || ''}">
                    <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 font-mono font-medium text-gray-800 dark:text-gray-200">${f.matricula}</td>
                    <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 font-bold text-gray-800 dark:text-gray-100">${f.nome}</td>
                    <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">${f.cargo || '—'}</td>
                    <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">${f.secretaria || '—'}</td>
                    <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
                      <span class="inline-block px-2 py-0.5 rounded text-xs font-bold ${f.situacao === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}">${f.situacao || '—'}</span>
                    </td>
                    <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
                      <button class="px-3 py-1 bg-blue-600 dark:bg-blue-500 text-white text-xs font-bold rounded hover:bg-blue-700 dark:hover:bg-blue-400">Selecionar</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center" id="user-rgf-filtro-contador">${funcionarios.length} resultado${funcionarios.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    `;
    resultEl.innerHTML = html;

    // Bind nos botões de selecionar
    resultEl.querySelectorAll('.rgf-list-row button').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.rgf-list-row');
        // Pega só a parte antes do "/" : "22823/0" -> "22823"
        const rgf = row.dataset.rgf.split('/')[0].replace(/\D/g, '');
        const nome = row.dataset.nome || '';
        const input = document.getElementById('user-rgf-consult-input');
        if (input) input.value = rgf;
        // Carrega direto os dados do funcionário selecionado
        consultarPorRGF(rgf);
      });
    });

    // Bind do refinamento local da tabela (filtra sem chamar a API)
    const filtroLocalInput = document.getElementById('user-rgf-filtro-local');
    const tbody = document.getElementById('user-rgf-tabela-corpo');
    const contadorEl = document.getElementById('user-rgf-filtro-contador');
    if (filtroLocalInput && tbody) {
      filtroLocalInput.addEventListener('input', () => {
        const texto = filtroLocalInput.value.toLowerCase().trim();
        if (!texto) {
          tbody.innerHTML = window.__rgfFiltroLista.map(f => `
            <tr class="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer select-none rgf-list-row"
                data-rgf="${f.matricula}"
                data-nome="${f.nome}"
                data-cargo="${f.cargo || '—'}"
                data-secretaria="${f.secretaria || '—'}"
                data-situacao="${f.situacao || '—'}"
                data-idfunselec="${f.idfunselec || ''}">
              <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 font-mono font-medium text-gray-800 dark:text-gray-200">${f.matricula}</td>
              <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 font-bold text-gray-800 dark:text-gray-100">${f.nome}</td>
              <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">${f.cargo || '—'}</td>
              <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">${f.secretaria || '—'}</td>
              <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
                <span class="inline-block px-2 py-0.5 rounded text-xs font-bold ${f.situacao === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}">${f.situacao || '—'}</span>
              </td>
              <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
                <button class="px-3 py-1 bg-blue-600 dark:bg-blue-500 text-white text-xs font-bold rounded hover:bg-blue-700 dark:hover:bg-blue-400">Selecionar</button>
              </td>
            </tr>
          `).join('');
          if (contadorEl) contadorEl.textContent = window.__rgfFiltroLista.length + ' resultado' + (window.__rgfFiltroLista.length !== 1 ? 's' : '');
          _bindRowButtons(tbody);
          return;
        }
        const filtrados = window.__rgfFiltroLista.filter(f => {
          const campo = (f.matricula || '') + ' ' + (f.nome || '') + ' ' + (f.cargo || '') + ' ' + (f.secretaria || '') + ' ' + (f.situacao || '');
          return campo.toLowerCase().includes(texto);
        });
        tbody.innerHTML = filtrados.map(f => `
          <tr class="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer select-none rgf-list-row"
              data-rgf="${f.matricula}"
              data-nome="${f.nome}"
              data-cargo="${f.cargo || '—'}"
              data-secretaria="${f.secretaria || '—'}"
              data-situacao="${f.situacao || '—'}"
              data-idfunselec="${f.idfunselec || ''}">
            <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 font-mono font-medium text-gray-800 dark:text-gray-200">${f.matricula}</td>
            <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 font-bold text-gray-800 dark:text-gray-100">${f.nome}</td>
            <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">${f.cargo || '—'}</td>
            <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">${f.secretaria || '—'}</td>
            <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
              <span class="inline-block px-2 py-0.5 rounded text-xs font-bold ${f.situacao === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}">${f.situacao || '—'}</span>
            </td>
            <td class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
              <button class="px-3 py-1 bg-blue-600 dark:bg-blue-500 text-white text-xs font-bold rounded hover:bg-blue-700 dark:hover:bg-blue-400">Selecionar</button>
            </td>
          </tr>
        `).join('');
        if (contadorEl) contadorEl.textContent = filtrados.length + ' resultado' + (filtrados.length !== 1 ? 's' : '');
        _bindRowButtons(tbody);
      });
    }
  }

  // Re-bind dos botoes Selecionar apos re-render do tbody
  function _bindRowButtons(tbody) {
    tbody.querySelectorAll('.rgf-list-row button').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.rgf-list-row');
        const rgf = row.dataset.rgf.split('/')[0].replace(/\D/g, '');
        const input = document.getElementById('user-rgf-consult-input');
        if (input) input.value = rgf;
        consultarPorRGF(rgf);
      });
    });
  }

  function bindUserRgfConsult() {
    const form = document.getElementById('user-rgf-consult-form');
    if (!form) return;
    form.addEventListener('submit', handleUserRgfConsult);

    // Popup de tipo de pesquisa
    const filtroBtn = document.getElementById('user-rgf-filtro-btn');
    const filtroPopup = document.getElementById('user-rgf-filtro-popup');
    if (filtroBtn && filtroPopup) {
      // Abre/fecha popup
      filtroBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filtroPopup.classList.toggle('hidden');
      });

      // Seleciona tipo de pesquisa
      filtroPopup.querySelectorAll('[data-filtro]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.__rgfFiltroTipo = btn.dataset.filtro;
          filtroPopup.classList.add('hidden');
          // Atualiza visual do botão principal para mostrar o tipo ativo
          const tipos = { nome: 'Nome', matricula: 'Matrícula', cargo: 'Cargo', secretaria: 'Secretaria', situacao: 'Situação' };
          filtroBtn.title = 'Tipo: ' + (tipos[btn.dataset.filtro] || 'Auto');
          filtroBtn.textContent = '🔍 ' + (tipos[btn.dataset.filtro] || 'Filtro');
        });
      });

      // Fecha popup ao clicar fora
      document.addEventListener('click', (e) => {
        if (!filtroPopup.contains(e.target) && e.target !== filtroBtn) {
          filtroPopup.classList.add('hidden');
        }
      });
    }
  }

  // ===== Consulta de feriado por data (para uso do admin e outros módulos) =====
  function isHolidayDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();

    for (const f of HOLIDAYS_2026) {
      const parts = f.data.split('/');
      const fDia = parseInt(parts[0], 10);
      const fMes = parseInt(parts[1], 10);
      // Datas sem ano na tabela são de 2026 (não valem para outros anos)
      const fAno = parts.length > 2 && parts[2] ? parseInt(parts[2], 10) : 2026;

      if (fDia === d && fMes === m && fAno === y) {
        return {
          isHoliday: true,
          evento: f.evento,
          tipo: /facultativo/i.test(f.evento) ? 'facultativo' : 'feriado',
          diaSemana: f.dia
        };
      }
    }
    return { isHoliday: false };
  }

  global.isHolidayDate = isHolidayDate;

  // Próximo feriado (de hoje em diante) para o cartão da tela de início
  function getNextHoliday() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    for (const f of HOLIDAYS_2026) {
      const parts = f.data.split('/');
      const data = new Date(parts[2] ? parseInt(parts[2], 10) : 2026, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      if (data >= hoje && f.dia !== 'Sábado' && f.dia !== 'Domingo') return { data, evento: f.evento };
    }
    return null;
  }

  // Próximo pagamento, adiantamento ou 13º
  function getNextPaymentEvent() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const eventos = [];
    PAYMENT_2026.forEach((p, i) => {
      eventos.push({ label: 'Pagamento', data: new Date(2026, i, p.pag) });
      eventos.push({ label: 'Adiantamento', data: new Date(2026, i, p.adi) });
      if (p.decimo) eventos.push({ label: i === 10 ? '1ª parcela 13º' : '2ª parcela 13º', data: new Date(2026, i, p.decimo) });
    });
    return eventos.filter(e => e.data >= hoje).sort((a, b) => a.data - b.data)[0] || null;
  }

  global.getNextHoliday = getNextHoliday;
  global.getNextPaymentEvent = getNextPaymentEvent;

  // ===== Boot =====
  function initUserHelp() {
    renderUserHolidays();
    renderUserPayment();
    bindUserTabs();
    bindUserRgfConsult();
  }

  global.initUserHelp = initUserHelp;
})(window);