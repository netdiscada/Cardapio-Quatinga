// Cardapio Quatinga - menuText.js
// ADM: cardapio digitado (principal, opcao e guarnicao de cada dia) da semana atual ou da
// proxima. "Preencher com IA" manda a foto ao Worker (Workers AI / Gemini) e o ADM revisa
// antes de salvar em menuText / nextMenuText. Aba Dev: chave do Gemini (guardada pelo Worker).

(function (global) {
  const fb = global.fb;
  const esc = global.escapeHtml;
  const weekDays = global.weekDays;
  const getDayId = global.getDayId;
  const S = function () { return global.__state; };
  const $ = function (id) { return document.getElementById(id); };
  const FIELDS = [['principal', 'Prato principal'], ['opcao', 'Opção'], ['guarnicao', 'Guarnição']];
  let target = 'current';

  function textKey() { return target === 'next' ? 'nextMenuText' : 'menuText'; }

  // Foto que a IA vai ler: a da semana escolhida (na próxima, a recém-recortada vale mais)
  function targetImage() {
    const st = S();
    if (target === 'next') return st.finalImageBase64 || st.currentMenuData.nextMenuImageBase64 || '';
    return st.currentMenuData.menuImageBase64 || '';
  }

  function renderEditor(values) {
    const st = S();
    const data = values || st.currentMenuData[textKey()] || {};
    const holidays = (target === 'next' ? st.currentMenuData.nextHolidays : st.currentMenuData.holidays) || [];
    $('menutext-grid').innerHTML = weekDays.map(day => {
      const id = getDayId(day);
      const v = data[id] || {};
      const holiday = holidays.includes(id);
      return `<fieldset class="mt-day${holiday ? ' holiday' : ''}" data-day="${id}">
        <legend>${esc(day.replace('-feira', ''))}${holiday ? ' <span>feriado</span>' : ''}</legend>
        ${FIELDS.map(([f, label]) => `<label><span>${label}</span><input type="text" maxlength="120" data-field="${f}" value="${esc(v[f] || '')}" placeholder="${holiday ? 'Sem almoço' : '—'}"></label>`).join('')}
      </fieldset>`;
    }).join('');
    document.querySelectorAll('#menutext-tabs button').forEach(b => b.classList.toggle('active', b.dataset.target === target));
    const has = !!targetImage();
    $('menutext-ai').disabled = !has;
    $('menutext-status').textContent = has
      ? (Object.keys(st.currentMenuData[textKey()] || {}).length ? 'Texto salvo. Os funcionários veem os nomes dos pratos.' : 'Ainda sem texto: os funcionários veem só a foto.')
      : (target === 'next' ? 'Escolha e recorte a foto da próxima semana primeiro.' : 'Não há cardápio ativo.');
  }

  function readEditor() {
    const out = {};
    let any = false;
    document.querySelectorAll('#menutext-grid .mt-day').forEach(fs => {
      const day = {};
      fs.querySelectorAll('input[data-field]').forEach(inp => {
        day[inp.dataset.field] = inp.value.trim();
        if (day[inp.dataset.field]) any = true;
      });
      out[fs.dataset.day] = day;
    });
    return any ? out : {};
  }

  async function fillWithAi() {
    const img = targetImage();
    if (!img) return;
    const btn = $('menutext-ai');
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.textContent = 'Lendo a foto...';
    $('menutext-status').textContent = 'A IA está lendo o cardápio. Pode levar uns 20 segundos.';
    try {
      const r = await global.callNotifyEndpoint({ type: 'menu_ai', image: img });
      if (r.error || !r.days) throw new Error((r.errors && r.errors.join(' | ')) || r.error || 'sem resposta');
      renderEditor(r.days);
      $('menutext-status').textContent = `Preenchido pela IA (${r.provider === 'gemini' ? 'Gemini' : 'Cloudflare'}). Confira cada dia e toque em Salvar.`;
      showToast('Cardápio preenchido. Confira antes de salvar.', 'success');
    } catch (err) {
      console.error('[menuText] IA falhou:', err.message);
      $('menutext-status').textContent = 'A IA não conseguiu ler: ' + err.message + '. Você pode digitar à mão.';
      showToast('A IA não conseguiu ler a foto.', 'error', 6000);
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  }

  async function saveText() {
    const btn = $('menutext-save');
    btn.disabled = true;
    try {
      const value = readEditor();
      await fb.setDoc(global.getMenuDocRef(), { [textKey()]: value }, { merge: true });
      S().currentMenuData[textKey()] = value;
      showToast(Object.keys(value).length ? 'Cardápio digitado salvo.' : 'Texto apagado: os funcionários veem só a foto.', 'success');
      renderEditor();
    } catch (err) {
      showToast('Não foi possível salvar o texto.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  // ===== Aba Dev: chave do Gemini =====
  async function aiConfig(payload) {
    const box = $('ai-config-status');
    try {
      const r = await global.callNotifyEndpoint({ type: 'ai_config', ...payload });
      if (r.error) throw new Error(r.error);
      box.innerHTML = `<p><b>Cloudflare Workers AI:</b> ${r.cloudflare && r.cloudflare.available ? 'ligado (grátis, cota diária)' : 'indisponível'}</p>
        <p><b>Gemini:</b> ${r.gemini.configured ? `chave salva ••••${esc(r.gemini.end)}` : 'sem chave (opcional)'}</p>`;
      $('ai-key-clear').classList.toggle('hidden', !r.gemini.configured);
      return true;
    } catch (err) {
      box.textContent = 'Erro: ' + err.message;
      return false;
    }
  }

  function bind() {
    if (!$('menutext-grid')) return;
    $('menutext-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-target]');
      if (!b) return;
      target = b.dataset.target;
      renderEditor();
    });
    $('menutext-ai').addEventListener('click', fillWithAi);
    $('menutext-save').addEventListener('click', saveText);
    $('menutext-clear').addEventListener('click', () => {
      document.querySelectorAll('#menutext-grid input').forEach(i => { i.value = ''; });
    });
    $('ai-config-refresh')?.addEventListener('click', () => aiConfig({ action: 'get' }));
    document.querySelector('[data-admin-tab="dev"]')?.addEventListener('click', () => aiConfig({ action: 'get' }));
    $('ai-key-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('ai-key-input');
      if (!input.value.trim()) return;
      if (await aiConfig({ action: 'set', geminiKey: input.value.trim() })) { input.value = ''; showToast('Chave do Gemini salva.', 'success'); }
    });
    $('ai-key-clear')?.addEventListener('click', () => {
      showCustomConfirm('Apagar a chave do Gemini?', () => aiConfig({ action: 'clear' }));
    });
  }

  global.renderMenuTextEditor = function () { if ($('menutext-grid')) renderEditor(); };
  global.loadAiConfig = function () { if ($('ai-config-status')) aiConfig({ action: 'get' }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})(window);
