# Sistema de Gestão de Bugs — Cardápio Quatinga

Este documento define o processo obrigatório para detecção, correção e prevenção de bugs no projeto. As 5 regras abaixo são inegociáveis.

## Regra 1 — Análise de Causa Raiz

Antes de qualquer correção, o desenvolvedor deve responder por escrito:

- **O que está acontecendo?** (sintoma observado)
- **Por que está acontecendo?** (causa técnica direta)
- **Por que essa causa existe?** (causa raiz: falha de lógica, contrato de dados ausente, ausência de validação, etc.)
- **Por que não foi detectado antes?** (falta de teste, edge case não coberto, etc.)

Somente após documentar a causa raiz é que se propõe a correção.

## Regra 2 — Implementação da Correção

- A correção deve ser **isolada**: alterar o mínimo possível de código, preferencialmente em um único ponto centralizado.
- Não refatorar funcionalidades não relacionadas no mesmo commit.
- A correção deve ser revisável: diff pequeno, comentário explicando o "por que", não o "o que".
- Se o bug envolve dados no Firestore, a correção deve considerar dados já existentes (migração ou defensivo).

## Regra 3 — Teste de Regressão Obrigatório

Após a correção, deve ser criado ou atualizado um teste automatizado que:

- Reproduza exatamente o cenário do bug.
- Falhe se o código for revertido para a versão com bug.
- Passe com a correção aplicada.
- Esteja localizado em `testes/bug-regression/`.
- Nome do arquivo: `<descricao-curta>-regression.test.js`.

## Regra 4 — Log de Bugs

Todo bug corrigido deve ser registrado em `bugs_log.md` com:

| Campo | Obrigatório? |
|-------|-------------|
| Data da detecção | Sim |
| Descrição do problema | Sim |
| Causa raiz | Sim |
| Solução aplicada | Sim |
| Link/referência para o teste | Sim |
| Efeito colateral verificado | Sim |

## Regra 5 — Verificação de Efeito Colateral

Antes de fechar o bug, o desenvolvedor deve responder:

- Quais outras partes do sistema usam o código alterado?
- Há risco de regressão em fluxos relacionados (ex: alterar ordem de pedidos afeta relatório PDF e admin)?
- Quais verificações extras devem ser feitas manualmente ou por teste?

## Fluxo de Trabalho

1. **Detecção**: Bug reportado (usuário, QA, monitoramento).
2. **Causa raiz**: Documentar causa no `bugs_log.md`.
3. **Correção**: Implementar no código.
4. **Teste**: Criar/atualizar teste de regressão em `testes/bug-regression/`.
5. **Efeito colateral**: Listar verificação feita.
6. **Log**: Atualizar `bugs_log.md` com todos os campos.
7. **Commit**: Um commit por bug, contendo correção + teste + atualização do log.

## Estrutura de Pastas

```
testes/
  bug-regression/
    README.md              # Como rodar os testes
    <bug>-regression.test.js # Um teste por bug corrigido
bugs_log.md                # Log centralizado
BUG_MANAGEMENT.md          # Este documento
```

## Como Rodar os Testes de Regressão

```bash
# Exemplo com Vitest (Node)
cd testes/bug-regression
npm install
npx vitest run
```

Os testes devem rodar offline (sem Firebase real), usando mocks ou dados simulados, para validar lógica pura de JS.

---
**Versão:** 1.0 — Cardápio Quatinga v3
**Autor:** Hermes Agent (sistema definido por Fernando)