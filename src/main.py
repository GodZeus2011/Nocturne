import webview
import warnings
from src.core.config import WEB_DIR, APP_NAME, DEBUG
from src.api import NocturneAPI
from src.core.models import Note

warnings.filterwarnings("ignore", category=UserWarning)

def main():
    api = NocturneAPI()

    window = webview.create_window(
        title=APP_NAME,
        url=str(WEB_DIR / "index.html"),
        js_api=api,
        width=1000,
        height=700,
        resizable=True,
        background_color='#1a1a1a'
    )

    api.set_window(window)

    webview.start(debug=DEBUG)

if __name__ == "__main__":
    main()