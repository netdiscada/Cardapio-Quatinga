# Testes de Regressão — Cardápio Quatinga

Este diretório contém testes automatizados que validam correções de bugs já ocorridos.

## Objetivo

Garantir que, se o código for alterado no futuro e um bug corrigido reaparecer, o teste falhe imediatamente.

## Como rodar

```bash
# Instalar dependências (uma única vez)
npm install

# Rodar todos os testes
npx vitest run

# Rodar em modo watch (desenvolvimento)
npx vitest
```

## Convenção de nomes

Cada arquivo de teste deve seguir o padrão:

```
<bug-curto>-regression.test.js
```

Exemplo: `timestamp-regression.test.js`

Cada teste deve:

1. Reproduzir exatamente o cenário do bug.
2. Falhar com o código sem a correção.
3. Passar com a correção aplicada.
4. Ser independente (não depender de Firebase real).

## Estrutura atual

- `timestamp-regression.test.js` — valida que `safeToMillis` lida com objetos Timestamp, Date e strings ISO corretamente.
