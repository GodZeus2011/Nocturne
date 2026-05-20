import sys
import os
from pathlib import Path

def start_nocturne():
    """Main application entry point"""
    try:
        print("Starting Nocturne...")
        
        import webview
        from src.api import NocturneAPI
        from src.core.config import Config
        
        print(f"Creating API...")
        api = NocturneAPI()
        
        print(f"Getting HTML path...")
        html_path = Config.get_index_html()
        print(f"HTML path: {html_path}")
        
        print(f"Creating window...")
        window = webview.create_window(
            title=f"{Config.APP_NAME} - Piano Transcription",
            url=f"file://{html_path}",
            js_api=api,
            width=1280,
            height=800,
            resizable=True,
            background_color="#121212"
        )
        
        print(f"Starting web view...")
        webview.start(debug=False)
        
    except Exception as e:
        print(f"❌ Error starting Nocturne: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def main():
    """Entry point with splash screen"""
    try:
        from src.splash import show_splash
        
        print("Showing splash screen...")
        show_splash(duration=3, callback=start_nocturne)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
        print("Falling back to direct launch...")
        start_nocturne()

if __name__ == "__main__":
    main()