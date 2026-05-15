import webview
import threading
import time
import numpy as np
from pathlib import Path
from src.core.config import APP_NAME, VERSION, INTERIM_DIR
from src.utils.logger import logger
from src.services.separation import SeparationService
from src.services.transcription import TranscriptionService
from src.services.arranger import HarmonyEngine, PianoArranger

class NocturneAPI:
    def __init__(self):
        self._window = None
        self.is_processing = False
        self.current_project = None
        
        self.separation_service = SeparationService()
        self.transcription_service = TranscriptionService()
        self.harmony_engine = HarmonyEngine()
        self.arranger = PianoArranger()

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

            self._update_ui("AI Stem Separation...", 10)
            stems_path = self.separation_service.run_separation(file_path, workspace, self._update_ui)

            self._update_ui("Analyzing Rhythm...", 30)
            tempo_data = self.transcription_service.get_tempo_data(stems_path)
            self.current_project.update(tempo_data)

            all_transcribed_notes = []

            stems_to_process = [
                {"file": "bass.wav", "source": "bass", "is_bass": True},
                {"file": "vocals.wav", "source": "vocal", "is_bass": False}
            ]

            for i, stem in enumerate(stems_to_process):
                self._update_ui(f"Transcribing {stem['source']}...", 40 + (i * 20))
                
                path = stems_path / stem["file"]
                if not path.exists(): continue

                pitches, conf = self.transcription_service._get_raw_pitches(path, is_bass=stem["is_bass"])

                max_conf = np.max(conf)
                logger.info(f"DEBUG: Stem {stem['source']} | Max Confidence: {max_conf:.2f}")

                midi_seq = self.transcription_service._clean_pitch_data(pitches, conf, is_bass=stem["is_bass"])
                
                stem_notes = self.transcription_service._get_notes_from_sequence(midi_seq, is_bass=stem["is_bass"])

                logger.info(f"Stem {stem['source']} produced {len(stem_notes)} notes.")

                for n in stem_notes:
                    n.source = stem["source"]
                
                all_transcribed_notes.extend(stem_notes)
            
            self._update_ui("Finalizing arrangement...", 90)

            self.current_project["key"] = self.harmony_engine.detect_key(all_transcribed_notes)

            final_notes = self.arranger.assign_hands(all_transcribed_notes)

            final_notes = self.arranger.solve_physicality(final_notes)

            final_notes = self.arranger.optimize_voice_leading(final_notes)

            final_notes = self.arranger.optimize_voice_leading(final_notes)

            final_notes = self.arranger.apply_density(final_notes, level="hard")

            self.current_project["notes"] = final_notes

            lh_count = len([n for n in final_notes if n.hand == "left"])
            rh_count = len([n for n in final_notes if n.hand == "right"])

            logger.info(f"Arrangement Success! LH: {lh_count} notes | RH: {rh_count} notes")
            self._update_ui(f"Success! Key: {self.current_project['key']}", 100)

        except Exception as e:
            logger.error(f"Pipeline Error: {e}")
            self._update_ui(f"Error: {str(e)}", 0)
        finally:
            self.is_processing = False