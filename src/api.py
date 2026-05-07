import webview
import threading
import time
from src.core.config import APP_NAME, VERSION
from src.utils.logger import logger

class NocturneAPI:
    def __init__(self):
        self._window = None
        self.is_processing = False

    def set_window(self, window):
        self._window = window

    def get_app_info(self):
        return {
            "name": APP_NAME,
            "version": VERSION,
            "status": "Ready"
        }
    
    def select_audio(self):
        if self._window:
            logger.info("Opening file dialog...") 
            file_types = ('Audio Files (*.mp3;*.wav;*.flac)', 'All files (*.*)')
            result = self._window.create_file_dialog(
                webview.OPEN_DIALOG, 
                allow_multiple=False, 
                file_types=file_types
            )

            if result:
                logger.info(f"User selected: {result[0]}") 
                return result[0]
            else:
                logger.warning("User cancelled the file dialog.") 
                return None
        
        logger.error("Internal Error: API attempted to open dialog without a window object.")
        return None


    def start_processing(self, file_path):
        if self.is_processing:
            return {"status": "error", "message": "Already processing a file."}
        if not file_path:
            return {"status": "error", "message": "No file selected."}

        thread = threading.Thread(target=self._run_pipeline, args=(file_path,))
        thread.daemon = True
        thread.start()

        return {"status": "success", "message": "Processing started..."}

    def _run_pipeline(self, file_path):
        self.is_processing = True
        try:
            self._update_ui("Status: Extracting stems...", 10)
            time.sleep(2) 
            
            self._update_ui("Status: Transcribing notes...", 50)
            time.sleep(2)
            
            self._update_ui("Status: Arranging for piano...", 90)
            time.sleep(1)
            
            self._update_ui("Complete!", 100)
        except Exception as e:
            self._update_ui(f"Error: {str(e)}", 0)
        finally:
            self.is_processing = False

    def _update_ui(self, message, progress):
        if self._window:
            self._window.evaluate_js(f"if(window.updateProgress) {{ window.updateProgress('{message}', {progress}); }}")
