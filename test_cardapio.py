from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()

    print("Acessando...")
    page.goto("https://netdiscada.github.io/Cardapio-Quatinga/", wait_until="domcontentloaded", timeout=20000)
    time.sleep(3)

    # Verifica se elementos existem no DOM (sem clicar)
    elementos = {
        "input_rgf": "#employeeRGF",
        "botao_cardapio": "[data-user-tab='menu']",
        "botao_financas": "[data-user-tab='financas']",
        "botao_pagamento": "[data-user-tab='payment']",
        "botao_ponto": "[data-user-tab='ponto']",
        "botao_feriados": "[data-user-tab='holidays']",
        "secao_cardapio": "#order-section",
        "secao_financas": "#user-financas-section",
        "secao_pagamento": "#user-payment-section",
        "botao_adicionar": "#fin-novo-btn",
    }

    print("\n=== ELEMENTOS NO DOM ===")
    for nome, seletor in elementos.items():
        existe = page.query_selector(seletor)
        print(f"  {'✓' if existe else '✗'} {nome}: {seletor}")

    # Verifica texto na página
    print("\n=== TEXTOS NA PÁGINA ===")
    textos = ["Cardápio", "Finanças", "Pagamento", "Ponto", "Feriados", "ADM"]
    for t in textos:
        achou = page.query_selector(f"text={t}")
        print(f"  {'✓' if achou else '✗'} '{t}'")

    # Screenshot
    page.screenshot(path="/tmp/diag.png", full_page=True)
    print("\nScreenshot: /tmp/diag.png")

    browser.close()
    print("\n=== FIM ===")
