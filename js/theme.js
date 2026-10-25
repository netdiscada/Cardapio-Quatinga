// Cardapio Quatinga v3 - theme.js
// Tema do app: Automático (segue o celular), Claro ou Escuro (azul-noite).
// Carregado no <head>, antes de tudo, para a tela já abrir na cor certa (sem piscar).
// Também pinta as barras do sistema (onde fica a câmera e a barra de gestos) com a cor
// do fundo do app: no APK pelo plugin nativo AppTheme, no site pela meta theme-color.

(function (global) {
  const KEY = 'themeMode'; // 'auto' | 'light' | 'dark'
  const BG = { light: '#F4F6FB', dark: '#0B1220' };
  const media = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;

  function readMode() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'auto' || saved === 'light' || saved === 'dark') return saved;
      // Versões antigas gravavam 'theme' = 'light' para todo mundo; só 'dark' foi escolha real
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function effective(mode) {
    if (mode === 'auto') return media && media.matches ? 'dark' : 'light';
    return mode;
  }

  function paintSystemBars(theme) {
    const color = BG[theme];
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
    const cap = global.Capacitor;
    const plugin = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.AppTheme;
    if (plugin) plugin.setColors({ background: color, dark: theme === 'dark' }).catch(() => {});
  }

  function apply() {
    const mode = readMode();
    const theme = effective(mode);
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    root.dataset.themeMode = mode;
    paintSystemBars(theme);
    try { global.dispatchEvent(new CustomEvent('themechange', { detail: { mode, theme } })); } catch (e) {}
  }

  function setMode(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    apply();
  }

  // Botão do topo: Automático -> Claro -> Escuro -> Automático
  function cycle() {
    const order = ['auto', 'light', 'dark'];
    setMode(order[(order.indexOf(readMode()) + 1) % order.length]);
  }

  if (media) {
    const onSystemChange = () => { if (readMode() === 'auto') apply(); };
    if (media.addEventListener) media.addEventListener('change', onSystemChange);
    else if (media.addListener) media.addListener(onSystemChange);
  }

  global.Theme = { apply, setMode, cycle, getMode: readMode, getTheme: () => effective(readMode()) };
  apply();
  // O plugin nativo pode ficar pronto depois do <head>: repinta as barras ao carregar
  global.addEventListener('DOMContentLoaded', () => paintSystemBars(effective(readMode())));
})(window);
