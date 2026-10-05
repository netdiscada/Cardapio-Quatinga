import os; os.makedirs(os.path.dirname("/home/runner/work/Cardapio-Quatinga/Cardapio-Quatinga/.auth/storage.json"), exist_ok=True)
from playwright.sync_api import sync_playwright
import time, json

RESULT_FILE = "/home/runner/work/Cardapio-Quatinga/Cardapio-Quatinga/resultado_teste.json"
STORAGE_FILE = "/home/runner/work/Cardapio-Quatinga/Cardapio-Quatinga/.auth/storage.json"

results = {
    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    "login_ok": False,
    "abas": {},
    "financas": {"abriu": False, "modal": False, "adicionou": False, "saldo": ""},
    "pagamentos": {"abriu": False, "rgf": ""},
    "cardapio": {"abriu": False, "itens": 0},
    "erros": [],
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    # Garante que a pasta existe
    os.makedirs(os.path.dirname(STORAGE_FILE), exist_ok=True)
    
    context = browser.new_context(storage_state=STORAGE_FILE) if os.path.exists(STORAGE_FILE) else browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()

    def on_console(msg):
        if msg.type == "error":
            results["erros"].append(f"CONSOLE: {msg.text[:200]}")
    page.on("console", on_console)
    page.on("pageerror", lambda e: results["erros"].append(f"PAGE: {str(e)[:200]}"))

    page.goto("https://netdiscada.github.io/Cardapio-Quatinga/", wait_until="domcontentloaded", timeout=20000)
    time.sleep(3)

    # Login
    rgf = page.query_selector("#employeeRGF")
    if rgf:
        rgf.fill("22823")
        results["login_ok"] = True
        try:
            page.click("button[type='submit']", timeout=3000)
        except:
            pass
        time.sleep(3)

    # 1. CARDÁPIO - conta itens
    try:
        page.click("[data-user-tab='menu']", timeout=5000, force=True)
        time.sleep(3)
        itens = page.query_selector_all(".order-item, .cardapio-item, [class*='item'], .menu-item")
        results["cardapio"]["abriu"] = page.is_visible("#order-section")
        results["cardapio"]["itens"] = len(itens)
        print(f"Cardápio: {len(itens)} itens")
    except Exception as e:
        results["erros"].append(f"CARDAPIO: {str(e)[:100]}")

    # 2. FINANÇAS - adiciona lançamento de teste
    try:
        page.click("[data-user-tab='financas']", timeout=5000, force=True)
        time.sleep(3)
        results["financas"]["abriu"] = page.is_visible("#user-financas-section")
        
        # Tenta abrir modal
        try:
            page.click("#fin-novo-btn", timeout=3000)
            time.sleep(2)
            modal = page.is_visible("#fin-add-modal") or page.is_visible("[id*='modal']")
            results["financas"]["modal"] = modal
            
            if modal:
                # Preenche dados de teste
                page.fill("#fin-add-desc", "TESTE AUTOMATICO")
                page.fill("#fin-add-valor", "10,00")
                page.select_option("#fin-add-tipo", "entrada")
                page.click("button:has-text('Salvar'), #fin-salvar-btn", timeout=3000)
                time.sleep(2)
                results["financas"]["adicionou"] = True
                page.keyboard.press("Escape")
        except Exception as e:
            results["erros"].append(f"FINANCAS-modal: {str(e)[:100]}")

        # Verifica saldo
        try:
            saldo_el = page.query_selector("#fin-saldo, .saldo, [class*='saldo']")
            if saldo_el:
                results["financas"]["saldo"] = saldo_el.inner_text()[:50]
        except:
            pass
    except Exception as e:
        results["erros"].append(f"FINANCAS: {str(e)[:100]}")

    # 3. PAGAMENTOS - verifica RGF
    try:
        page.click("[data-user-tab='payment']", timeout=5000, force=True)
        time.sleep(3)
        results["pagamentos"]["abriu"] = page.is_visible("#user-payment-section")
        rgf_input = page.query_selector("#employeeRGF")
        if rgf_input:
            results["pagamentos"]["rgf"] = rgf_input.get_attribute("value") or ""
        print(f"Pagamentos: RGF={results['pagamentos']['rgf']}")
    except Exception as e:
        results["erros"].append(f"PAGAMENTOS: {str(e)[:100]}")

    # 4. FERIADOS
    try:
        page.click("[data-user-tab='holidays']", timeout=5000, force=True)
        time.sleep(2)
        results["abas"]["feriados"] = page.is_visible("#user-holidays-section") or page.is_visible("[id*='holiday']")
    except:
        results["abas"]["feriados"] = False

    # 5. PONTO
    try:
        page.click("[data-user-tab='ponto']", timeout=5000, force=True)
        time.sleep(2)
        results["abas"]["ponto"] = page.is_visible("#user-ponto-section")
    except:
        results["abas"]["ponto"] = False

    # 6. ADM (se existir)
    try:
        page.click("text=ADM", timeout=3000)
        time.sleep(2)
        results["abas"]["adm"] = True
    except:
        results["abas"]["adm"] = False

    # Salva storage
    context.storage_state(path=STORAGE_FILE)
    page.screenshot(path="/tmp/final_test.png", full_page=True)
    browser.close()

with open(RESULT_FILE, "w") as f:
    json.dump(results, f, indent=2)

print(json.dumps(results, indent=2, ensure_ascii=False))
