const PPQ = 480;

class PlaybackEngine {
    constructor() {
        this.arrangement = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.tempoMultiplier = 1.0;
        this.pauseTick = 0;
        this.startTime = 0;
        this.volume = 0.7;

        this.animationFrame = null;
        this.onTickUpdate = null;
        this.onPlaybackEnd = null;

        this.setupPlaybackControls();
        this.setupTimelineControls();
        this.startUIUpdateLoop();
    }

    setupPlaybackControls() {
        try {
            const playBtn = document.getElementById('playBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            const stopBtn = document.getElementById('stopBtn');
            const volumeSlider = document.getElementById('volumeSlider');
            const tempoSlider = document.getElementById('tempoSlider');
            const tempoValueLabel = document.getElementById('tempoValueLabel');

            if (playBtn) {
                playBtn.addEventListener('click', () => this.play());
            }

            if (pauseBtn) {
                pauseBtn.addEventListener('click', () => this.pause());
            }

            if (stopBtn) {
                stopBtn.addEventListener('click', () => this.stop());
            }

            if (volumeSlider) {
                volumeSlider.addEventListener('input', (e) => {
                    this.setVolume(parseFloat(e.target.value));
                });
            }

            if (tempoSlider) {
                tempoSlider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.setTempo(value);
                    if (tempoValueLabel) {
                        tempoValueLabel.textContent = value.toFixed(1) + 'x';
                    }
                });
            }
        } catch (e) {
            console.error("Error setting up playback controls:", e);
        }
    }

    setupTimelineControls() {
        try {
            const canvas = document.getElementById('pianoRollCanvas');
            if (!canvas) return;

            canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        } catch (e) {
            console.error("Error setting up timeline controls:", e);
        }
    }

    startUIUpdateLoop() {
        setInterval(() => {
            this.updateTimeDisplay();
        }, 100);
    }

    loadArrangement(arr) {
        if (!arr || !arr.notes) {
            console.warn("Invalid arrangement provided");
            return;
        }

        this.stop();
        this.arrangement = arr;
        this.pauseTick = 0;
        
        this.updatePlaybackButtonStates();
        this.updateTotalTimeDisplay();
        
        console.log(`Arrangement loaded: ${arr.notes.length} notes at ${arr.tempo} BPM`);
    }

    setVolume(v) {
        v = Math.max(0, Math.min(1, v));
        this.volume = v;
    }

    setTempo(mult) {
        mult = Math.max(0.5, Math.min(2.0, mult));
        this.tempoMultiplier = mult;
    }

    play() {
        if (!this.arrangement) {
            console.warn("No arrangement loaded");
            return;
        }

        this.isPlaying = true;
        this.isPaused = false;
        this.startTime = performance.now() / 1000;
        
        this.startAnimationLoop();
        this.updatePlaybackButtonStates();
        
        console.log("Playback started (visualization only)");
    }

    pause() {
        if (!this.isPlaying) return;

        this.pauseTick = this.getCurrentTick();
        this.isPlaying = false;
        this.isPaused = true;
        
        this.cancelAnimation();
        this.updatePlaybackButtonStates();
        
        console.log("Playback paused");
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.pauseTick = 0;
        
        this.cancelAnimation();
        this.updatePlaybackButtonStates();
        this.updateTimeDisplay();
        
        console.log("Playback stopped");
    }

    cancelAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    getTicksPerSecond() {
        if (!this.arrangement) return 0;
        return (this.arrangement.tempo / 60) * PPQ * this.tempoMultiplier;
    }

    getCurrentTick() {
        if (!this.arrangement) return 0;

        const elapsed = (performance.now() / 1000) - this.startTime;
        const currentTick = this.pauseTick + elapsed * this.getTicksPerSecond();
        
        return currentTick;
    }

    startAnimationLoop() {
        const loop = () => {
            if (!this.isPlaying) {
                return;
            }

            const tick = this.getCurrentTick();

            if (this.onTickUpdate) {
                try {
                    this.onTickUpdate(tick);
                } catch (e) {
                    console.error("Error in tick update callback:", e);
                }
            }

            if (window.pianoRoll) {
                window.pianoRoll.setPlayheadPos(tick);
            }

            const totalDuration = this.getTotalDuration();
            if (totalDuration > 0 && tick >= totalDuration) {
                this.stop();
                if (this.onPlaybackEnd) {
                    try {
                        this.onPlaybackEnd();
                    } catch (e) {
                        console.error("Error in playback end callback:", e);
                    }
                }
                return;
            }

            this.animationFrame = requestAnimationFrame(loop);
        };

        this.animationFrame = requestAnimationFrame(loop);
    }

    getTotalDuration() {
        if (!this.arrangement || !this.arrangement.notes) {
            return 0;
        }

        let maxTick = 0;
        for (const note of this.arrangement.notes) {
            const endTick = note.quantized_start + note.quantized_duration;
            maxTick = Math.max(maxTick, endTick);
        }
        
        return maxTick;
    }

    updatePlaybackButtonStates() {
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const stopBtn = document.getElementById('stopBtn');

        if (playBtn) {
            playBtn.disabled = !this.arrangement;
            playBtn.classList.toggle('hidden', this.isPlaying);
        }

        if (pauseBtn) {
            pauseBtn.disabled = !this.isPlaying;
            pauseBtn.classList.toggle('hidden', !this.isPlaying);
        }

        if (stopBtn) {
            stopBtn.disabled = !this.isPlaying && !this.isPaused;
        }
    }

    updateTimeDisplay() {
        const currentTimeEl = document.getElementById('currentTimeDisplay');
        if (!currentTimeEl) return;

        const tick = this.isPlaying ? this.getCurrentTick() : this.pauseTick;
        const seconds = this.ticksToSeconds(tick);
        
        currentTimeEl.textContent = this.formatTime(seconds);
    }

    updateTotalTimeDisplay() {
        const totalTimeEl = document.getElementById('totalTimeDisplay');
        if (!totalTimeEl) return;

        const totalTick = this.getTotalDuration();
        const seconds = this.ticksToSeconds(totalTick);
        
        totalTimeEl.textContent = this.formatTime(seconds);
    }

    ticksToSeconds(tick) {
        const tps = this.getTicksPerSecond();
        if (tps <= 0) return 0;
        return tick / tps;
    }

    secondsToTicks(seconds) {
        return seconds * this.getTicksPerSecond();
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    seekToTick(tick) {
        tick = Math.max(0, Math.min(this.getTotalDuration(), tick));
        this.pauseTick = tick;
        
        if (this.isPlaying) {
            this.cancelAnimation();
            this.startTime = performance.now() / 1000;
            this.startAnimationLoop();
        }
        
        this.updateTimeDisplay();
    }

    seekToSeconds(seconds) {
        const tick = this.secondsToTicks(seconds);
        this.seekToTick(tick);
    }

    onCanvasClick(e) {
        if (!this.arrangement) return;

        const canvas = document.getElementById('pianoRollCanvas');
        const PIANO_KEY_WIDTH = 60;
        const TIMELINE_HEIGHT = 30;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x < PIANO_KEY_WIDTH || y < TIMELINE_HEIGHT) {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const ticksPerMeasure = 480 * 4;
        const pixelsPerTick = (100 / ticksPerMeasure) * window.pianoRoll.zoomLevel;
        
        const clickTick = (x / dpr - PIANO_KEY_WIDTH - window.pianoRoll.panX) / pixelsPerTick;
        
        this.seekToTick(clickTick);
    }

    getProgress() {
        const total = this.getTotalDuration();
        if (total <= 0) return 0;
        
        const current = this.isPlaying ? this.getCurrentTick() : this.pauseTick;
        return (current / total) * 100;
    }

    destroy() {
        this.stop();
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.arrangement = null;
        
        console.log("PlaybackEngine destroyed");
    }
}

window.playbackEngine = new PlaybackEngine();

window.addEventListener('beforeunload', () => {
    if (window.playbackEngine) {
        window.playbackEngine.destroy();
    }
});