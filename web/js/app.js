
class NocturneApp {
    constructor() {
        this.api = window.nocturne; 
        this.currentArrangement = null;
        this.isProcessing = false;
        this.selectedAudioPath = null;
        
        this.initializeUI();
        this.attachEventListeners();
        this.checkAppInfo();
    }

    initializeUI() {
        console.log("Initializing Nocturne UI...");
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.addLog("Nocturne Ready", "info");
    }

    attachEventListeners() {
        document.getElementById('selectAudioBtn').addEventListener('click', () => this.selectAudio());
        
        document.getElementById('startProcessBtn').addEventListener('click', () => this.startProcessing());
        
        document.getElementById('exportMidiBtn').addEventListener('click', () => this.exportMidi());
        
        document.getElementById('clearLogBtn').addEventListener('click', () => this.clearLog());
        
        document.getElementById('difficultySelect').addEventListener('change', (e) => {
            console.log("Difficulty changed to:", e.target.value);
        });
        
        document.getElementById('styleSelect').addEventListener('change', (e) => {
            console.log("Style changed to:", e.target.value);
        });
    }

    async checkAppInfo() {
        try {
            const info = await this.api.get_app_info();
            console.log("App Info:", info);
        } catch (e) {
            console.error("Error getting app info:", e);
        }
    }

    async selectAudio() {
        try {
            this.addLog("Opening file dialog...", "info");
            const filePath = await this.api.select_audio();
            
            if (filePath) {
                this.selectedAudioPath = filePath;
                const fileName = filePath.split('\\').pop().split('/').pop();
                document.getElementById('selectedFilePath').textContent = fileName;
                document.getElementById('startProcessBtn').disabled = false;
                this.addLog(`Selected: ${fileName}`, "info");
                
                document.querySelector('.canvas-overlay').classList.add('hidden');
            }
        } catch (e) {
            this.addLog(`Error selecting file: ${e.message}`, "error");
        }
    }

    async startProcessing() {
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
            this.addLog(`Processing error: ${e.message}`, "error");
            this.isProcessing = false;
            document.getElementById('startProcessBtn').disabled = false;
        }
    }

    async pollForArrangement() {
        const maxAttempts = 300; 
        let attempts = 0;
        
        const pollInterval = setInterval(async () => {
            attempts++;
            
            try {
                const arrangement = await this.api.get_arrangement();
                
                if (arrangement) {
                    this.currentArrangement = arrangement;
                    this.isProcessing = false;
                    
                    this.updateStats(
                        "Complete",
                        arrangement.key,
                        `${Math.round(arrangement.tempo)}`,
                        `${arrangement.notes.length}`
                    );
                    
                    this.addLog("Processing complete!", "success");
                    this.addLog(`Arrangement: ${arrangement.notes.length} notes`, "info");
                    
                    document.getElementById('exportMidiBtn').disabled = false;
                    
                    console.log("Arrangement received:", arrangement);
                    
                    clearInterval(pollInterval);
                }
            } catch (e) {
                console.error("Poll error:", e);
            }
            
            if (attempts >= maxAttempts) {
                this.addLog("Processing timeout", "error");
                this.isProcessing = false;
                document.getElementById('startProcessBtn').disabled = false;
                clearInterval(pollInterval);
            }
        }, 500);
    }

    async exportMidi() {
        if (!this.currentArrangement) {
            this.addLog("No arrangement to export", "error");
            return;
        }
        
        try {
            this.addLog("Exporting to MIDI...", "info");
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `nocturne_${timestamp}.mid`;
            
            await this.api.export_midi(filename);
            
            this.addLog(`Exported: ${filename}`, "success");
        } catch (e) {
            this.addLog(`Export error: ${e.message}`, "error");
        }
    }

    updateProgress(message, percentage) {
        document.getElementById('progressMessage').textContent = message;
        document.getElementById('progressPercent').textContent = `${Math.round(percentage)}%`;
        document.getElementById('progressBar').value = percentage;
    }

    updateStats(status, key, bpm, notes) {
        document.getElementById('statStatus').textContent = status;
        document.getElementById('statKey').textContent = key;
        document.getElementById('statBPM').textContent = bpm;
        document.getElementById('statNotes').textContent = notes;
    }

    addLog(message, level = "info") {
        const logDisplay = document.getElementById('logDisplay');
        const entry = document.createElement('div');
        entry.className = `log-entry ${level}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        logDisplay.appendChild(entry);
        logDisplay.scrollTop = logDisplay.scrollHeight;
        
        const entries = logDisplay.querySelectorAll('.log-entry');
        if (entries.length > 5000) {
            entries[0].remove();
        }
    }

    clearLog() {
        document.getElementById('logDisplay').innerHTML = '';
        this.addLog("Log cleared", "info");
    }

    resizeCanvas() {
        const canvas = document.getElementById('pianoRollCanvas');
        const container = canvas.parentElement;
        
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new NocturneApp();
    
    window.updateProgress = (message, progress) => {
        window.app.updateProgress(message, progress);
    };
});
