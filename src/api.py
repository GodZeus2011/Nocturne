import webview
import threading
from pathlib import Path
from mido import MidiFile, MidiTrack, Message
from src.core.config import APP_NAME, VERSION, INTERIM_DIR, OUTPUT_DIR
from src.core.models import Arrangement
from src.utils.logger import logger
from src.services.separation import SeparationService
from src.services.transcription import TranscriptionService
from src.services.arranger import HarmonyEngine, PianoArranger


class NocturneAPI:
    def __init__(self):
        self._window = None
        self.is_processing = False
        self.current_project = None
        self.current_arrangement = None
        self.processing_progress = 0
        self.processing_message = "Ready"
        self.cancel_requested = False
        
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
        
        self.cancel_requested = False
        thread = threading.Thread(target=self._run_pipeline, args=(file_path,))
        thread.daemon = True
        thread.start()
        return {"status": "success", "message": "Processing..."}

    def _update_ui(self, message, progress):
        self.processing_message = message
        self.processing_progress = progress
        
        if self._window:
            safe_message = message.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
            
            try:
                self._window.evaluate_js(
                    f"if(window.app) {{ "
                    f"window.app.updateProgress(\"{safe_message}\", {progress}); "
                    f"}}"
                )
            except Exception as e:
                logger.warning(f"Failed to update UI: {e}")

    def get_processing_status(self):
        return {
            "is_processing": self.is_processing,
            "progress": self.processing_progress,
            "message": self.processing_message
        }    
    
    def get_arrangement(self):
        if self.current_arrangement is None:
            logger.warning("get_arrangement() called but no arrangement available")
            return None
        
        arr = self.current_arrangement
        
        serialized = {
            "notes": [
                {
                    "pitch": n.pitch,
                    "start": n.start,
                    "quantized_start": n.quantized_start,
                    "quantized_duration": n.quantized_duration,
                    "velocity": n.velocity,
                    "hand": n.hand,
                    "source": n.source
                }
                for n in arr.notes
            ],
            "tempo": float(arr.tempo),
            "time_signature": arr.time_signature,
            "key": arr.key,
            "pedal_events": arr.pedal_events  
        }
        
        logger.info(f"Returning arrangement: {len(serialized['notes'])} notes")
        return serialized
    
    def export_midi(self, filename):
        if self.current_arrangement is None:
            logger.error("export_midi() called but no arrangement available")
            raise Exception("No arrangement to export. Process audio first.")
        
        try:
            output_path = OUTPUT_DIR / filename
            logger.info(f"Exporting MIDI to: {output_path}")

            mid = MidiFile()
            track = MidiTrack()
            mid.tracks.append(track)

            track.append(Message('program_change', program=0, time=0))

            arr = self.current_arrangement
            sorted_notes = sorted(arr.notes, key=lambda n: n.quantized_start)
            
            current_time = 0
            last_note_end = 0

            for note in sorted_notes:
                time_delta = note.quantized_start - current_time
                
                if time_delta < 0:
                    time_delta = 0
                
                track.append(Message('note_on', note=note.pitch, velocity=note.velocity, time=time_delta))
                
                note_duration = max(1, note.quantized_duration)
                track.append(Message('note_off', note=note.pitch, velocity=0, time=note_duration))
                
                current_time = note.quantized_start + note_duration
                last_note_end = max(last_note_end, current_time)

            for pedal_tick, pedal_value in arr.pedal_events:
                pedal_delta = max(0, pedal_tick - last_note_end)
                track.append(Message('control_change', control=64, value=pedal_value, time=pedal_delta))
                last_note_end = pedal_tick

            mid.save(str(output_path))

            logger.info(f"MIDI exported successfully: {output_path}")
            return {
                "status": "success",
                "message": f"Exported to {output_path}",
                "filepath": str(output_path)
            }
        
        except Exception as e:
            logger.error(f"MIDI export error: {e}")
            raise Exception(f"Failed to export MIDI: {str(e)}")
            
    def cancel_processing(self):
        if not self.is_processing:
            return {"status": "error", "message": "No processing in progress"}
        
        logger.warning("Processing cancellation requested by user")
        self.cancel_requested = True
        
        return {
            "status": "success",
            "message": "Cancellation requested. Processing will stop."
        }

    def _run_pipeline(self, file_path):
        self.is_processing = True
        self.current_arrangement = None
        
        try:
            workspace = self.current_project["workspace"]

            self._update_ui("Stem Separation...", 15)
            stems_path = self.separation_service.run_separation(file_path, workspace, self._update_ui)

            self._update_ui("Analyzing Rhythm...", 35)
            tempo_data = self.transcription_service.get_tempo_data(stems_path)
            self.current_project.update(tempo_data)

            all_transcribed_notes = []

            stems_to_process = [
                {"file": "bass.wav", "source": "bass", "is_bass": True},
                {"file": "vocals.wav", "source": "vocal", "is_bass": False}
            ]

            for i, stem in enumerate(stems_to_process):
                if self.cancel_requested:
                    logger.warning("Processing cancelled by user.")
                    return
                
                self._update_ui(f"Transcribing {stem['source']}...", 40 + (i * 20))
                path = stems_path / stem["file"]
                if not path.exists():
                    continue

                pitches, conf = self.transcription_service._get_raw_pitches(path, is_bass=stem["is_bass"])

                midi_seq = self.transcription_service._clean_pitch_data(pitches, conf, is_bass=stem["is_bass"])

                stem_notes = self.transcription_service._get_notes_from_sequence(midi_seq, conf, is_bass=stem["is_bass"])

                logger.info(f"Stem '{stem['source']}' produced {len(stem_notes)} notes.")
                for n in stem_notes:
                    n.source = stem["source"]
                
                all_transcribed_notes.extend(stem_notes)
            
            self._update_ui("Finalizing arrangement...", 85)

            self.current_project["key"] = self.harmony_engine.detect_key(all_transcribed_notes)

            final_notes = self.arranger.quantize_notes(
                all_transcribed_notes, 
                self.transcription_service, 
                self.current_project["beat_times"]
            )

            final_notes = self.arranger.assign_hands(final_notes)
            final_notes = self.arranger.solve_physicality(final_notes)
            final_notes = self.arranger.resolve_collisions(final_notes)
            final_notes = self.arranger.optimize_voice_leading(final_notes)
            final_notes = self.arranger._enforce_range(final_notes)
            final_notes = self.arranger.apply_density(final_notes, level="normal")
            final_notes = self.arranger.apply_styles(final_notes, style="pop")

            self._update_ui("Adding sustain pedal...", 95)

            pedal_data = self.arranger.generate_sustain_pedal(self.current_project["beat_times"])

            final_arrangement = Arrangement(
                notes=final_notes,
                tempo=self.current_project["bpm"],
                time_signature=self.current_project["time_signature"],
                key=self.current_project["key"],
                pedal_events=pedal_data
            )

            self.current_arrangement = final_arrangement
            self.current_project["arrangement"] = final_arrangement

            logger.info("--- MUSICAL AUDIT (First 500 Events) ---")
            header = f"{'TIME'.ljust(6)} | {'TICKS'.ljust(6)} | {'HAND'.ljust(4)} | {'NOTE'.ljust(5)} | {'VEL'.ljust(4)} | {'SOURCE'}"
            logger.info(header)
            logger.info("-" * len(header))
            
            for n in final_notes[:500]:
                note_name = self.arranger.midi_to_name(n.pitch)
                hand_label = "LH" if n.hand == "left" else "RH"
                logger.info(f"{str(round(n.start, 2)).ljust(6)} | {str(n.quantized_start).ljust(6)} | {hand_label.ljust(4)} | {note_name.ljust(5)} | {str(n.velocity).ljust(4)} | {n.source}")
            
            logger.info("-" * len(header))
            logger.info(f"Final Arrangement Created: {len(final_notes)} notes, {len(pedal_data)} pedal events.")

            self._update_ui(f"Success! Arrangement Complete (Key: {final_arrangement.key})", 100)

        except Exception as e:
            logger.error(f"Pipeline Error: {e}")
            self._update_ui(f"Error: {str(e)}", 0)
        finally:
            self.is_processing = False

    