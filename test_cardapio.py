from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    print("== 1. Acessando site ==")
    page.goto("https://netdiscada.github.io/Cardapio-Quatinga/")
    time.sleep(3)
    print(f"Título: {page.title()}")

    print("== 2. Console errors (se houver) ==")
    page.on("console", lambda msg: print(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
    time.sleep(2)

    print("== 3. Screenshot ==")
    page.screenshot(path="/tmp/screenshot1.png", full_page=True)
    print("Salvo: /tmp/screenshot1.png")

    print("== 4. Testa abas ==")
    try:
        page.click("text=🤑 Finanças", timeout=5000)
        print("Clicou em Finanças")
        time.sleep(2)
        page.screenshot(path="/tmp/screenshot2.png")
    except Exception as e:
        print(f"Falha ao clicar em Finanças: {e}")

    try:
        page.click("text=+ Adicionar", timeout=5000)
        print("Clicou em + Adicionar")
        time.sleep(2)
        page.screenshot(path="/tmp/screenshot3.png")
    except Exception as e:
        print(f"Falha em + Adicionar: {e}")

    print("== 5. Testa contracheque ==")
    try:
        page.click("text=📄 Pagamentos", timeout=5000)
        print("Clicou em Pagamentos")
        time.sleep(3)
        page.screenshot(path="/tmp/screenshot4.png")
        # Preenche RGF se necessário
        try:
            page.fill("input#employeeRGF", "1601502320")
            page.click("text=Buscar")
            time.sleep(3)
            page.screenshot(path="/tmp/screenshot5.png")
        except:
            pass
    except Exception as e:
        print(f"Falha em Pagamentos: {e}")

    browser.close()
    print("\n== FIM ==")
