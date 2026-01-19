from playwright.sync_api import sync_playwright

def verify_join_screen(page):
    # Go to the app
    print("Navigating to app...")
    page.goto("http://localhost:8081")

    # Wait for the main menu to load
    print("Waiting for 'Online Multiplayer'...")
    page.get_by_text("Online Multiplayer").wait_for()
    page.get_by_text("Online Multiplayer").click()

    print("Waiting for 'Join Existing Room'...")
    # Use exact text or partial text, but be careful.
    page.get_by_text("Join Existing Room").wait_for()
    page.get_by_text("Join Existing Room").click()

    # Fill in inputs with whitespace
    print("Filling inputs...")
    page.get_by_placeholder("Your Name").fill("  Player2  ")
    page.get_by_placeholder("Room Code (e.g. ABCD123)").fill("  abcd123  ")

    # Wait a bit for React state updates
    page.wait_for_timeout(500)

    # Take screenshot of filled inputs
    page.screenshot(path="/home/jules/verification/join_screen_filled.png")
    print("Screenshot taken at /home/jules/verification/join_screen_filled.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_join_screen(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
