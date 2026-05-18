

class NocturneApp {
    constructor() {
        this.api = null;
        this.waitForAPI();
        
        this.currentArrangement = null;
        this.isProcessing = false;
        this.selectedAudioPath = null;
        
        this.initializeUI();
        this.attachEventListeners();
    }

    waitForAPI() {
        const onReady = () => {
            if (window.pywebview && window.pywebview.api) {
                this.api = window.pywebview.api;
                console.log("Nocturne API connected");
                this.addLog("Nocturne API connected", "success");
                this.checkAppInfo();
            } else {
                console.error("window.pywebview.api not found");
                this.addLog("ERROR: API not available", "error");
            }
        };
        
        window.addEventListener('pywebviewready', onReady);
        
        if (window.pywebview && window.pywebview.api) {
            onReady();
        }
    }

    initializeUI() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.addLog("Nocturne starting up...", "info");
    }

    attachEventListeners() {
        const selectBtn = document.getElementById('selectAudioBtn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => this.selectAudio());
        }
        
        const startBtn = document.getElementById('startProcessBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startProcessing());
        }
        
        const exportBtn = document.getElementById('exportMidiBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportMidi());
        }
        
        const clearBtn = document.getElementById('clearLogBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearLog());
        }
        
        const diffSelect = document.getElementById('difficultySelect');
        if (diffSelect) {
            diffSelect.addEventListener('change', (e) => {
                console.log("Difficulty changed to:", e.target.value);
                this.addLog(`Difficulty: ${e.target.value}`, "info");
            });
        }
        
        const styleSelect = document.getElementById('styleSelect');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                console.log("Style changed to:", e.target.value);
                this.addLog(`Style: ${e.target.value}`, "info");
            });
        }
    }

    async checkAppInfo() {
        try {
            if (!this.api) {
                console.warn("API not ready yet");
                return;
            }

            const info = await this.api.get_app_info();
            console.log("App Info:", info);
            this.addLog(`Nocturne v${info.version} Ready`, "success");
        } catch (e) {
            console.error("Error getting app info:", e);
            this.addLog(`Error: ${e.message}`, "error");
        }
    }

    async selectAudio() {
        if (!this.api) {
            this.addLog("ERROR: API not connected", "error");
            return;
        }

        try {
            this.addLog("Opening file dialog...", "info");
            const filePath = await this.api.select_audio();
            
            if (filePath) {
                this.selectedAudioPath = filePath;
                const fileName = filePath.split('\\').pop().split('/').pop();
                
                document.getElementById('selectedFilePath').textContent = fileName;
                document.getElementById('startProcessBtn').disabled = false;
                
                this.addLog(`Selected: ${fileName}`, "success");
                
                const overlay = document.querySelector('.canvas-overlay');
                if (overlay) {
                    overlay.classList.add('hidden');
                }
            } else {
                this.addLog("File selection cancelled", "info");
            }
        } catch (e) {
            console.error("Select audio error:", e);
            this.addLog(`Error: ${e.message || e}`, "error");
        }
    }

    async startProcessing() {
        if (!this.api) {
            this.addLog("ERROR: API not connected", "error");
            return;
        }

        if (!this.selectedAudioPath) {
            this.addLog("No audio file selected", "error");
            return;
        }
        
        this.isProcessing = true;
        document.getElementById('startProcessBtn').disabled = true;
        document.getElementById('exportMidiBtn').disabled = true;
        this.updateStats("Processing...", "—", "—", "—");
        
        try {
            this.addLog("Starting pipeline...", "info");
            await this.api.start_processing(this.selectedAudioPath);
            
            this.pollForArrangement();
        } catch (e) {
            console.error("Processing error:", e);
            this.addLog(`Processing error: ${e.message || e}`, "error");
            this.isProcessing = false;
            document.getElementById('startProcessBtn').disabled = false;
        }
    }

    async pollForArrangement() {
        const maxAttempts = 2400;
        let attempts = 0;
        
        const pollInterval = setInterval(async () => {
            attempts++;
            
            try {
                const status = await this.api.get_processing_status();
                
                console.log(`[Poll ${attempts}] Status:`, status);
                
                this.updateProgress(status.message, status.progress);
                
                if (!status.is_processing) {
                    console.log("Processing finished, requesting arrangement...");
                    
                    const arrangement = await this.api.get_arrangement();
                    
                    if (arrangement) {
                        this.currentArrangement = arrangement;
                        this.isProcessing = false;

                        if (window.pianoRoll) {
                            window.pianoRoll = new PianoRoll('pianoRollCanvas', arrangement);
                        } else {
                            window.pianoRoll = new PianoRoll('pianoRollCanvas', arrangement);
                        }
                        
                        this.updateStats(
                            "Complete",
                            arrangement.key,
                            `${Math.round(arrangement.tempo)}`,
                            `${arrangement.notes.length}`
                        );
                        
                        this.addLog("Processing complete!", "success");
                        this.addLog(`Arrangement: ${arrangement.notes.length} notes | Key: ${arrangement.key} | BPM: ${Math.round(arrangement.tempo)}`, "info");
                        
                        document.getElementById('exportMidiBtn').disabled = false;
                        document.getElementById('startProcessBtn').disabled = false;
                        
                        console.log("Arrangement received:", arrangement);
                        
                        clearInterval(pollInterval);
                    } else {
                        console.warn("Processing finished but no arrangement available yet");
                    }
                }
            } catch (e) {
                console.error("Poll error:", e);
                this.addLog(`Poll error: ${e.message || e}`, "warning");
            }
            
            if (attempts >= maxAttempts) {
                this.addLog("Processing timeout (5 minutes)", "error");
                this.isProcessing = false;
                document.getElementById('startProcessBtn').disabled = false;
                clearInterval(pollInterval);
            }
        }, 500);
    }

    async exportMidi() {
        if (!this.api) {
            this.addLog("ERROR: API not connected", "error");
            return;
        }

        if (!this.currentArrangement) {
            this.addLog("No arrangement to export", "error");
            return;
        }
        
        try {
            this.addLog("Exporting to MIDI...", "info");
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `nocturne_${timestamp}.mid`;
            
            const result = await this.api.export_midi(filename);
            
            this.addLog(`Exported: ${filename}`, "success");
            console.log("Export result:", result);
        } catch (e) {
            console.error("Export error:", e);
            this.addLog(`Export error: ${e.message || e}`, "error");
        }
    }

    updateProgress(message, percentage) {
        const progressMsg = document.getElementById('progressMessage');
        const progressPct = document.getElementById('progressPercent');
        const progressBar = document.getElementById('progressBar');
        
        if (progressMsg) {
            progressMsg.textContent = message;
        }
        
        if (progressPct) {
            progressPct.textContent = `${Math.round(percentage)}%`;
        }
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
    }

    updateStats(status, key, bpm, notes) {
        const statusEl = document.getElementById('statStatus');
        const keyEl = document.getElementById('statKey');
        const bpmEl = document.getElementById('statBPM');
        const notesEl = document.getElementById('statNotes');
        
        if (statusEl) statusEl.textContent = status;
        if (keyEl) keyEl.textContent = key;
        if (bpmEl) bpmEl.textContent = bpm;
        if (notesEl) notesEl.textContent = notes;
    }

    addLog(message, level = "info") {
        const logDisplay = document.getElementById('logDisplay');
        if (!logDisplay) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${level}`;
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        
        entry.textContent = `[${timeStr}] ${message}`;
        
        logDisplay.appendChild(entry);
        logDisplay.scrollTop = logDisplay.scrollHeight;
        
        const entries = logDisplay.querySelectorAll('.log-entry');
        if (entries.length > 5000) {
            entries[0].remove();
        }
    }

    clearLog() {
        const logDisplay = document.getElementById('logDisplay');
        if (logDisplay) {
            logDisplay.innerHTML = '';
        }
        this.addLog("Log cleared", "info");
    }

    resizeCanvas() {
        const canvas = document.getElementById('pianoRollCanvas');
        if (!canvas) return;
        
        const container = canvas.parentElement;
        if (!container) return;
        
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new NocturneApp();
    
    window.updateProgress = (message, progress) => {
        if (window.app) {
            window.app.updateProgress(message, progress);
        } else {
            console.warn("App not initialized yet");
        }
    };
});