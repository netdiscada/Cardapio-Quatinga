from playwright.sync_api import sync_playwright
import time, json, os

RESULT_FILE = "/home/runner/work/Cardapio-Quatinga/Cardapio-Quatinga/resultado_teste.json"
STORAGE_FILE = "/home/runner/work/Cardapio-Quatinga/Cardapio-Quatinga/.auth/storage.json"

os.makedirs(os.path.dirname(STORAGE_FILE), exist_ok=True)

results = {
    "site_carregou": False,
    "titulo": "",
    "console_erros": [],
    "abas": {},
    "login_rgf": False,
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # Tenta carregar storage salvo de execuções anteriores
    context = None
    if os.path.exists(STORAGE_FILE):
        print("Carregando storage salvo...")
        context = browser.new_context(storage_state=STORAGE_FILE)
    else:
        context = browser.new_context(viewport={"width": 1280, "height": 800})
    
    page = context.new_page()

    def on_console(msg):
        if msg.type == "error":
            results["console_erros"].append(msg.text[:200])
    page.on("console", on_console)

    page.goto("https://netdiscada.github.io/Cardapio-Quatinga/", wait_until="domcontentloaded", timeout=20000)
    time.sleep(3)
    results["site_carregou"] = True
    results["titulo"] = page.title()

    # Salva storage pra próxima execução
    context.storage_state(path=STORAGE_FILE)
    print(f"Storage salvo em {STORAGE_FILE}")

    # Login RGF
    rgf = page.query_selector("#employeeRGF")
    if rgf:
        rgf.fill("22823")
        results["login_rgf"] = True
        # Tenta submeter o form
        try:
            page.click("button[type='submit']", timeout=3000)
        except:
            try:
                page.click("button:has-text('Entrar')", timeout=3000)
            except:
                try:
                    page.click("button:has-text('Acessar')", timeout=3000)
                except:
                    pass  # Pode não ter botão visível
        time.sleep(3)

    # Testa abas
    abas = [
        ("cardapio", "[data-user-tab='menu']", "#order-section"),
        ("financas", "[data-user-tab='financas']", "#user-financas-section"),
        ("pagamentos", "[data-user-tab='payment']", "#user-payment-section"),
    ]

    for nome, botao, secao in abas:
        try:
            page.click(botao, timeout=5000, force=True)
            time.sleep(3)
            visivel = page.is_visible(secao)
            results["abas"][nome] = visivel
            status = "✓" if visivel else "✗"
            print(f"{status} {nome}")
        except Exception as e:
            results["abas"][nome] = False
            print(f"✗ {nome} — {str(e)[:80]}")

    page.screenshot(path="/tmp/cardapio_final.png", full_page=True)
    browser.close()

# Salva resultado
with open(RESULT_FILE, "w") as f:
    json.dump(results, f, indent=2)

print(f"\n=== RESULTADO ===")
print(json.dumps(results, indent=2))
