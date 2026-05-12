import librosa
import numpy as np
from pathlib import Path
from src.utils.logger import logger
import torch
import torchcrepe  

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

        if len(beat_times) > 0:
            first_beat = beat_times[0]
            beat_duration = 60 / final_bpm
            pre_beats = np.arange(first_beat - beat_duration, -beat_duration, -beat_duration)
            pre_beats = np.sort(pre_beats)
            beat_times = np.concatenate([pre_beats, beat_times])
            
            if len(beat_times) > 0 and abs(beat_times[0]) < 0.2:
                beat_times[0] = 0.0
        
        logger.info(f"Detected Tempo: {final_bpm} BPM")

        time_sig = self.detect_meter(audio, sr, beat_times)
        logger.info(f"Detected Meter: {time_sig}")

        return {
            "bpm": final_bpm,
            "beat_times": beat_times.tolist(),
            "time_signature": time_sig
        }
    
    def time2ticks(self, timestamp, beat_times):
        beat_index = np.searchsorted(beat_times, timestamp, side='right') - 1

        if beat_index < 0:
            beat_index = 0
        if beat_index >= len(beat_times) - 1:
            beat_index = len(beat_times) - 2

        start = beat_times[beat_index]
        end = beat_times[beat_index + 1]

        interval_duration = max(end - start, 0.001) 
        progress = (timestamp - start) / interval_duration

        ticks_per_beat = 480
        total_ticks = (beat_index * ticks_per_beat) + (progress * ticks_per_beat)

        return int(total_ticks)
    
    def quantize(self, ticks, resolution=120):
        snapped = round(ticks/resolution) * resolution
        return snapped
    
    def quantize_note(self, start_ticks, end_ticks):
        q_start = self.quantize(start_ticks)
        q_end = self.quantize(end_ticks)

        if q_end <= q_start:
            q_end = q_start + 120
        
        return q_start, q_end
    
    def detect_meter(self, audio, sr, beat_times):
        try:
            onset_env = librosa.onset.onset_strength(y=audio, sr=sr)

            beat_frames = librosa.time_to_frames(beat_times, sr=sr)

            beat_frames = np.clip(beat_frames, 0, len(onset_env) - 1)
            beat_strengths = onset_env[beat_frames]

            score_4_4 = np.mean(beat_strengths[::4])
            score_3_4 = np.mean(beat_strengths[::3])

            logger.info(f"Meter Analysis -> 4/4 Score: {score_4_4:.2f}, 3/4 Score: {score_3_4:.2f}")

            if score_3_4 > score_4_4 * 1.2:
                return "3/4"
            return "4/4"
        
        except Exception as e:
            logger.warning(f"Meter detection failed, defaulting to 4/4. Error: {e}")
            return "4/4"
    
    def _get_raw_pitches(self, audio_path, is_bass=False):
        logger.info(f"Running AI Pitch Tracking on: {audio_path.name}")

        audio, sr = librosa.load(audio_path, sr=16000)
        
        audio_tensor = torch.from_numpy(audio).unsqueeze(0)
        
        fmin = 30 if is_bass else 50
        fmax = 300 if is_bass else 2000

        pitch, periodicity = torchcrepe.predict(
            audio_tensor,
            sample_rate=16000,
            hop_length=160,
            fmin=fmin,
            fmax=fmax,
            model='tiny',
            device='cpu',
            batch_size=2048,
            return_periodicity=True
        )

        return pitch.squeeze().numpy(), periodicity.squeeze().numpy()

