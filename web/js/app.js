class NocturneApp {
    constructor() {
        this.api = null;
        this.waitForAPI();
        
        this.currentArrangement = null;
        this.isProcessing = false;
        this.selectedAudioPath = null;
        this.logSections = {
            'Separation': [],
            'Transcription': [],
            'Arrangement': [],
            'Complete': []
        };
        
        this.initializeUI();
        this.attachEventListeners();
    }

    waitForAPI() {
        const onReady = () => {
            if (window.pywebview && window.pywebview.api) {
                this.api = window.pywebview.api;
                console.log("Nocturne API connected");
                this.addLog("Nocturne API connected", "success", "Separation");
                this.checkAppInfo();
            } else {
                console.error("window.pywebview.api not found");
                this.addLog("ERROR: API not available", "error", "Separation");
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
        
        this.addLog("Nocturne starting up...", "info", "Separation");
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
                this.addLog(`Difficulty: ${e.target.value}`, "info", "Separation");
            });
        }
        
        const styleSelect = document.getElementById('styleSelect');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                console.log("Style changed to:", e.target.value);
                this.addLog(`Style: ${e.target.value}`, "info", "Separation");
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
            this.addLog(`Nocturne v${info.version} Ready`, "success", "Separation");
        } catch (e) {
            console.error("Error getting app info:", e);
            this.addLog(`Error: ${e.message}`, "error", "Separation");
        }
    }

    async selectAudio() {
        if (!this.api) {
            this.addLog("ERROR: API not connected", "error", "Separation");
            return;
        }

        try {
            this.addLog("Opening file dialog...", "info", "Separation");
            const filePath = await this.api.select_audio();
            
            if (filePath) {
                this.selectedAudioPath = filePath;
                const fileName = filePath.split('\\').pop().split('/').pop();
                
                document.getElementById('selectedFilePath').textContent = fileName;
                document.getElementById('startProcessBtn').disabled = false;
                
                this.addLog(`Selected: ${fileName}`, "success", "Separation");
                
                const overlay = document.querySelector('.canvas-overlay');
                if (overlay) {
                    overlay.classList.add('hidden');
                }
            } else {
                this.addLog("File selection cancelled", "info", "Separation");
            }
        } catch (e) {
            console.error("Select audio error:", e);
            this.addLog(`Error: ${e.message || e}`, "error", "Separation");
        }
    }

    async startProcessing() {
        if (!this.api) {
            this.addLog("ERROR: API not connected", "error", "Separation");
            return;
        }

        if (!this.selectedAudioPath) {
            this.addLog("No audio file selected", "error", "Separation");
            return;
        }
        
        this.isProcessing = true;
        this.logSections = {
            'Separation': [],
            'Transcription': [],
            'Arrangement': [],
            'Complete': []
        };
        this.renderLog();
        
        document.getElementById('startProcessBtn').disabled = true;
        document.getElementById('exportMidiBtn').disabled = true;
        this.updateStats("Processing...", "—", "—", "—");
        
        try {
            this.addLog("Starting pipeline...", "info", "Separation");
            await this.api.start_processing(this.selectedAudioPath);
            
            this.pollForArrangement();
        } catch (e) {
            console.error("Processing error:", e);
            this.addLog(`Processing error: ${e.message || e}`, "error", "Separation");
            this.isProcessing = false;
            document.getElementById('startProcessBtn').disabled = false;
        }
    }

    async pollForArrangement() {
        const maxAttempts = 1800;
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
                        
                        this.addLog("Processing complete!", "success", "Complete");
                        this.addLog(`Arrangement: ${arrangement.notes.length} notes | Key: ${arrangement.key} | BPM: ${Math.round(arrangement.tempo)}`, "info", "Complete");
                        
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
                this.addLog(`Poll error: ${e.message || e}`, "warning", "Arrangement");
            }
            
            if (attempts >= maxAttempts) {
                this.addLog("Processing timeout (30 minutes)", "error", "Complete");
                this.isProcessing = false;
                document.getElementById('startProcessBtn').disabled = false;
                clearInterval(pollInterval);
            }
        }, 500);
    }

    async exportMidi() {
        if (!this.api) {
            this.addLog("ERROR: API not connected", "error", "Complete");
            return;
        }

        if (!this.currentArrangement) {
            this.addLog("No arrangement to export", "error", "Complete");
            return;
        }
        
        try {
            this.addLog("Exporting to MIDI...", "info", "Complete");
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `nocturne_${timestamp}.mid`;
            
            const result = await this.api.export_midi(filename);
            
            this.addLog(`Exported: ${filename}`, "success", "Complete");
            console.log("Export result:", result);
        } catch (e) {
            console.error("Export error:", e);
            this.addLog(`Export error: ${e.message || e}`, "error", "Complete");
        }
    }

    updateProgress(message, percentage) {
        const progressMsg = document.getElementById('progressMessage');
        const progressBar = document.getElementById('progressBar');
        
        if (progressMsg) {
            progressMsg.textContent = message;
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
        
        if (statusEl) {
            statusEl.textContent = status;
            this.flashBadge(statusEl.parentElement);
        }
        if (keyEl) {
            keyEl.textContent = key;
            this.flashBadge(keyEl.parentElement);
        }
        if (bpmEl) {
            bpmEl.textContent = bpm;
            this.flashBadge(bpmEl.parentElement);
        }
        if (notesEl) {
            notesEl.textContent = notes;
            this.flashBadge(notesEl.parentElement);
        }
    }

    flashBadge(badgeElement) {
        if (!badgeElement) return;
        
        badgeElement.classList.remove('flash');
        
        setTimeout(() => {
            badgeElement.classList.add('flash');
        }, 10);
        
        setTimeout(() => {
            badgeElement.classList.remove('flash');
        }, 610);
    }

    addLog(message, level = "info", section = "Separation") {
        if (!this.logSections[section]) {
            this.logSections[section] = [];
        }
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        const entry = `[${timeStr}] ${message}`;
        
        this.logSections[section].push({ text: entry, level });
        this.renderLog();
    }

    renderLog() {
        const logDisplay = document.getElementById('logDisplay');
        if (!logDisplay) return;
        
        logDisplay.innerHTML = '';
        
        for (const [sectionName, entries] of Object.entries(this.logSections)) {
            if (entries.length === 0) continue;
            
            const sectionEl = document.createElement('div');
            sectionEl.className = 'log-section';
            
            const headerEl = document.createElement('div');
            headerEl.className = 'log-section-header';
            
            const toggleEl = document.createElement('span');
            toggleEl.className = 'log-section-toggle';
            toggleEl.textContent = '▼';
            
            const titleEl = document.createElement('span');
            titleEl.className = 'log-section-title';
            titleEl.textContent = sectionName;
            
            const countEl = document.createElement('span');
            countEl.className = 'log-section-count';
            countEl.textContent = ` (${entries.length})`;
            
            headerEl.appendChild(toggleEl);
            headerEl.appendChild(titleEl);
            headerEl.appendChild(countEl);
            
            const contentEl = document.createElement('div');
            contentEl.className = 'log-section-content expanded';
            
            for (const entry of entries) {
                const entryEl = document.createElement('div');
                entryEl.className = `log-entry ${entry.level}`;
                entryEl.textContent = entry.text;
                contentEl.appendChild(entryEl);
            }
            
            headerEl.addEventListener('click', () => {
                contentEl.classList.toggle('expanded');
                toggleEl.classList.toggle('collapsed');
            });
            
            sectionEl.appendChild(headerEl);
            sectionEl.appendChild(contentEl);
            logDisplay.appendChild(sectionEl);
        }
        
        logDisplay.scrollTop = logDisplay.scrollHeight;
    }

    clearLog() {
        this.logSections = {
            'Separation': [],
            'Transcription': [],
            'Arrangement': [],
            'Complete': []
        };
        this.renderLog();
        this.addLog("Log cleared", "info", "Separation");
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