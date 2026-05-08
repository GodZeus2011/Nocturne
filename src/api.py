import webview
import threading
import time
from pathlib import Path
from src.core.config import APP_NAME, VERSION, INTERIM_DIR
from src.utils.logger import logger
from src.services.separation import SeperationService
from src.services.transcription import TranscriptionService

class NocturneAPI:
    def __init__(self):
        self._window = None
        self.is_processing = False
        self.current_project = None
        self.separation_service = SeperationService()
        self.transcription_service = TranscriptionService()

    def set_window(self, window):
        self._window = window

    def select_audio(self):
            if not self._window:
                return None

            file_types = ('Audio Files (*.mp3;*.wav;*.flac;*.m4a)', 'All files (*.*)')
            result = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)

            if not result:
                logger.warning("User cancelled file selection.")
                return None
            
            raw_path = result[0]
            return self._prepare_workspace(raw_path)
    
    def _prepare_workspace(self, raw_path):
        path = Path(raw_path)

        valid_extensions = ['.mp3', '.wav', '.flac', '.m4a']
        if path.suffix.lower() not in valid_extensions:
            logger.error(f"Unsupported file type: {path.suffix}")
            return {"status": "error", "message": "Unsupported file format."}
        
        if not path.exists():
            logger.error(f"File not found: {path.suffix}")
            return {"status": "error", "message": "File no longer exists."}
        
        song_folder = INTERIM_DIR / path.stem
        song_folder.mkdir(parents=True, exist_ok=True)

        self.current_project = {
            "input_path": str(path),
            "workspace": str(song_folder),
            "song_name": path.stem
        }

        logger.info(f"Workspace prepared: {song_folder}")

        return str(path)

    def get_app_info(self):
        return {
            "name": APP_NAME,
            "version": VERSION,
            "status": "Ready"
        }

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
            workspace = self.current_project["workspace"]

            self._update_ui("AI Separation: Unmixing audio...", 20)

            stems_path = self.separation_service.run_seperation(
                file_path,
                workspace,
                progress_callback=self._update_ui
            )

            logger.info(f"Stems are located at: {stems_path}")
            
            self._update_ui("Analyzing rhythm and tempo...", 50)

            tempo_data = self.transcription_service.get_tempo_data(stems_path)

            self.current_project["bpm"] = tempo_data["bpm"]
            self.current_project["beat_times"] = tempo_data["beat_times"]

            logger.info(f"Rhythm Analysis Complete: {tempo_data['bpm']:.2f} BPM")
            self._update_ui(f"Tempo Detected: {int(tempo_data['bpm'])} BPM", 60)

        except Exception as e:
            logger.error(f"Pipeline Error: {e}")
            self._update_ui(f"Error: {str(e)}", 0)
        finally:
            self.is_processing = False

    def _update_ui(self, message, progress):
        if self._window:
            self._window.evaluate_js(f"if(window.updateProgress) {{ window.updateProgress('{message}', {progress}); }}")
