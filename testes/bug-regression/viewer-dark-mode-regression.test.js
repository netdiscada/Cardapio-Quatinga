/**
 * Teste de Regressão — Bug #003
 * 
 * PROBLEMA: No modo escuro, o viewer de zoom fica com fundo branco vazando
 * fora do wizard, botões ilegíveis e ícones de controle sem contraste.
 * 
 * CAUSA RAIZ: O CSS anterior tratava apenas #menu-viewer-buttons, mas não
 * os elementos pai (#menu-viewer-modal, #menu-viewer-stage, #menu-viewer-img)
 * nem os botões de controle em html.dark.
 * 
 * SOLUÇÃO: Sobrescrita de CSS scoped html.dark para todo o viewer em
 * index.html.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8');

describe('viewer dark mode — regressão de fundo branco vazando no modo escuro', () => {
  it('deve definir fundo preto no modal do viewer em modo escuro', () => {
    expect(html).toContain('html.dark #menu-viewer-modal');
    expect(html).toContain('background: rgba(0,0,0,0.95) !important');
  });

  it('deve definir fundo preto no stage do viewer em modo escuro', () => {
    expect(html).toContain('html.dark #menu-viewer-stage');
    expect(html).toContain('background: #000000 !important');
  });

  it('deve definir fundo preto na imagem do viewer em modo escuro', () => {
    expect(html).toContain('html.dark #menu-viewer-img');
    expect(html).toContain('background: #000000 !important');
  });

  it('deve manter wizard como card branco flutuante no modo escuro', () => {
    expect(html).toContain('html.dark #menu-viewer-buttons > #order-wizard-container');
    expect(html).toContain('background: #ffffff !important');
  });

  it('deve definir texto escuro nos botões do wizard no modo escuro', () => {
    expect(html).toContain('html.dark #menu-viewer-buttons .wizard-btn');
    expect(html).toContain('color: #111827 !important');
  });

  it('deve estilizar botões de controle (zoom/fechar) no modo escuro', () => {
    expect(html).toContain('html.dark #viewer-zoom-in');
    expect(html).toContain('html.dark #viewer-close-btn');
    expect(html).toContain('color: #ffffff !important');
  });

  it('deve usar !important para garantir prioridade sobre Tailwind dinâmico', () => {
    const matches = html.match(/!important/g);
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });
});
