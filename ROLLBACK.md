# ROLLBACK RÁPIDO — Cardápio Quatinga v3

Se o código quebrar e você precisar trocar o site do ar rapidamente, siga este procedimento.

## Opção 1: Reverter o último commit (mais rápida — 2 min)

O Cloudflare Pages faz deploy automático da branch `main`. Se um commit novo quebrou o site, basta desfazê-lo:

```bash
# No seu terminal local (ou VPS Hermes)
cd /caminho/do/repo/Cardapio-Quatinga
git checkout main
git revert --no-commit HEAD          # desfaz as alterações do último commit sem criar commit de merge
git commit -m "rollback: desfaz commit quebrado (versão estável)"
git push origin main                 # Cloudflare Pages redesp redeploya automaticamente
```

O site volta ao estado anterior em ~1–2 min.

## Opção 2: Checkout de tag estável (se vários commits quebraram)

```bash
cd /caminho/do/repo/Cardapio-Quatinga
git checkout main
git reset --hard v2026.1-estavel     # volta para a tag estável
git push origin main --force         # força o push (necessário por causa do reset)
```

A tag `v2026.1-estavel` aponta para o último commit conhecido como funcional.

## Opção 3: Usar o branch Backup

O branch `Backup` é uma cópia exata da última versão funcional. Se precisar subir ele no lugar do `main`:

```bash
cd /caminho/do/repo/Cardapio-Quatinga
git checkout main
git merge Backup --no-edit           # ou git checkout Backup -f se quiser substituir totalmente
git push origin main
```

## Verificação

Após o push, aguarde o Cloudflare Pages finalizar o build (painel do Cloudflare → Pages → seu projeto). Acesse o site e confirme:
- Cardápio carrega (imagem aparece)
- Login de funcionário funciona (RGF 22823 exibe nome e pedido)
- Painel admin abre (login com credenciais do ADMIN_UID)
- Modo escuro do viewer não vaza branco

## Dados do Firestore

O backup de dados (pedidos, cardápio, funcionários) é automático via GitHub Actions (`firestore-backup.yml`). Se precisar restaurar dados, use o script `firestore_backup.py` ou avise o Hermes para injetar direto via Firebase Admin SDK.

---

**Tags disponíveis:** `v2026.1-estavel` (atual)
**Branches:** `main` (produção), `Backup` (cópia de segurança)