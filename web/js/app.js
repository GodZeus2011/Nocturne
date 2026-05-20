class NocturneApp {
    constructor() {
        this.api = null;
        this.currentArrangement = null;
        this.isProcessing = false;
        this.selectedAudioPath = null;
        this.logSections = {
            'Separation': [],
            'Transcription': [],
            'Arrangement': [],
            'Complete': []
        };
        this.pollInterval = null;
        
        this.initializeUI();
        this.waitForAPI();
        this.attachEventListeners();
        this.setupDraggableControls();
        this.setupPlaybackSync();
    }

    waitForAPI() {
        const onReady = () => {
            if (window.pywebview?.api) {
                this.api = window.pywebview.api;
                console.log("Nocturne API connected");
                this.addLog("Nocturne API connected", "success", "Separation");
                this.checkAppInfo();
            } else {
                console.error("window.pywebview.api not found");
                this.addLog("ERROR: API not available", "error", "Separation");
            }
        };
        
        if (window.pywebview?.api) {
            onReady();
        } else {
            window.addEventListener('pywebviewready', onReady, { once: true });
        }
    }

    initializeUI() {
        this.resizeCanvas();
        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resizeCanvas(), 150);
        });
        
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
                this.addLog(`Difficulty: ${e.target.value}`, "info", "Separation");
            });
        }
        
        const styleSelect = document.getElementById('styleSelect');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                this.addLog(`Style: ${e.target.value}`, "info", "Separation");
            });
        }
    }

    setupDraggableControls() {
        const controlBar = document.getElementById('playbackControlBar');
        const dragHandle = document.getElementById('controlDragHandle');
        
        if (!controlBar || !dragHandle) return;

        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        dragHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = controlBar.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            dragHandle.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;

            controlBar.style.position = 'fixed';
            controlBar.style.left = x + 'px';
            controlBar.style.top = y + 'px';
            controlBar.style.bottom = 'auto';
            controlBar.style.transform = 'none';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            dragHandle.style.cursor = 'move';
        });

        dragHandle.addEventListener('mouseenter', () => {
            if (!isDragging) {
                dragHandle.style.cursor = 'move';
            }
        });

        dragHandle.addEventListener('mouseleave', () => {
            if (!isDragging) {
                dragHandle.style.cursor = 'default';
            }
        });
    }

    setupPlaybackSync() {
        if (window.playbackEngine) {
            window.playbackEngine.onTickUpdate = (tick) => {
                this.updatePlaybackUI(tick);
                
                if (window.pianoRoll) {
                    window.pianoRoll.setPlayheadPos(tick);
                }
            };
            
            window.playbackEngine.onPlaybackEnd = () => {
                this.onPlaybackComplete();
            };
        }
    }

    updatePlaybackUI(tick) {
        const progress = window.playbackEngine ? window.playbackEngine.getProgress() : 0;
        const progressBar = document.getElementById('progressBar');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }

    onPlaybackComplete() {
        this.addLog("Playback complete", "success", "Complete");
    }

    async checkAppInfo() {
        try {
            if (!this.api) {
                console.warn("API not ready yet");
                return;
            }

            const info = await this.api.get_app_info();
            this.addLog(`Nocturne v${info.version} Ready`, "success", "Separation");
        } catch (e) {
            console.error("Error getting app info:", e);
            this.addLog(`Error: ${this.getErrorMessage(e)}`, "error", "Separation");
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
                
                const filePathEl = document.getElementById('selectedFilePath');
                if (filePathEl) {
                    filePathEl.textContent = fileName;
                }
                
                const startBtn = document.getElementById('startProcessBtn');
                if (startBtn) {
                    startBtn.disabled = false;
                }
                
                const overlay = document.querySelector('.canvas-overlay');
                if (overlay) {
                    overlay.classList.add('hidden');
                }
                
                this.addLog(`Selected: ${fileName}`, "success", "Separation");
            } else {
                this.addLog("File selection cancelled", "info", "Separation");
            }
        } catch (e) {
            console.error("Select audio error:", e);
            this.addLog(`Error: ${this.getErrorMessage(e)}`, "error", "Separation");
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
        
        const startBtn = document.getElementById('startProcessBtn');
        const exportBtn = document.getElementById('exportMidiBtn');
        
        if (startBtn) startBtn.disabled = true;
        if (exportBtn) exportBtn.disabled = true;
        
        this.updateStats("Processing...", "—", "—", "—");
        
        try {
            this.addLog("Starting pipeline...", "info", "Separation");
            await this.api.start_processing(this.selectedAudioPath);
            
            this.pollForArrangement();
        } catch (e) {
            console.error("Processing error:", e);
            this.addLog(`Processing error: ${this.getErrorMessage(e)}`, "error", "Separation");
            this.isProcessing = false;
            
            if (startBtn) startBtn.disabled = false;
        }
    }

    async pollForArrangement() {
        const maxAttempts = 1800;
        let attempts = 0;
        let arrangementReceived = false;
        
        this.pollInterval = setInterval(async () => {
            attempts++;
            
            try {
                const status = await this.api.get_processing_status();
                
                this.updateProgress(status.message, status.progress);
                
                if (!status.is_processing && !arrangementReceived) {
                    arrangementReceived = true;
                    
                    this.addLog("Processing finished, retrieving arrangement...", "info", "Arrangement");
                    
                    const arrangement = await this.api.get_arrangement();
                    
                    if (arrangement && arrangement.notes && arrangement.notes.length > 0) {
                        this.currentArrangement = arrangement;
                        this.isProcessing = false;

                        if (window.pianoRoll) {
                            window.pianoRoll.destroy();
                        }
                        window.pianoRoll = new PianoRoll('pianoRollCanvas', arrangement);
                        
                        if (window.playbackEngine) {
                            window.playbackEngine.loadArrangement(arrangement);
                        }
                        
                        this.updateStats(
                            "Complete",
                            arrangement.key || "—",
                            `${Math.round(arrangement.tempo || 0)}`,
                            `${arrangement.notes.length}`
                        );
                        
                        this.addLog("Processing complete!", "success", "Complete");
                        this.addLog(
                            `Arrangement: ${arrangement.notes.length} notes | Key: ${arrangement.key} | BPM: ${Math.round(arrangement.tempo)}`,
                            "info",
                            "Complete"
                        );
                        
                        const exportBtn = document.getElementById('exportMidiBtn');
                        const startBtnAgain = document.getElementById('startProcessBtn');
                        if (exportBtn) exportBtn.disabled = false;
                        if (startBtnAgain) startBtnAgain.disabled = false;
                        
                        clearInterval(this.pollInterval);
                    } else {
                        console.warn("Processing finished but no valid arrangement");
                        this.addLog("Error: No arrangement data received", "error", "Complete");
                        arrangementReceived = false;
                    }
                }
            } catch (e) {
                console.error("Poll error:", e);
                this.addLog(`Poll error: ${this.getErrorMessage(e)}`, "warning", "Arrangement");
            }
            
            if (attempts >= maxAttempts) {
                this.addLog("Processing timeout (30 minutes)", "error", "Complete");
                this.isProcessing = false;
                const startBtn = document.getElementById('startProcessBtn');
                if (startBtn) startBtn.disabled = false;
                clearInterval(this.pollInterval);
            }
        }, 1000);
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
            
            await this.api.export_midi(filename);
            
            this.addLog(`Exported: ${filename}`, "success", "Complete");
        } catch (e) {
            console.error("Export error:", e);
            this.addLog(`Export error: ${this.getErrorMessage(e)}`, "error", "Complete");
        }
    }

    updateProgress(message, percentage) {
        const progressMsg = document.getElementById('progressMessage');
        const progressBar = document.getElementById('progressBar');
        
        if (progressMsg) {
            progressMsg.textContent = message;
        }
        
        if (progressBar) {
            const clampedProgress = Math.max(0, Math.min(100, percentage));
            progressBar.style.width = `${clampedProgress}%`;
        }
    }

    updateStats(status, key, bpm, notes) {
        const updates = {
            'statStatus': status,
            'statKey': key,
            'statBPM': bpm,
            'statNotes': notes
        };
        
        for (const [elementId, value] of Object.entries(updates)) {
            const el = document.getElementById(elementId);
            if (el) {
                el.textContent = value;
                this.flashBadge(el.parentElement);
            }
        }
    }

    flashBadge(badgeElement) {
        if (!badgeElement) return;
        
        badgeElement.classList.remove('flash');
        void badgeElement.offsetWidth;
        badgeElement.classList.add('flash');
    }

    addLog(message, level = "info", section = "Separation") {
        if (!this.logSections[section]) {
            this.logSections[section] = [];
        }
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        const entry = `[${timeStr}] ${message}`;
        
        this.logSections[section].push({ text: entry, level });
        
        if (this.logSections[section].length > 500) {
            this.logSections[section].shift();
        }
        
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
        
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        
        canvas.style.width = container.clientWidth + 'px';
        canvas.style.height = container.clientHeight + 'px';
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
        }
    }

    getErrorMessage(e) {
        if (typeof e === 'string') return e;
        if (e?.message) return e.message;
        if (e?.error) return e.error;
        return String(e);
    }

    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new NocturneApp();
    
    window.updateProgress = (message, progress) => {
        if (window.app) {
            window.app.updateProgress(message, progress);
        }
    };
});

window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});