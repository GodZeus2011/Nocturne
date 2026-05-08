import torch
import subprocess
import sys 
import librosa
import soundfile as sf
import numpy as np
from pathlib import Path
from src.utils.logger import logger

class SeperationService:
    def __init__(self):
        self.device = self._get_device()
        logger.info(f'Separation Serive intialized using: {self.device.upper()}')

    def _get_device(self):
        if torch.cuda.is_available():
            return "cuda"
        return "cpu"
    
    def run_seperation(self, input_path, output_root, progress_callback=None):
        input_path = Path(input_path)
        output_root = Path(output_root)

        logger.info(f"Starting AI separation for: {input_path.name}")

        cmd = [
            sys.executable, "-m", "demucs.separate",
            "-n", "htdemucs",
            "--out", str(output_root),
            "--device", self.device,
            str(input_path)
        ]

        try: 
            if progress_callback:
                progress_callback("AI is unmixing your song...", 20)

            subprocess.run(cmd,  check=True)
            logger.info("Demucs finished successfully.")

            expected_folder = output_root / "htdemucs" / input_path.stem

            if progress_callback:
                progress_callback("Cleaning audio signals...", 35)
            self._post_process_stems(expected_folder)

            return expected_folder
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Demucs AI Error: {e.stderr}")
            raise Exception("AI separation failed. Make sure you have enough RAM/Disk space.")
    
    def _post_process_stems(self, stems_folder):
        wanted_files = ["bass.wav", "other.wav"]

        for file_name in wanted_files:
            stem_path = stems_folder / file_name

            if stem_path.exists():
                logger.info(f"Cleaning: {file_name}")

                audio, sr = librosa.load(stem_path, sr=None)

                max_val = np.max(np.abs(audio))
                if max_val > 0:
                    audio = audio / max_val

                audio_trimmed, _ = librosa.effects.trim(audio, top_db=30)

                sf.write(stem_path, audio_trimmed, sr)
        logger.info("Signal Prep complete")