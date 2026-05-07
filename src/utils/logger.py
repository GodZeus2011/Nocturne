import logging
import sys
from pathlib import Path
from colorama import init, Fore, Style
from src.core.config import DATA_DIR, DEBUG

init(autoreset=True)

class NocturneFormatter(logging.Formatter):
    FORMAT = "%(asctime)s | %(levelname)-8s | %(message)s"
    
    LEVEL_COLORS = {
        logging.DEBUG: Fore.CYAN,
        logging.INFO: Fore.GREEN,
        logging.WARNING: Fore.YELLOW,
        logging.ERROR: Fore.RED,
        logging.CRITICAL: Fore.MAGENTA + Style.BRIGHT,
    }

    def format(self, record):
        color = self.LEVEL_COLORS.get(record.levelno, Fore.WHITE)
        log_fmt = f"{Fore.WHITE}%(asctime)s{Style.RESET_ALL} | {color}%(levelname)-8s{Style.RESET_ALL} | %(message)s"
        formatter = logging.Formatter(log_fmt, datefmt="%H:%M:%S")
        return formatter.format(record)

def setup_logger():
    logger = logging.getLogger("Nocturne")
    logger.setLevel(logging.DEBUG if DEBUG else logging.INFO)

    if logger.hasHandlers():
        return logger

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(NocturneFormatter())
    logger.addHandler(console_handler)

    log_file = DATA_DIR / "nocturne.log"
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    file_handler.setFormatter(file_fmt)
    logger.addHandler(file_handler)

    return logger

logger = setup_logger()