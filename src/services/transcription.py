import librosa
import numpy as np
import torch
import torchcrepe 
from pathlib import Path
from src.utils.logger import logger
from scipy.signal import medfilt
from src.core.models import Note

class TranscriptionService:
    def get_tempo_data(self, stems_folder):
        DRUMS_PATH = stems_folder / "drums.wav"
        OTHER_PATH = stems_folder / "other.wav"
        TEMPO_PATH = DRUMS_PATH if DRUMS_PATH.exists() else OTHER_PATH

        audio, sr = librosa.load(TEMPO_PATH, sr=None, mono=True)
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
        
        logger.info(f"Detected Tempo: {final_bpm:.2f} BPM")
        time_sig = self.detect_meter(audio, sr, beat_times)
        logger.info(f"Detected Meter: {time_sig}")

        return {
            "bpm": final_bpm,
            "beat_times": beat_times.tolist(),
            "time_signature": time_sig
        }
    
    def time2ticks(self, timestamp, beat_times):
        beat_index = np.searchsorted(beat_times, timestamp, side='right') - 1

        if beat_index < 0: beat_index = 0
        if beat_index >= len(beat_times) - 1: beat_index = len(beat_times) - 2

        start = beat_times[beat_index]
        end = beat_times[beat_index + 1]
        interval_duration = max(end - start, 0.001) 
        progress = (timestamp - start) / interval_duration

        ticks_per_beat = 480
        total_ticks = (beat_index * ticks_per_beat) + (progress * ticks_per_beat)

        return int(total_ticks)
    
    def quantize(self, ticks, resolution=120):
        return int(round(ticks / resolution) * resolution)
    
    def quantize_note(self, start_ticks, end_ticks):
        q_start = self.quantize(start_ticks)
        q_end = self.quantize(end_ticks)

        if q_end <= q_start:
            q_end = q_start + 120

        return q_start, q_end
    
    def detect_meter(self, audio, sr, beat_times):
        try:
            onset_env = librosa.onset.onset_strength(y=audio, sr=sr)
            beat_frames = np.clip(librosa.time_to_frames(beat_times, sr=sr), 0, len(onset_env) - 1)
            beat_strengths = onset_env[beat_frames]

            score_4_4 = np.mean(beat_strengths[::4])
            score_3_4 = np.mean(beat_strengths[::3])

            if score_3_4 > score_4_4 * 1.2:
                return "3/4"
            return "4/4"
        
        except Exception as e:
            logger.warning(f"Meter detection failed: {e}")
            return "4/4"
    
    def _get_raw_pitches(self, audio_path, is_bass=False):
        audio, sr = librosa.load(audio_path, sr=16000, mono=True)
                
        audio = audio.astype(np.float32)
        max_amp = np.max(np.abs(audio))
        if max_amp > 0:
            audio = audio / max_amp

        audio_tensor = torch.from_numpy(audio.copy()).unsqueeze(0)

        model_size = 'tiny'

        hop = 320 if is_bass else 160

        fmin = 40 if is_bass else 50
        fmax = 300 if is_bass else 2000

        logger.info(f"AI ({model_size}) is analyzing {audio_path.name}...")

        pitch, periodicity = torchcrepe.predict(
            audio_tensor,
            sample_rate=16000,
            hop_length=hop,
            fmin=fmin,
            fmax=fmax,
            model=model_size, 
            device='cpu',
            batch_size=1024, 
            return_periodicity=True
        )
            
        return pitch.squeeze().numpy(), periodicity.squeeze().numpy()

    def _pitch_to_midi(self, hz):
        if hz <= 0: return 0
        midi_num = 12 * np.log2(hz / 440.0) + 69

        return int(round(midi_num))

    def _clean_pitch_data(self, pitches, periodicities, is_bass=False):
        clean_midi = []

        threshold = -20.0 if is_bass else -5.0

        for p, c in zip(pitches, periodicities):
            is_silent = np.isinf(c) or np.isnan(c) or p <= 0
            is_confident = False if is_silent else ((c < threshold) if c < 0 else (c > 0.5))

            if not is_confident:
                clean_midi.append(0)
            else:
                midi = self._pitch_to_midi(p)
                clean_midi.append(midi if 21 <= midi <= 108 else 0)

        return np.array(clean_midi)
    
    def _get_notes_from_sequence(self, midi_sequence, confidence_sequence, is_bass=False):
        smoothed_midi = medfilt(midi_sequence, kernel_size=5)

        notes = []
        current_pitch = 0
        start_frame = 0

        min_duration = 0.02 if is_bass else 0.05

        for i, pitch in enumerate(smoothed_midi):
            if pitch != current_pitch:
                if current_pitch != 0:
                    duration = (i - start_frame) * 0.01 
                    if duration > min_duration:
                        note_conf = np.mean(confidence_sequence[start_frame:i])
                        velocity = int(40 + (max(0, note_conf) * 70))
                        
                        notes.append(Note(
                            pitch=int(current_pitch),
                            start=start_frame * 0.01,
                            duration=duration,
                            velocity=min(velocity, 127) 
                        ))
                start_frame = i
                current_pitch = pitch
        return notes