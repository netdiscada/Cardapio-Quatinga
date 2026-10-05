from playwright.sync_api import sync_playwright
import time

def main():
    with sync_playwright() as p:
        # Lança como um navegador de verdade
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        print("== Teste Cardápio Quatinga ==")

        # 1. Acessa
        print("\n1. Acessando site...")
        page.goto("https://netdiscada.github.io/Cardapio-Quatinga/")
        page.wait_for_load_state("networkidle")
        print(f"Título: {page.title()}")

        # Captura console errors
        errors = []
        page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"[PAGE_ERROR] {exc}"))
        print(f"Console errors (até agora): {errors}")

        # 2. Verifica se a sidebar abre
        print("\n2. Abrindo sidebar...")
        page.click("button[aria-label='Menu'], .sidebar-toggle", timeout=10000)
        time.sleep(1)
        page.screenshot(path="/tmp/sidebar.png")
        print("Sidebar aberta")

        # 3. Testa RGF (login)
        print("\n3. Preenchendo RGF...")
        page.fill("input#employeeRGF", "1601502320")
        time.sleep(1)

        # 4. Testa abas
        abas = ["🍔 Cardápio", "🍹 Lanches", "🤑 Finanças", "📄 Pagamentos"]
        for aba in abas:
            print(f"\n4. Testando aba {aba}...")
            try:
                page.click(f"text='{aba}'", timeout=10000)
                time.sleep(2)  # Espera o conteúdo carregar

                # Verifica se o conteúdo da aba apareceu
                if page.is_visible("div[class*='section']"):
                    print(f"  {aba} - OK, conteúdo visível")
                else:
                    print(f"  {aba} - ERRO, conteúdo não apareceu")

                page.screenshot(path=f"/tmp/aba_{aba.replace(' ', '_')}.png", full_page=True)
            except Exception as e:
                print(f"  {aba} - FALHA: {e}")

        # 5. Verifica finanças detalhado
        print("\n5. Testando Finanças em detalhe...")
        try:
            page.click("text=🤑 Finanças", timeout=10000)
            time.sleep(2)

            # Tenta abrir modal
            try:
                page.wait_for_selector("#fin-novo-btn", state="visible", timeout=5000)
                print("  Botão + Adicionar modal encontrado")
                page.click("#fin-novo-btn")
                time.sleep(1)
                page.screenshot(path="/tmp/financas_modal.png")
                print("  Modal aberto")
            except Exception as e:
                print(f"  Modal não abriu: {e}")

            # Verifica lista de lançamentos
            try:
                lancamentos = page.locator("#fin-lista > *")
                count = lancamentos.count()
                print(f"  Lançamentos encontrados: {count}")
            except:
                print("  Lista de lançamentos não apareceu")

        except Exception as e:
            print(f"  Falha na seção Finanças: {e}")

        # 6. Verifica contracheque (pagamentos)
        print("\n6. Testando Pagamentos...")
        try:
            page.click("text=📄 Pagamentos", timeout=10000)
            time.sleep(3)

            # Verifica se tem campo RGF preenchido
            rgf_input = page.query_selector("input#employeeRGF")
            if rgf_input:
                valor = rgf_input.get_attribute('value')
                print(f"  RGF atual: {valor}")

            page.screenshot(path="/tmp/pagamentos.png", full_page=True)
        except Exception as e:
            print(f"  Falha em Pagamentos: {e}")

        # 7. Relatório final de erros
        print("\n== RELATÓRIO FINAL ==")
        print(f"Erros no console: {len(errors)}")
        for err in errors[:10]:  # Mostra até 10 erros
            print(f"  - {err}")

        if errors:
            print("\n[console.log] Erros encontrados:")
            for err in errors[:5]:
                print(f"    {err}")

        # Fecha
        time.sleep(2)
        browser.close()
        print("\n== Teste concluído ==")

if __name__ == "__main__":
    main()
