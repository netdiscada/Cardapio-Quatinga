/**
 * Teste de Regressão — Bug #002
 * 
 * PROBLEMA: Botões do wizard ficam com cores apagadas/ilegíveis ao abrir
 * imagem no zoom fullscreen.
 * 
 * CAUSA RAIZ: Botões herdam classes Tailwind escuras (dark:bg-slate-800/50,
 * border-gray-200, dark:text-slate-200) que não contrastam com o fundo escuro
 * do viewer (#18181b).
 * 
 * SOLUÇÃO: Sobrescrita de estilos CSS scoped ao container #menu-viewer-buttons
 * em index.html.
 * 
 * TESTE: Valida que as regras de correção de contraste estão presentes no
 * arquivo index.html (seletor #menu-viewer-buttons com estilos de botão
 * claros).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8');

describe('viewer contrast — regressão do bug de cores apagadas no zoom', () => {
  it('deve existir seletor scoped para wizard-btn dentro do viewer', () => {
    expect(html).toContain('#menu-viewer-buttons .wizard-btn');
  });

  it('deve definir background branco nos botões do viewer', () => {
    expect(html).toContain('background: #ffffff !important');
  });

  it('deve definir texto escuro nos botões do viewer', () => {
    expect(html).toContain('color: #111827 !important');
  });

  it('deve definir borda clara nos botões do viewer', () => {
    expect(html).toContain('border: 1px solid #e5e7eb !important');
  });

  it('deve manter fundo sólido no rodapé do viewer', () => {
    expect(html).toContain('#menu-viewer-buttons {');
    expect(html).toContain('background: #18181b !important');
  });

  it('deve usar !important para garantir prioridade sobre Tailwind dinâmico', () => {
    const matches = html.match(/!important/g);
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});
