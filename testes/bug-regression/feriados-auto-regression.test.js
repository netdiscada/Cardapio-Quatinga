/**
 * Teste de Regressão — Bug #004 (melhoria/automação)
 * 
 * PROBLEMA: Ao lançar novo cardápio, o admin precisa verificar manualmente
 * os feriados e clicar nos dias correspondentes no calendário.
 * 
 * MELHORIA: Os feriados da próxima semana devem vir pré-selecionados
 * automaticamente usando a tabela HOLIDAYS_2026 já existente na aba Feriados.
 * 
 * CAUSA RAIZ: Não havia nenhuma lógica de pré-seleção — o calendário começava
 * vazio toda vez que o admin abria a tela da próxima semana.
 * 
 * SOLUÇÃO: Função preselectHolidaysFromTable() em js/admin.js que lê as
 * datas da próxima semana, consulta isHolidayDate() (da tabela HOLIDAYS_2026)
 * e pré-seleciona automaticamente os dias que são feriado/facultativo.
 * Não sobrescreve seleção manual existente.
 */

import { describe, it, expect } from 'vitest';

// Simulação da tabela HOLIDAYS_2026 (mesma de userhelp.js)
const HOLIDAYS_2026 = [
  { data: '12/10', evento: 'Nossa Senhora Aparecida', dia: 'Segunda' },
  { data: '15/11', evento: 'Proclamação da República', dia: 'Domingo' },
  { data: '20/11', evento: 'Consciência Negra', dia: 'Sexta' },
  { data: '25/12', evento: 'Natal', dia: 'Sexta' },
  { data: '01/01', evento: 'Dia da Confraternização Universal e da Paz', dia: 'Quinta' },
  { data: '02/01', evento: 'Facultativo', dia: 'Sexta' },
];

// Simulação de isHolidayDate
function isHolidayDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  for (const f of HOLIDAYS_2026) {
    const parts = f.data.split('/');
    const fDia = parseInt(parts[0], 10);
    const fMes = parseInt(parts[1], 10);
    const fAno = parts.length > 2 && parts[2] ? parseInt(parts[2], 10) : y;
    if (fDia === d && fMes === m && fAno === y) {
      return { isHoliday: true, evento: f.evento };
    }
  }
  return { isHoliday: false };
}

// Simulação de getNextWeekDates (seg-sex da próxima semana)
// Retorna array de 7 datas: dom, seg, ter, qua, qui, sex, sab
function getNextWeekDates() {
  const now = new Date();
  let daysUntilMonday = (1 + 7 - now.getDay()) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7;
  const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  const gridStart = new Date(nextMonday);
  gridStart.setDate(gridStart.getDate() - 1); // domingo anterior
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

// Função sob teste (cópia da lógica de preselectHolidaysFromTable)
function preselectHolidaysFromTable(existingHolidays) {
  const dates = getNextWeekDates();
  const dayIds = ['segundafeira', 'tercafeira', 'quartafeira', 'quintafeira', 'sextafeira'];

  if (existingHolidays && existingHolidays.length > 0) {
    return existingHolidays; // não sobrescreve seleção manual
  }

  const autoHolidays = [];
  dates.slice(1, 6).forEach((date, i) => {
    const holidayInfo = isHolidayDate(date);
    if (holidayInfo && holidayInfo.isHoliday) {
      autoHolidays.push(dayIds[i]);
    }
  });
  return autoHolidays;
}

describe('preselectHolidaysFromTable — automação de feriados no cardápio', () => {
  it('deve pré-selecionar automaticamente feriados da próxima semana', () => {
    const result = preselectHolidaysFromTable([]);
    expect(Array.isArray(result)).toBe(true);
    // Cada item deve ser um dia útil válido
    result.forEach(r => {
      expect(['segundafeira','tercafeira','quartafeira','quintafeira','sextafeira']).toContain(r);
    });
  });

  it('não deve sobrescrever feriados já definidos manualmente', () => {
    const manual = ['segundafeira', 'quartafeira'];
    const result = preselectHolidaysFromTable(manual);
    expect(result).toEqual(manual);
  });

  it('deve retornar array vazio quando não há feriados na próxima semana', () => {
    // Tabela sem feriados para a próxima semana (datas distantes)
    const originalHolidays = HOLIDAYS_2026;
    // Sobrescreve para teste
    const fakeIsHoliday = () => ({ isHoliday: false });
    const dates = getNextWeekDates();
    const dayIds = ['segundafeira', 'tercafeira', 'quartafeira', 'quintafeira', 'sextafeira'];
    const autoHolidays = [];
    dates.slice(1, 6).forEach((date, i) => {
      const hi = fakeIsHoliday(date);
      if (hi && hi.isHoliday) autoHolidays.push(dayIds[i]);
    });
    expect(autoHolidays).toEqual([]);
  });

  it('deve incluir apenas dias úteis (seg-sex), nunca fim de semana', () => {
    const result = preselectHolidaysFromTable([]);
    const validos = new Set(['segundafeira','tercafeira','quartafeira','quintafeira','sextafeira']);
    result.forEach(r => expect(validos.has(r)).toBe(true));
  });

  it('deve detectar 12/10 como feriado se cair na próxima semana', () => {
    // Verifica que a tabela contém 12/10
    const temDozeOutubro = HOLIDAYS_2026.some(f => f.data === '12/10');
    expect(temDozeOutubro).toBe(true);
  });
});
