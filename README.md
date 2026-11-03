# Cardápio Quatinga (Delícias Urbanas)

Site publicado do Cardápio Quatinga: https://netdiscada.github.io/Cardapio-Quatinga/

**Não edite os arquivos aqui.** Este repositório é só a cópia publicada. O código fica em
`netdiscada/PC-DO-HERMES`, pasta `cardapio-quatinga/www/`, e cada push em `main` lá publica
aqui automaticamente (workflow `site-deploy.yml`) e gera um APK novo.

Os releases `apk-*` deste repositório guardam os APKs e o `update.json` que o app Android
consulta para se atualizar sozinho.

## Para quem for continuar o trabalho

- **Onde mexer:** sempre no `PC-DO-HERMES` (`cardapio-quatinga/www/`, testes em `cardapio-quatinga/tests/`).
  O README de lá explica a estrutura, os workflows e como publicar.
- **Por que não editar aqui:** o `site-deploy.yml` do PC-DO-HERMES espelha a pasta `www/` neste repositório com
  `rsync --delete`. Qualquer arquivo editado aqui à mão (menos o `README.md`) é apagado/sobrescrito no próximo
  push. O `README.md` é preservado de propósito, e é o único arquivo que se edita aqui.
- **Não apague os releases `apk-*`:** os celulares com o app instalado baixam a atualização deles.
- **Quem mexe no `main` daqui:** só o robô (`github-actions[bot]`). Não faça push manual em `main`.

## Branches

| Branch | O que é |
|---|---|
| `main` | O que está no ar (publicado pelo robô) |
| `Backup` | Cópia antiga criada pelo Hermes VPS (71 commits, último em 21/10/2026). Não apagar sem o usuário conferir |
| `fix/apk-updater-pdf-push` | 1 commit com correção (PDF no APK, push duplicado, ponte do atualizador) que **não entrou no `main`**. Pode estar obsoleto: conferir com o usuário |
| `ccr-<id>` | Branches de trabalho das sessões do Claude. Apagar quando o trabalho já estiver no `main` |
