/* ============================================================
 * Menu Image Viewer — Cardápio Quatinga v3.3
 * ============================================================
 * Visualizador fullscreen da imagem do cardápio com:
 * - Pinch-zoom (2 dedos) e duplo toque
 * - Pan (arrastar com 1 dedo quando ampliado)
 * - Botões de ESCOLHA FIXOS na parte de baixo (não somem,
 *   não ficam cobertos, ficam sempre acessíveis)
 * - Botão de zoom +/- e reset para quem tem dificuldade
 *   com gestos de pinça
 * ============================================================ */

const MENU_VIEWER = {
    scale: 1,
    minScale: 1,
    maxScale: 5,
    posX: 0,
    posY: 0,
    isOpen: false,
    // Ponteiros ativos (para pinch)
    pointers: new Map()
};

/* ====== ABRIR / FECHAR ====== */
// src opcional: abre outra imagem (ex.: foto do dia na caixa "Hoje" do Início)
function menuViewerOpen(src) {
    const img = document.getElementById('menu-image');
    const modal = document.getElementById('menu-viewer-modal');
    const viewerImg = document.getElementById('menu-viewer-img');
    const url = typeof src === 'string' ? src : (img && img.src);
    if (!modal || !viewerImg || !url || url === window.location.href) return;

    viewerImg.src = url;
    MENU_VIEWER.scale = 1;
    MENU_VIEWER.posX = 0;
    MENU_VIEWER.posY = 0;
    MENU_VIEWER.pointers.clear();
    menuViewerApplyTransform();
    modal.classList.remove('hidden');
    MENU_VIEWER.isOpen = true;

    // Move o pedido (dias, opções e botão de revisar) pra dentro do viewer (fixo embaixo)
    const wizardHost = document.getElementById('menu-viewer-buttons');
    const wizard = document.getElementById('order-wizard-container');
    if (wizardHost && wizard) wizardHost.appendChild(wizard);
}

