import librosa
import numpy as np
from pathlib import Path
from src.utils.logger import logger

class TranscriptionService:
    def get_tempo_data(self, stems_folder):
        DRUMS_PATH = stems_folder / "drums.wav"
        OTHER_PATH = stems_folder / "other.wav"

        TEMPO_PATH = DRUMS_PATH if DRUMS_PATH.exists() else OTHER_PATH

        audio, sr = librosa.load(TEMPO_PATH, sr=None)

        tempo, beat_frames = librosa.beat.beat_track(y=audio, sr=sr)

        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        final_bpm = float(tempo[0])
        while final_bpm >= 150:
            final_bpm /= 2

        logger.info(f"Detected Tempo: {final_bpm} BPM")

        return {
            "bpm": final_bpm,
            "beat_times": beat_times.tolist()
        }