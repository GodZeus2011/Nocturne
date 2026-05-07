#Nocturne

Nocturne is an open-source Windows desktop application designed to convert raw audio files into high-quality, physically playable piano arrangements. It combines AI stem separation with a custom Mathematical Engine to create the final arrangement.

## Stage 1: Foundation & Initialization

This is the basics, focused on creating a reliable foundation for the rest of the app to built on.

### Implementations:

+ **Custom Path Architecture:** Implemented a global configuration system (`src/core/config.py`) that uses `_MEIPASS` path logic for Pyinstaller. This allows the app to resolve its own internal assets, so the app functions as a single EXE file.
+ **Async Bridge API:** Created a `NocturneAPI` class using `pywebview`. This is used for reliable communication between the frontend and the backend Python, allowing JS to trigger heavy AI tasks without affecting the UI.
+ **Logging:** Built a custom logging utility (`src/utils/logger.py`) with: 
    - **Colored Terminal Output:** Level-based coloring (Green for INFO, Red for ERROR) using `colorama`.
    - **File Logging:** Automatically generates a `nocturne.log` in the user's data directory for debugging.
+ **Music Models:** Defines the musical theory terms using Python dataclasses for easy use (`src/core/models.py`). 
    - `Note`: Tracks pitch (MIDI), micro-timing, velocity, and hand.
    - `Chord`: Stores harmonic groups of notes (chords) -> support for future root detection and labels.
    - `Arrangement`: Manages global song metadata like tempo, key, and meter.