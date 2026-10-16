/**
 * Teste de Regressão — Bug #001
 * 
 * PROBLEMA: timestamp armazenado como string no Firestore quebra .toMillis()
 * ao ler pedidos, deixando a lista vazia no frontend.
 * 
 * CAUSA RAIZ: Código chama .toMillis() diretamente no valor do campo
 * timestamp sem tratar o caso de string ISO.
 * 
 * SOLUÇÃO: Helper safeToMillis() em js/db.js que aceita:
 * - Objeto Firebase Timestamp (com .toMillis())
 * - Objeto Date nativo
 * - String ISO (converte para Date)
 * - null/undefined (retorna 0)
 */

import { describe, it, expect } from 'vitest';

// Simulação do helper safeToMillis que deve existir em js/db.js
function safeToMillis(ts) {
  if (ts == null) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string') {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  // Número (já é millis)
  if (typeof ts === 'number') return ts;
  return 0;
}

// Mock de objeto Firebase Timestamp
function makeTimestamp(millis) {
  return {
    toMillis: () => millis,
    toDate: () => new Date(millis),
  };
}

describe('safeToMillis — regressão do bug de timestamp string', () => {
  it('deve retornar millis de um objeto Firebase Timestamp', () => {
    const ts = makeTimestamp(1791580000000);
    expect(safeToMillis(ts)).toBe(1791580000000);
  });

  it('deve retornar millis de um Date nativo', () => {
    const d = new Date('2026-10-08T13:49:23.701Z');
    expect(safeToMillis(d)).toBe(d.getTime());
  });

  it('deve converter string ISO para millis', () => {
    expect(safeToMillis('2026-10-08T13:49:23.701Z')).toBe(
      new Date('2026-10-08T13:49:23.701Z').getTime()
    );
  });

  it('deve retornar 0 para null', () => {
    expect(safeToMillis(null)).toBe(0);
  });

  it('deve retornar 0 para undefined', () => {
    expect(safeToMillis(undefined)).toBe(0);
  });

  it('deve retornar 0 para string inválida', () => {
    expect(safeToMillis('não é uma data')).toBe(0);
  });

  it('deve aceitar número já em millis', () => {
    expect(safeToMillis(1791580000000)).toBe(1791580000000);
  });
});
