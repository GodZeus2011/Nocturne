# Nocturne

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


## Stage 2: Audio Intelligence

Transform raw, mixed audio into clean, separated files ready for transcription.

### Implementations:

+ **Stem Separation:** Added the `htdemucs` model to separate the audio file. This splits the audio into - Vocals, Bass, Drums, and Other (Piano/Guitar/etc).

+ **Hardware Support:** Checks the machine for NIVIDIA CUDA support.
    - **High Performance:** Uses GPU (CUDA) for fast processing.
    - **Default:** Uses CPU processing for standard machines without CUDA.

+ **Workspaces:** Every song is treated as a unique project. The system handles the files and creates isolated directories in (`data/interim`) to avoid data collisions.

+ **Pre-Processing:** Digital Signal Processing (DSP) layer using `Librosa` and `NumPy` to clean AI outputs:
    - **Peak Normalization:** Scales audio to 1.0 amplitude to ensure maximum accuracy for pitch detection.

+ **FFmpeg Shared-Library:**  Bundled full-shared FFmpeg binaries and DLLs within the app, so you don't need to install external dependencies.

## Stage 3: Rhythm

This program translates raw timestamps (seconds) into musical positions (measures/beats), allowing for quantization.

+ **Dynamic Beat Tracking:** Uses `Librosa` to analyze onset envelopes and transients. The system has a prioritized fallback logic (Drums -> Other) to ensure a stable tempo is found even in acoustic or vocal-heavy tracks.

+ **Tempo Mapping:** Nocturne builds a local tempo map using linear interpolation between beats. This allows the program to follow "Human Tempo" altering the grid to stay in sync with the performer.

+ **Quantization Matrix:** Created a High detail MIDI grid (480 ticks per quarter).
    - Added a 120 tick snap to grid function for 1/16th notes.
    - Added duration logic to prevent "zero-length" notes during the snapping process.

+ **Meter Detection:** Detects time signature using correlation of onset strength. By comparing the patterns across different intervals, the function automatically chooses between standard time and waltz meters. 