function menuViewerClose() {
    const modal = document.getElementById('menu-viewer-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    MENU_VIEWER.isOpen = false;

    // Devolve o pedido pro lugar original (no fim da order-section, após o pedido existente)
    const orderSection = document.getElementById('order-section');
    const wizard = document.getElementById('order-wizard-container');
    if (orderSection && wizard && wizard.parentElement?.id === 'menu-viewer-buttons') {
        orderSection.appendChild(wizard);
    }
}

/* ====== TRANSFORM ====== */
function menuViewerApplyTransform() {
    const img = document.getElementById('menu-viewer-img');
    const stage = document.getElementById('menu-viewer-stage');
    if (!img || !stage) return;

    // Limites do arrasto pelo tamanho EXIBIDO da imagem (offsetWidth/Height, já encaixada
    // na tela), não pelo tamanho original do arquivo: senão dava pra arrastar a imagem
    // pra fora da tela
    const scaledW = img.offsetWidth * MENU_VIEWER.scale;
    const scaledH = img.offsetHeight * MENU_VIEWER.scale;
    const maxX = Math.max(0, (scaledW - stage.clientWidth) / 2);
    const maxY = Math.max(0, (scaledH - stage.clientHeight) / 2);

    MENU_VIEWER.posX = Math.max(-maxX, Math.min(maxX, MENU_VIEWER.posX));
    MENU_VIEWER.posY = Math.max(-maxY, Math.min(maxY, MENU_VIEWER.posY));

    img.style.transform = `translate(${MENU_VIEWER.posX}px, ${MENU_VIEWER.posY}px) scale(${MENU_VIEWER.scale})`;
}

/* Muda o zoom mantendo parado o ponto (focoX, focoY), em coordenadas da tela */
function menuViewerSetScale(newScale, focusX, focusY) {
    const stage = document.getElementById('menu-viewer-stage');
    const old = MENU_VIEWER.scale;
    newScale = Math.min(MENU_VIEWER.maxScale, Math.max(MENU_VIEWER.minScale, newScale));
    if (stage && focusX != null) {
        const r = stage.getBoundingClientRect();
        // posição do foco relativa ao centro do palco
        const fx = focusX - (r.left + r.width / 2);
        const fy = focusY - (r.top + r.height / 2);
        MENU_VIEWER.posX = fx - (fx - MENU_VIEWER.posX) * (newScale / old);
        MENU_VIEWER.posY = fy - (fy - MENU_VIEWER.posY) * (newScale / old);
    } else {
        MENU_VIEWER.posX *= newScale / old;
        MENU_VIEWER.posY *= newScale / old;
    }
    MENU_VIEWER.scale = newScale;
    if (newScale === 1) { MENU_VIEWER.posX = 0; MENU_VIEWER.posY = 0; }
    menuViewerApplyTransform();
}

function menuViewerZoomBy(delta, focusX, focusY) {
    menuViewerSetScale(MENU_VIEWER.scale + delta, focusX, focusY);
}

function menuViewerReset() {
    MENU_VIEWER.scale = 1;
    MENU_VIEWER.posX = 0;
    MENU_VIEWER.posY = 0;
    menuViewerApplyTransform();
}

/* ====== EVENTOS DE TOQUE (pinch + pan) ====== */
function menuViewerBindEvents() {
    const stage = document.getElementById('menu-viewer-stage');
    const img = document.getElementById('menu-viewer-img');
    if (!stage || !img) return;

    let panStart = null;     // {x, y, posX, posY} do início do arrasto
    let pinchStart = null;   // {dist, scale, midX, midY, posX, posY} do início da pinça
    let gesture = { multi: false, moved: false, startX: 0, startY: 0 };
    let lastTap = { time: 0, x: 0, y: 0 };

    function startPan(p) {
        panStart = { x: p.x, y: p.y, posX: MENU_VIEWER.posX, posY: MENU_VIEWER.posY };
    }

    stage.addEventListener('pointerdown', (e) => {
        stage.setPointerCapture(e.pointerId);
        MENU_VIEWER.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (MENU_VIEWER.pointers.size === 1) {
            gesture = { multi: false, moved: false, startX: e.clientX, startY: e.clientY };
            startPan({ x: e.clientX, y: e.clientY });
        } else if (MENU_VIEWER.pointers.size === 2) {
            gesture.multi = true;
            const [a, b] = [...MENU_VIEWER.pointers.values()];
            pinchStart = {
                dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
                scale: MENU_VIEWER.scale,
                midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2,
                posX: MENU_VIEWER.posX, posY: MENU_VIEWER.posY
            };
            panStart = null;
        }
    });

    stage.addEventListener('pointermove', (e) => {
        if (!MENU_VIEWER.pointers.has(e.pointerId)) return;
        MENU_VIEWER.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 10) gesture.moved = true;

        if (MENU_VIEWER.pointers.size === 2 && pinchStart) {
            // PINÇA: zoom em volta do ponto entre os dedos + arrasto junto
            const [a, b] = [...MENU_VIEWER.pointers.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
            const newScale = Math.min(MENU_VIEWER.maxScale, Math.max(MENU_VIEWER.minScale, pinchStart.scale * dist / pinchStart.dist));
            const r = stage.getBoundingClientRect();
            const fx = pinchStart.midX - (r.left + r.width / 2);
            const fy = pinchStart.midY - (r.top + r.height / 2);
            const k = newScale / pinchStart.scale;
            MENU_VIEWER.scale = newScale;
            MENU_VIEWER.posX = fx - (fx - pinchStart.posX) * k + (midX - pinchStart.midX);
            MENU_VIEWER.posY = fy - (fy - pinchStart.posY) * k + (midY - pinchStart.midY);
            if (newScale === 1) { MENU_VIEWER.posX = 0; MENU_VIEWER.posY = 0; }
            menuViewerApplyTransform();
        } else if (MENU_VIEWER.pointers.size === 1 && panStart && MENU_VIEWER.scale > 1) {
            // ARRASTO com 1 dedo (só quando ampliado)
            MENU_VIEWER.posX = panStart.posX + (e.clientX - panStart.x);
            MENU_VIEWER.posY = panStart.posY + (e.clientY - panStart.y);
            menuViewerApplyTransform();
        }
    });

    function endPointer(e) {
        if (!MENU_VIEWER.pointers.has(e.pointerId)) return;
        MENU_VIEWER.pointers.delete(e.pointerId);
        if (MENU_VIEWER.pointers.size === 1) {
            // Saiu um dedo da pinça: o zoom FICA como está; o dedo que sobrou continua arrastando
            pinchStart = null;
            startPan([...MENU_VIEWER.pointers.values()][0]);
            return;
        }
        if (MENU_VIEWER.pointers.size > 0) return;
        panStart = null;
        pinchStart = null;

        // Toque duplo (só toque simples, sem pinça nem arrasto) = amplia/volta
        if (e.type === 'pointerup' && !gesture.multi && !gesture.moved) {
            const now = Date.now();
            if (now - lastTap.time < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
                if (MENU_VIEWER.scale > 1) menuViewerReset();
                else menuViewerSetScale(2.5, e.clientX, e.clientY);
                lastTap = { time: 0, x: 0, y: 0 };
            } else {
                lastTap = { time: now, x: e.clientX, y: e.clientY };
            }
        } else {
            lastTap = { time: 0, x: 0, y: 0 };
        }
    }
    ['pointerup', 'pointercancel'].forEach(ev => stage.addEventListener(ev, endPointer));

    // Roda do mouse (desktop)
    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        menuViewerZoomBy(e.deltaY < 0 ? 0.2 : -0.2, e.clientX, e.clientY);
    }, { passive: false });

    // Botões de controle
    document.getElementById('viewer-zoom-in')?.addEventListener('click', () => menuViewerZoomBy(0.5));
    document.getElementById('viewer-zoom-out')?.addEventListener('click', () => menuViewerZoomBy(-0.5));
    document.getElementById('viewer-reset')?.addEventListener('click', menuViewerReset);
    document.getElementById('viewer-close-btn')?.addEventListener('click', menuViewerClose);
    document.getElementById('menu-viewer-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'menu-viewer-modal') menuViewerClose();
    });
}

// Auto-bind: liga os eventos assim que o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', menuViewerBindEvents);
} else {
    menuViewerBindEvents();
}
