from playwright.sync_api import sync_playwright
import json, sys

results = {
    "site_carregou": False,
    "titulo": "",
    "console_erros": [],
    "abas": {},
    "login_rgf": False,
    "cardapio_visivel": False,
    "financas": {"abriu": False, "modal_abriu": False},
    "pagamentos": {"abriu": False, "rgf_preenchido": False},
}

def log(acao, ok, detalhe=""):
    status = "✅" if ok else "❌"
    print(f"{status} {acao}" + (f" — {detalhe}" if detalhe else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    )
    page = context.new_page()

    # Captura erros do console
    def on_console(msg):
        if msg.type == "error":
            results["console_erros"].append(msg.text[:300])
            log(f"CONSOLE ERROR", False, msg.text[:200])
    def on_pageerror(exc):
        results["console_erros"].append(f"PAGE ERROR: {str(exc)[:300]}")
        log("PAGE ERROR", False, str(exc)[:200])
    page.on("console", on_console)
    page.on("pageerror", on_pageerror)

    try:
        # 1. Carrega o site
        # Desabilita service workers para evitar cache antigo
        page.route("**/sw.js", lambda route: route.fulfill(status=200, body="// noop"))
        page.route("**/sw-*", lambda route: route.fulfill(status=200, body="// noop"))
        page.goto("https://netdiscada.github.io/Cardapio-Quatinga/", wait_until="domcontentloaded", timeout=15000)
        results["site_carregou"] = True
        results["titulo"] = page.title()
        log("Site carregou", True, page.title())

        # 2. Preenche RGF e faz login
        try:
            page.wait_for_selector("input#employeeRGF", timeout=10000)
            page.fill("input#employeeRGF", "1601502320")
            results["login_rgf"] = True
            log("RGF preenchido", True)
            # Clica no botão de confirmar/login se existir
            for btn_txt in ["Entrar", "Confirmar", "Acessar", "OK", "→"]:
                try:
                    page.click(f"button:has-text('{btn_txt}')", timeout=2000)
                    log(f"Clicou no botão '{btn_txt}'", True)
                    time.sleep(2)
                    break
                except:
                    continue
        except Exception as e:
            log("Login RGF", False, str(e)[:200])

        # 3. Aguarda a página principal carregar
        time.sleep(3)

        # 4. Testa aba Cardápio
        try:
            cardapio_el = page.query_selector("text=Cardápio") or page.query_selector("text=🍔") or page.query_selector("[data-tab='cardapio']")
            if cardapio_el:
                cardapio_el.click()
                time.sleep(2)
                # Verifica se algo do cardápio apareceu
                if page.is_visible("text=Cardápio") or page.is_visible(".cardapio") or page.is_visible("#cardapio"):
                    results["abas"]["cardapio"] = True
                    log("Aba Cardápio", True)
                else:
                    results["abas"]["cardapio"] = False
                    log("Aba Cardápio", False, "conteúdo não visível")
            page.screenshot(path="/tmp/cardapio.png", full_page=True)
        except Exception as e:
            results["abas"]["cardapio"] = False
            log("Aba Cardápio", False, str(e)[:200])

        # 5. Testa aba Finanças
        try:
            fin_el = page.query_selector("text=Finanças") or page.query_selector("text=🤑") or page.query_selector("[data-tab='financas']")
            if fin_el:
                fin_el.click()
                time.sleep(2)
                results["abas"]["financas"] = True
                log("Aba Finanças", True)
                results["financas"]["abriu"] = True

                # Tenta abrir modal de adicionar
                try:
                    page.wait_for_selector("#fin-novo-btn", state="visible", timeout=5000)
                    page.click("#fin-novo-btn")
                    time.sleep(1)
                    page.screenshot(path="/tmp/financas_modal.png")
                    results["financas"]["modal_abriu"] = True
                    log("Modal Adicionar Finanças", True)
                    # Fecha modal
                    page.keyboard.press("Escape")
                except Exception as e:
                    log("Modal Adicionar Finanças", False, str(e)[:200])
            page.screenshot(path="/tmp/financas.png", full_page=True)
        except Exception as e:
            results["abas"]["financas"] = False
            log("Aba Finanças", False, str(e)[:200])

        # 6. Testa aba Pagamentos
        try:
            pag_el = page.query_selector("text=Pagamentos") or page.query_selector("text=📄") or page.query_selector("[data-tab='pagamentos']")
            if pag_el:
                pag_el.click()
                time.sleep(3)
                results["abas"]["pagamentos"] = True
                results["pagamentos"]["abriu"] = True
                log("Aba Pagamentos", True)

                rgf = page.query_selector("input#employeeRGF")
                if rgf:
                    valor = rgf.get_attribute("value")
                    results["pagamentos"]["rgf_preenchido"] = bool(valor and valor != "")
                    log("RGF em Pagamentos", True, f"valor={valor}")
            page.screenshot(path="/tmp/pagamentos.png", full_page=True)
        except Exception as e:
            results["abas"]["pagamentos"] = False
            log("Aba Pagamentos", False, str(e)[:200])

        # 7. Testa aba Configurações/Perfil se existir
        try:
            for aba_txt in ["Perfil", "Config", "⚙️", "👤"]:
                el = page.query_selector(f"text={aba_txt}")
                if el:
                    el.click()
                    time.sleep(2)
                    results["abas"]["perfil"] = True
                    log(f"Aba {aba_txt}", True)
                    page.screenshot(path="/tmp/perfil.png", full_page=True)
                    break
        except:
            pass

        # 8. Screenshot final
        page.screenshot(path="/tmp/final.png", full_page=True)

        # 9. Volta pro cardápio pra ver estado final
        try:
            page.click("text=🍔 Cardápio", timeout=5000)
            time.sleep(2)
            results["cardapio_visivel"] = page.is_visible("text=Cardápio")
        except:
            pass

    except Exception as e:
        log("ERRO GERAL", False, str(e)[:300])
        page.screenshot(path="/tmp/erro.png", full_page=True)

    finally:
        browser.close()

# Relatório final
print("\n" + "="*50)
print("RELATÓRIO FINAL")
print("="*50)
print(json.dumps(results, indent=2, ensure_ascii=False))
