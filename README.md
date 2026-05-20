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

### Implementations:

+ **Dynamic Beat Tracking:** Uses `Librosa` to analyze onset envelopes and transients. The system has a prioritized fallback logic (Drums -> Other) to ensure a stable tempo is found even in acoustic or vocal-heavy tracks.

+ **Tempo Mapping:** Nocturne builds a local tempo map using linear interpolation between beats. This allows the program to follow "Human Tempo" altering the grid to stay in sync with the performer.

+ **Quantization Matrix:** Created a High detail MIDI grid (480 ticks per quarter).
    - Added a 120 tick snap to grid function for 1/16th notes.
    - Added duration logic to prevent "zero-length" notes during the snapping process.

+ **Meter Detection:** Detects time signature using correlation of onset strength. By comparing the patterns across different intervals, the function automatically chooses between standard time and waltz meters. 

## Stage 4: Pitch Tracking

This stage is the core of Nocturne, It converts the raw audio signals into musical notes stored in python objects.

### Implementations:

+ **Pitch Tracking:** Integrated the **CREPE** (Convolutional Representation for Pitch Estimation) model. By analyzing the audio at a 100 samples per second, the system creates a detailed trascription from raw audio to musical notes.

+ **MIDI Mapping:** The main musical conversion.
    - Formula: $f_{MIDI} = 69 + 12 \times \log_2(\frac{Hz}{440})$
    - This allows the software to map frequencies to the 88 keys of a standard piano.

+ **Smoothing:** The AI pitch tracking is naturally jittery. I implemented a **Median Filter** (`scipy.signal.medfilt`) to smooth out errors.

+ **Note Slicer:** Coded an algorithm to slice a stream of continuous pitch data into discrete musical events. It identifies notes based on pitch stability and duration thresholds.

## Stage 5: Harmony Engine

This stage uses music theory to analyze the relation between transcribed notes, identifying chords, and the tone.

### Implementations:

+ **Interval Vectors:** Implemented an analysis tool that calculates the interval profile of any note cluster. By counting the 6 interval classes, the system can mathematically identify a chord (e.g., Major, Minor, or Dominant).

+ **Root Finder (Parncutt’s Algorithm):** Used Parncutt's algorithm to create a weighting system that assigns points to notes based on interval stability. This allows the system to identify the root of a chord even if its played in an inverted form.

+ **Key Detection:** Integrated the Krumhansl-Schmuckler (K-S) algorithm to detect the song's global key. This algorithm uses duration weighted pitch histograms compared against 24 Major/Minor key profiles. `MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]`
`MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]`

+ **Chord Labeling** Translates Notes using detected Root and Interval Vector into human-readable strings (e.g., "Am7", "G Major").

## Stage 6: Arranger

Converts AI generated data into a physically playable performance. It enforces constraints to transform the raw notes into an arranged piece.

### Implementations:

+ **Hand Assignment:**  Uses a logic system to assign notes to the Left Hand (LH) or Right Hand (RH).
    - **Source:** Bass stem -> LH, Vocal stem -> RH.
    - **Frequency:** Automatic fallback at MIDI 55 (G2) for "Other" instruments.

+ **Physical Constraint:** Enforces limits for playability.
    - **Span:** Detects chords wider than 12 semitones and re-assigns the lowest notes to the opposite hand to prevent impossible reaches.
    - **Merging:** Combines AI "stutters" into sustained notes using merging.

+ **Arrangement Optimizer:** A greedy algorithm that tracks the "center of gravity" for each hand. It shifts chords into the optimal octave to minimize large, unplayable jumps between notes.

+ **Density & Difficulty:** Provides scaling of the arrangement:
    - **Easy:** Single-note reduction for beginners.
    - **Normal:** Default transcription.
    - **Hard:** Difficult arrangement with the melody doubled.

## Stage 7: Final Arrangment

This is the Final step where the arrangement is brought together.

### Implementations:

+ **Sustain Pedal:** Created a MIDI generator that mimics a sustain pedal.

+ **Pop Style:** Adds rhythmic comping for the Left Hand.

+ **Jazz Style:** Automatically adds harmonic blues to detected chords.


## Stage 8: Arrangment Visuals

This is where the arrangement is displayed in a slick minimal dashboard.

### Implementations:

+ **Piano Roll** - 88-key interactive visualization with real-time playhead, zoom/pan controls, and note rendering by hand assignment.

+ **Playback Engine** - play/pause/stop controls, tempo multiplier (0.5x-2.0x), time display (MM:SS), and progress tracking.

+ **Progress System** - Real-time animated progress bar, timestamped log entries organized by processing phase (Separation/Transcription/Arrangement/Complete) with color-coded levels.

+ **Draggable UI Controls** - Floating control bar with smooth repositioning.

