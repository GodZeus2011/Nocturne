import webview
import threading
import time
import numpy as np
from pathlib import Path
from src.core.config import APP_NAME, VERSION, INTERIM_DIR
from src.utils.logger import logger
from src.services.separation import SeparationService
from src.services.transcription import TranscriptionService

class NocturneAPI:
    def __init__(self):
        self._window = None
        self.is_processing = False
        self.current_project = None
        
        self.separation_service = SeparationService()
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
            logger.error(f"Unsupported format: {path.suffix}")
            return {"status": "error", "message": "Unsupported format."}
        
        if not path.exists():
            logger.error("File no longer exists at that path.")
            return {"status": "error", "message": "File not found."}
        
        song_folder = INTERIM_DIR / path.stem
        song_folder.mkdir(parents=True, exist_ok=True)

        self.current_project = {
            "input_path": str(path),
            "workspace": str(song_folder),
            "song_name": path.stem,
            "notes": []
        }

        logger.info(f"Workspace ready at: {song_folder}")
        return str(path)

    def get_app_info(self):
        return {
            "name": APP_NAME,
            "version": VERSION,
            "status": "Ready"
        }

    def start_processing(self, file_path):
        if self.is_processing:
            return {"status": "error", "message": "Process already running."}
        
        thread = threading.Thread(target=self._run_pipeline, args=(file_path,))
        thread.daemon = True
        thread.start()
        return {"status": "success", "message": "Processing..."}

    def _update_ui(self, message, progress):
        if self._window:
            self._window.evaluate_js(f"if(window.updateProgress) {{ window.updateProgress('{message}', {progress}); }}")

    def _run_pipeline(self, file_path):
        self.is_processing = True
        try:
            workspace = self.current_project["workspace"]

            self._update_ui("AI Separation: unmixing audio...", 10)
            stems_path = self.separation_service.run_separation(
                file_path, workspace, progress_callback=self._update_ui
            )

            self._update_ui("Analyzing rhythm and tempo...", 45)
            tempo_data = self.transcription_service.get_tempo_data(stems_path)

            self.current_project.update(tempo_data)
            logger.info(f"Rhythm: {tempo_data['bpm']:.2f} BPM | {tempo_data['time_signature']}")

            self._update_ui("AI Transcription: Extracting melody...", 60)
            melody_wav = stems_path / "vocals.wav"

            pitches, confidence = self.transcription_service._get_raw_pitches(melody_wav, is_bass=False)

            max_conf = np.max(confidence)
            logger.info(f"AI Pitch Tracking Peak Confidence: {max_conf:.2f}")

            self._update_ui("AI Transcription: Cleaning notes...", 80)
            midi_sequence = self.transcription_service._clean_pitch_data(pitches, confidence)

            self._update_ui("AI Transcription: Slicing into piano keys...", 90)
            final_notes = self.transcription_service._get_notes_from_sequence(midi_sequence)

            for i, note in enumerate(final_notes[:10]):
                logger.info(f"Note {i+1}: Pitch={note.pitch} | Start={note.start:.2f}s | Duration={note.duration:.2f}s")

            self.current_project["notes"] = final_notes
            logger.info(f"Transcription Complete: Found {len(final_notes)} notes.")

            if len(final_notes) > 0:
                first = final_notes[0]
                logger.info(f"Sample Note: Pitch {first.pitch} at {first.start:.2f}s")
                self._update_ui(f"Success! Found {len(final_notes)} notes.", 100)
            else:
                self._update_ui("Process complete, but no notes were detected.", 100)

        except Exception as e:
            logger.error(f"Pipeline Error: {e}")
            self._update_ui(f"Error: {str(e)}", 0)
        finally:
            self.is_processing = False