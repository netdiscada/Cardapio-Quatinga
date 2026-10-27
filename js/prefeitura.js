// Cardapio Quatinga v3 - prefeitura.js
// Folha de pagamento no portal de dados abertos da Prefeitura de Mogi das Cruzes.
// Usada pela consulta de RGF (funcionário e ADM) e pelo Finanças (contracheque).
// Antes cada tela tinha sua própria cópia destas buscas, com pequenas diferenças.
// Erro de rede sobe para quem chamou (cada tela mostra a sua mensagem).

(function (global) {
  const API = 'https://dadosadm.mogidascruzes.sp.gov.br/api';

  async function getJson(path) {
    const resp = await fetch(API + path);
    return resp.ok ? resp.json() : null;
  }

  // Folhas do RGF no ano mais recente que tiver registro, procurando até `anosAtras` anos
  // (a API pagina em ordem cronológica; filtrar por ano garante o registro mais novo)
  async function folhasDoRgf(rgf, anosAtras) {
    const anoAtual = new Date().getFullYear();
    for (let ano = anoAtual; ano >= anoAtual - anosAtras; ano--) {
      const data = await getJson(`/folha_pagamento?matricula=${rgf}&ano=${ano}`);
      if (data && data.results && data.results.length > 0) return data.results;
    }
    return [];
  }

  // Todas as folhas do RGF em um ano específico (ex.: procurar a do 13º)
  async function folhasDoAno(rgf, ano) {
    const data = await getJson(`/folha_pagamento?matricula=${rgf}&ano=${ano}`);
    return (data && data.results) || null;
  }

  // Só as folhas mensais (se houver); senão todas
  function folhasMensais(results) {
    const mensais = results.filter(r => r.tipo_folha === 'Folha de Pagamento Mensal');
    return mensais.length > 0 ? mensais : results;
  }

  // Folha mensal mais recente (ou a mais nova, se não houver mensal)
  function folhaMaisRecente(results) {
    return folhasMensais(results).reduce((a, b) => ((b.ano * 12 + b.mes) > (a.ano * 12 + a.mes) ? b : a));
  }

  // Verbas (proventos e descontos) de uma folha; [] se não vier
  async function detalheFolha(idfunselec) {
    const data = await getJson(`/detalhe_folha?idfunselec=${idfunselec}`);
    return (data && data.results) || [];
  }

  // Busca por nome, cargo, secretaria... no ano atual, juntando até `maxPaginas` páginas
  async function buscarPorCampo(campo, termo, maxPaginas) {
    const anoAtual = new Date().getFullYear();
    let todos = [];
    for (let pagina = 1; pagina <= maxPaginas; pagina++) {
      const data = await getJson(`/folha_pagamento?${campo}=${encodeURIComponent(termo)}&ano=${anoAtual}&page=${pagina}`);
      if (!data || !data.results || data.results.length === 0) break;
      todos = todos.concat(data.results);
      if (!data.next) break;
    }
    return todos;
  }

  global.Prefeitura = { folhasDoRgf, folhasDoAno, folhasMensais, folhaMaisRecente, detalheFolha, buscarPorCampo };
})(window);
