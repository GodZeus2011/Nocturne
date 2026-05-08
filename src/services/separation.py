import torch
import subprocess
import sys 
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

                result = subprocess.run(cmd,  check=True)

                logger.info("Demucs finished successfully.")

                expected_folder = output_root / "htdemucs" / input_path.stem
                return expected_folder
        except subprocess.CalledProcessError as e:
            logger.error(f"Demucs AI Error: {e.stderr}")
            raise Exception("AI separation failed. Make sure you have enough RAM/Disk space.")