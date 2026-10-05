from playwright.sync_api import sync_playwright
import time, json, os

RESULT_FILE = "/home/runner/work/Cardapio-Quatinga/Cardapio-Quatinga/resultado_teste.json"

results = {
    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    "cardapio": {"abriu": False, "itens": 0},
    "financas": {"abriu": False, "modal": False, "adicionou": False},
    "pagamentos": {"abriu": False, "rgf": ""},
    "login": {"tentou": False, "sucesso": False},
    "erros": [],
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()

    def on_console(msg):
        if msg.type == "error":
            results["erros"].append(f"CONSOLE: {msg.text[:150]}")
    page.on("console", on_console)

    page.goto("https://netdiscada.github.io/Cardapio-Quatinga/", wait_until="domcontentloaded", timeout=20000)
    time.sleep(4)

    # Login
    page.fill("#employeeRGF", "22823")
    time.sleep(2)
    page.keyboard.press("Enter")
    time.sleep(3)
    results["login"]["tentou"] = True

    # CARDÁPIO
    try:
        page.click("[data-user-tab='menu']", timeout=5000, force=True)
        time.sleep(3)
        itens = page.query_selector_all(".order-item, .cardapio-item, [class*='item']")
        results["cardapio"]["abriu"] = True
        results["cardapio"]["itens"] = len(itens)
        print(f"✓ Cardápio: {len(itens)} itens")
    except Exception as e:
        results["erros"].append(f"CARDAPIO: {str(e)[:100]}")

    # FINANÇAS - tenta logar
    try:
        page.click("[data-user-tab='financas']", timeout=5000, force=True)
        time.sleep(3)
        results["financas"]["abriu"] = page.is_visible("#user-financas-section")
        
        # Tenta senha
        try:
            senha = page.query_selector("#fin-senha-input")
            if senha:
                senha.fill("9718")
                page.keyboard.press("Enter")
                time.sleep(3)
                results["login"]["sucesso"] = True
                
            # Se logou, tenta abrir modal
            page.wait_for_selector("#fin-novo-btn", state="visible", timeout=5000)
            page.click("#fin-novo-btn", force=True)
            time.sleep(2)
            results["financas"]["modal"] = True
            page.keyboard.press("Escape")
        except Exception as e:
            results["erros"].append(f"FIN-SENHA: {str(e)[:100]}")
    except Exception as e:
        results["erros"].append(f"FINANCAS: {str(e)[:100]}")

    # PAGAMENTOS
    try:
        page.click("[data-user-tab='payment']", timeout=5000, force=True)
        time.sleep(3)
        results["pagamentos"]["abriu"] = page.is_visible("#user-payment-section")
        
        # Preenche RGF
        rgf = page.query_selector("#employeeRGF")
        if rgf:
            rgf.fill("22823")
            rgf.press("Enter")
            results["pagamentos"]["rgf"] = "22823"
            time.sleep(2)
    except Exception as e:
        results["erros"].append(f"PAGAMENTOS: {str(e)[:100]}")

    # FERIADOS
    try:
        page.click("[data-user-tab='holidays']", timeout=5000, force=True)
        time.sleep(2)
        results["feriados"] = True
    except:
        results["feriados"] = False

    # PONTO
    try:
        page.click("[data-user-tab='ponto']", timeout=5000, force=True)
        time.sleep(2)
        results["ponto"] = True
    except:
        results["ponto"] = False

    # ADM
    try:
        page.click("text=ADM", timeout=3000)
        time.sleep(2)
        results["adm"] = True
    except:
        results["adm"] = False

    page.screenshot(path="/tmp/final.png", full_page=True)
    browser.close()

with open(RESULT_FILE, "w") as f:
    json.dump(results, f, indent=2)

print(json.dumps(results, indent=2, ensure_ascii=False))
