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

  // Reduz a foto (lado maior 1024 px, JPEG 0.72) antes de mandar: menos dados, IA mais rápida
  async function compressForAi(dataUrl) {
    try {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL('image/jpeg', 0.72);
      return out.length < dataUrl.length ? out : dataUrl;
    } catch (e) {
      return dataUrl;
    }
  }

  function providerLabel(r) {
    const name = r.provider === 'gemini' ? 'Gemini' : 'Cloudflare';
    return `${name}${r.model ? ' · ' + r.model : ''}${r.ms ? ' · ' + Math.round(r.ms / 1000) + ' s' : ''}`;
  }

  async function fillWithAi() {
    const original = targetImage();
    if (!original) return;
    const img = await compressForAi(original);
    const btn = $('menutext-ai');
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.textContent = 'Lendo a foto...';
    const t0 = Date.now();
    const tick = setInterval(() => {
      $('menutext-status').textContent = `A IA está lendo o cardápio... ${Math.round((Date.now() - t0) / 1000)} s (não feche esta tela)`;
    }, 1000);
    $('menutext-status').textContent = 'A IA está lendo o cardápio...';
    try {
      const r = await global.callNotifyEndpoint({ type: 'menu_ai', image: img });
      if (r.error || !r.days) throw new Error((r.errors && r.errors.join(' | ')) || r.error || 'sem resposta');
      renderEditor(r.days);
      $('menutext-status').textContent = `Preenchido pela IA (${providerLabel(r)}). Confira cada dia e toque em Salvar.`;
      showToast('Cardápio preenchido. Confira antes de salvar.', 'success');
    } catch (err) {
      console.error('[menuText] IA falhou:', err.message);
      $('menutext-status').textContent = 'A IA não conseguiu ler: ' + err.message + '. Você pode digitar à mão.';
      showToast('A IA não conseguiu ler a foto.', 'error', 6000);
    } finally {
      clearInterval(tick);
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
  const DEFAULT_MODELS = {
    gemini: ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash'],
    cloudflare: ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/meta/llama-3.2-11b-vision-instruct']
  };
  let aiOrder = 'gemini_first';

  function fillSelect(sel, list, value, autoLabel) {
    sel.innerHTML = `<option value="auto">${autoLabel}</option>` + list.map(v => `<option value="${esc(v)}">${esc(v.replace('@cf/', ''))}</option>`).join('');
    sel.value = list.includes(value) ? value : 'auto';
  }

  function paintOrder() {
    document.querySelectorAll('#ai-order button').forEach(b => b.classList.toggle('active', b.dataset.order === aiOrder));
  }

  async function aiConfig(payload) {
    const box = $('ai-config-status');
    try {
      const r = await global.callNotifyEndpoint({ type: 'ai_config', ...payload });
      if (r.error) throw new Error(r.error);
      box.innerHTML = `<span class="ai-chip ${r.cloudflare && r.cloudflare.available ? 'on' : ''}">Cloudflare ${r.cloudflare && r.cloudflare.available ? 'ligada' : 'indisponível'}</span>
        <span class="ai-chip ${r.gemini.configured ? 'on' : ''}">Gemini ${r.gemini.configured ? '••••' + esc(r.gemini.end) : 'sem chave'}</span>`;
      $('ai-key-clear').classList.toggle('hidden', !r.gemini.configured);
      const models = r.models || DEFAULT_MODELS;
      const prefs = r.prefs || {};
      aiOrder = prefs.order || aiOrder;
      paintOrder();
      fillSelect($('ai-gemini-model'), models.gemini, prefs.geminiModel, 'Automático (recomendado)');
      fillSelect($('ai-cf-model'), models.cloudflare, prefs.cfModel, 'Automático');
      return true;
    } catch (err) {
      box.textContent = 'Erro: ' + err.message;
      showToast(err.message, 'error', 7000);
      return false;
    }
  }

  async function savePrefs() {
    const ok = await aiConfig({ action: 'prefs', order: aiOrder, geminiModel: $('ai-gemini-model').value, cfModel: $('ai-cf-model').value });
    if (ok) showToast('Escolhas da IA salvas.', 'success');
  }

  // Testa a leitura com a foto da semana atual, sem mexer no texto salvo
  async function testAi() {
    const src = S().currentMenuData.menuImageBase64;
    const out = $('ai-test-result');
    if (!src) { showToast('Não há cardápio ativo para testar.', 'info'); return; }
    const btn = $('ai-test');
    btn.disabled = true;
    out.classList.remove('hidden');
    const t0 = Date.now();
    const tick = setInterval(() => { out.textContent = `Testando... ${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
    try {
      const img = await compressForAi(src);
      const r = await global.callNotifyEndpoint({ type: 'menu_ai', image: img, provider: aiOrder, geminiModel: $('ai-gemini-model').value, cfModel: $('ai-cf-model').value });
      const total = Math.round((Date.now() - t0) / 1000);
      if (r.error || !r.days) {
        out.innerHTML = `<b>Falhou em ${total} s.</b><ul>${(r.errors || [r.error]).map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
      } else {
        const lines = weekDays.map(day => {
          const v = r.days[getDayId(day)] || {};
          return `<li><b>${esc(day.replace('-feira', ''))}:</b> ${esc([v.principal, v.opcao, v.guarnicao].filter(Boolean).join(' · ') || '—')}</li>`;
        }).join('');
        out.innerHTML = `<b>Leu em ${total} s</b> (${esc(providerLabel(r))})<ul>${lines}</ul>${r.errors && r.errors.length ? `<p class="ai-help">Antes falhou: ${esc(r.errors.join(' | '))}</p>` : ''}`;
      }
    } catch (err) {
      out.textContent = 'Erro: ' + err.message;
    } finally {
      clearInterval(tick);
      btn.disabled = false;
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
    $('ai-order')?.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-order]');
      if (b) { aiOrder = b.dataset.order; paintOrder(); }
    });
    $('ai-prefs-save')?.addEventListener('click', savePrefs);
    $('ai-test')?.addEventListener('click', testAi);
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
