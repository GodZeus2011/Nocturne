import sys
import webview
from pathlib import Path
from src.api import NocturneAPI
from src.core.config import Config

def start_nocturne():
    """Main application entry point"""
    
    
    api = NocturneAPI()
    
    html_path = Path(__file__).parent.parent / "web" / "index.html"
    
    window = webview.create_window(
        title="Nocturne - Piano Transcription",
        url=str(html_path),
        js_api=api,
        width=1280,
        height=800,
        resizable=True,
        background_color="#121212"
    )
    
    webview.start(debug=False)

def main():
    """Entry point with splash screen"""
    try:
        from src.splash import show_splash
        
        show_splash(duration=3, callback=start_nocturne)
        
    except Exception as e:
        print(f"Error: {e}")
        start_nocturne()

if __name__ == "__main__":
    main()