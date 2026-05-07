import sys
import os
from pathlib import Path

IS_FROZEN = getattr(sys, 'frozen', False)

if IS_FROZEN:
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent.parent.parent

WEB_DIR = BASE_DIR / "web"
ASSETS_DIR = BASE_DIR / "assets"

if IS_FROZEN:
    EXECUTABLE_DIR = Path(sys.executable).parent
    DATA_DIR = EXECUTABLE_DIR / "data"
else:
    DATA_DIR = BASE_DIR / "data"

INTERIM_DIR = DATA_DIR / "interim"
OUTPUT_DIR = DATA_DIR / "output"

INTERIM_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

APP_NAME = "Nocturne"
VERSION = "0.1.0"
DEBUG = True 