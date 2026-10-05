from playwright.sync_api import sync_playwright
import time

results = {
    "site_carregou": False,
    "titulo": "",
    "console_erros": [],
    "abas": {},
    "login_rgf": False,
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
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

    # Login RGF
    rgf = page.query_selector("#employeeRGF")
    if rgf:
        rgf.fill("1601502320")
        results["login_rgf"] = True

    # Testa abas clicando
    abas = [
        ("cardapio", "[data-user-tab='menu']", "#order-section"),
        ("financas", "[data-user-tab='financas']", "#user-financas-section"),
        ("pagamentos", "[data-user-tab='payment']", "#user-payment-section"),
    ]

    for nome, botao, secao in abas:
        try:
            page.click(botao, timeout=5000)
            time.sleep(3)
            visivel = page.is_visible(secao)
            results["abas"][nome] = visivel
            print(f"{'✓' if visivel else '✗'} {nome}")
        except Exception as e:
            results["abas"][nome] = False
            print(f"✗ {nome} — {str(e)[:100]}")

    browser.close()

print(f"\nSite: {results['site_carregou']} | Título: {results['titulo']}")
print(f"RGF: {results['login_rgf']} | Erros console: {len(results['console_erros'])}")
