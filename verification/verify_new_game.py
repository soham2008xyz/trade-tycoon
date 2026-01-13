
from playwright.sync_api import sync_playwright, expect

def test_new_game_screens():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        # Expo web usually runs on port 8081
        try:
            page.goto("http://localhost:8081")

            # Wait for the "Trade Tycoon" title
            page.wait_for_selector("text=Trade Tycoon", timeout=10000)

            # Take a screenshot of the New Game Screen
            page.screenshot(path="verification/1_new_game_screen.png")
            print("Screenshot 1: New Game Screen captured")

            # Click on "Online Multiplayer"
            page.click("text=Online Multiplayer")

            # Wait for "Online Multiplayer" title
            page.wait_for_selector("text=Online Multiplayer", timeout=5000)

            # Take a screenshot of Multiplayer Menu
            page.screenshot(path="verification/2_multiplayer_menu.png")
            print("Screenshot 2: Multiplayer Menu captured")

            # Click on "New Lobby" and verify toast (if possible, toast might be fleeting)
            # The toast is implemented as a view, so we should be able to see text "Coming soon"
            page.click("text=New Lobby")
            # Wait for toast
            page.wait_for_selector("text=Coming soon", timeout=2000)

            page.screenshot(path="verification/3_toast.png")
            print("Screenshot 3: Toast captured")

            # Click "Back" to go to New Game Screen
            page.click("text=Back")
            page.wait_for_selector("text=Trade Tycoon", timeout=2000)

            # Click on "Local Multiplayer"
            page.click("text=Local Multiplayer")

            # Wait for "Game Setup"
            page.wait_for_selector("text=Game Setup", timeout=2000)

            # Take a screenshot of Game Setup with Back button
            page.screenshot(path="verification/4_game_setup.png")
            print("Screenshot 4: Game Setup captured")

            # Click "Back" in Game Setup
            page.click("text=Back")
            page.wait_for_selector("text=Trade Tycoon", timeout=2000)

            print("Verified navigation back to New Game Screen")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    test_new_game_screens()
