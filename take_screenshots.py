import time
from playwright.sync_api import sync_playwright

def main():
    shots = [
        {"url": "http://127.0.0.1:8000/", "path": "docs/landing.png"},
        {"url": "http://127.0.0.1:8000/?at=21.675,72.18", "path": "docs/today.png"},
        {"url": "http://127.0.0.1:8000/?demo=danger", "path": "docs/ask.png"},
        {"url": "http://127.0.0.1:8000/?tab=authority", "path": "docs/authority.png"},
        {"url": "http://127.0.0.1:8000/?tab=system", "path": "docs/system.png"}
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Using a good resolution for README screenshots
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        
        for shot in shots:
            print(f"Navigating to {shot['url']}...")
            page.goto(shot['url'], wait_until="networkidle")
            # Wait a little bit for animations or map tiles to settle
            page.wait_for_timeout(3000)
            
            print(f"Taking screenshot: {shot['path']}")
            page.screenshot(path=shot['path'], full_page=False)
            
        browser.close()
        print("All screenshots taken successfully.")

if __name__ == "__main__":
    main()
