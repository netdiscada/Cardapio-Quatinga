# Log de Bugs — Cardápio Quatinga v3

| # | Data | Descrição | Causa Raiz | Solução Aplicada | Teste | Efeito Colateral |
|---|------|-----------|------------|------------------|-------|------------------|
| 001 | 2026-10-16 | `timestamp` armazenado como string no Firestore quebra `.toMillis()` ao ler pedidos, deixando a lista de pedidos vazia no frontend. | `submitOrder` grava `fb.serverTimestamp()`, mas restaurações/dados injetados via script gravam string ISO. O código em `order.js` e `admin.js` chama `.toMillis()` sem tratar o caso de string. | Criação de helper `safeToMillis()` centralizado em `js/db.js` e uso em todos os pontos de leitura de timestamp. Dados existentes com string são convertidos automaticamente ao ler. | `testes/bug-regression/timestamp-regression.test.js` | Nenhum. O helper é defensivo e não altera o formato de gravação, apenas a leitura. |
