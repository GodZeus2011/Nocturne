const PIANO_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11];
const MIDI_START = 12;
const MIDI_END = 108;
const KEYS_PER_OCTAVE = 12;
const NOTE_HEIGHT = 10;
const PIANO_KEY_WIDTH = 60;

class PianoRoll {
    constructor(canvasId, arrangement) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error("Canvas not found:", canvasId);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error("Canvas 2D context not available");
            return;
        }

        this.arrangement = arrangement;
        this.animationFrameId = null;
        this.isDestroyed = false;
        
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.octaveOffset = 0;
        
        this.hoveredNote = null;
        this.tooltipX = 0;
        this.tooltipY = 0;

        this.playheadTick = 0;
        
        this.visibleOctaves = 5;
        this.dpr = window.devicePixelRatio || 1;
        
        this.setupCanvas();
        this.setupEventListeners();
        this.startAnimationLoop();
        
        console.log("PianoRoll initialized");
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        if (!container) return;

        this.canvas.width = container.clientWidth * this.dpr;
        this.canvas.height = container.clientHeight * this.dpr;
        
        this.canvas.style.width = container.clientWidth + 'px';
        this.canvas.style.height = container.clientHeight + 'px';
        
        this.ctx.scale(this.dpr, this.dpr);
        
        this.displayWidth = container.clientWidth;
        this.displayHeight = container.clientHeight;
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        window.addEventListener('keydown', (e) => this.onKeyDown(e), true);
    }

    startAnimationLoop() {
        const animate = () => {
            if (!this.isDestroyed) {
                this.draw();
                this.animationFrameId = requestAnimationFrame(animate);
            }
        };
        animate();
    }

    draw() {
        const width = this.displayWidth;
        const height = this.displayHeight;
        
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, width, height);
        
        this.drawPiano();
        this.drawTimeline();
        this.drawNotes();
        this.drawPlayhead();
        this.drawCurrentNoteInfo();
    }

    drawPiano() {
        const height = this.displayHeight;
        const width = PIANO_KEY_WIDTH;
        
        this.ctx.fillStyle = '#1e1e1e';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.strokeStyle = '#333333';
        this.ctx.strokeRect(0, 0, width, height);
        
        const startOctave = 1 + this.octaveOffset;
        const endOctave = startOctave + this.visibleOctaves;
        
        let yPos = 0;
        
        for (let octave = startOctave; octave < endOctave; octave++) {
            for (let noteInOctave = 0; noteInOctave < KEYS_PER_OCTAVE; noteInOctave++) {
                const noteName = PIANO_KEYS[noteInOctave];
                const isWhiteKey = WHITE_KEYS.includes(noteInOctave);
                
                this.ctx.fillStyle = isWhiteKey ? '#f5f5f5' : '#1a1a1a';
                this.ctx.fillRect(0, yPos, width, NOTE_HEIGHT);
                this.ctx.strokeStyle = '#333333';
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(0, yPos, width, NOTE_HEIGHT);
                
                if (noteInOctave === 0) {
                    this.ctx.fillStyle = isWhiteKey ? '#000000' : '#ffffff';
                    this.ctx.font = 'bold 8px monospace';
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(`${noteName}${octave}`, 3, yPos + 8);
                }
                
                yPos += NOTE_HEIGHT;
            }
        }
    }

    drawTimeline() {
        const width = this.displayWidth;
        const height = this.displayHeight;
        
        const ticksPerMeasure = 480 * 4;
        const pixelsPerTick = (100 / ticksPerMeasure) * this.zoomLevel;
        
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 1.5;
        this.ctx.font = '11px monospace';
        this.ctx.fillStyle = '#b0b0b0';
        this.ctx.textAlign = 'left';
        
        let measureNum = 1;
        let x = PIANO_KEY_WIDTH;
        
        while (x - this.panX < width) {
            const screenX = x - this.panX;
            
            if (screenX > PIANO_KEY_WIDTH) {
                this.ctx.strokeStyle = '#333333';
                this.ctx.lineWidth = 1.5;
                this.ctx.beginPath();
                this.ctx.moveTo(screenX, 0);
                this.ctx.lineTo(screenX, height);
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#b0b0b0';
                this.ctx.fillText(`${measureNum}`, screenX + 5, 15);
                
                for (let beat = 1; beat < 4; beat++) {
                    const beatX = x + (beat * 100 / 4) * this.zoomLevel - this.panX;
                    if (beatX > PIANO_KEY_WIDTH && beatX < width) {
                        this.ctx.strokeStyle = '#404040';
                        this.ctx.lineWidth = 0.5;
                        this.ctx.beginPath();
                        this.ctx.moveTo(beatX, 0);
                        this.ctx.lineTo(beatX, height);
                        this.ctx.stroke();
                    }
                }
            }
            
            x += 100 * this.zoomLevel;
            measureNum++;
        }
    }

    drawNotes() {
        const ticksPerMeasure = 480 * 4;
        const pixelsPerTick = (100 / ticksPerMeasure) * this.zoomLevel;
        
        const startOctave = 1 + this.octaveOffset;
        const endOctave = startOctave + this.visibleOctaves;
        
        for (const note of this.arrangement.notes) {
            const midiNote = note.pitch;
            const noteOctave = Math.floor(midiNote / KEYS_PER_OCTAVE);
            
            if (noteOctave < startOctave || noteOctave >= endOctave) {
                continue;
            }
            
            const noteInOctave = midiNote % KEYS_PER_OCTAVE;
            const yPos = (noteOctave - startOctave) * KEYS_PER_OCTAVE * NOTE_HEIGHT + 
                        noteInOctave * NOTE_HEIGHT;
            
            const x = PIANO_KEY_WIDTH + (note.quantized_start * pixelsPerTick) - this.panX;
            const y = yPos;
            
            const noteWidth = Math.max(2, note.quantized_duration * pixelsPerTick);
            const noteHeight = NOTE_HEIGHT - 1;
            
            if (x + noteWidth < PIANO_KEY_WIDTH || x > this.displayWidth || 
                y + noteHeight < 0 || y > this.displayHeight) {
                continue;
            }
            
            const color = note.hand === 'left' ? '#3b82f6' : '#10b981';
            const opacity = 0.4 + (note.velocity / 127) * 0.6;
            
            this.ctx.fillStyle = this.colorToRgba(color, opacity);
            this.ctx.fillRect(x + 1, y + 1, noteWidth, noteHeight);
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x + 1, y + 1, noteWidth, noteHeight);
        }
    }

    drawPlayhead() {
        const height = this.displayHeight;
        
        const ticksPerMeasure = 480 * 4;
        const pixelsPerTick = (100 / ticksPerMeasure) * this.zoomLevel;
        
        const playheadX = PIANO_KEY_WIDTH + (this.playheadTick * pixelsPerTick) - this.panX;
        
        if (playheadX < PIANO_KEY_WIDTH || playheadX > this.displayWidth) {
            return;
        }
        
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(playheadX, 0);
        this.ctx.lineTo(playheadX, height);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#ef4444';
        this.ctx.fillRect(playheadX - 4, 0, 8, 8);
    }

    drawCurrentNoteInfo() {
        const playheadX = PIANO_KEY_WIDTH;
        const ticksPerMeasure = 480 * 4;
        const pixelsPerTick = (100 / ticksPerMeasure) * this.zoomLevel;
        
        const currentTick = (playheadX + this.panX - PIANO_KEY_WIDTH) / pixelsPerTick;
        
        const notesAtPlayhead = this.arrangement.notes.filter(note => {
            return note.quantized_start <= currentTick && 
                   note.quantized_start + note.quantized_duration > currentTick;
        });
        
        if (notesAtPlayhead.length === 0) return;
        
        const padding = 10;
        const lineHeight = 14;
        const tooltipWidth = 140;
        const tooltipHeight = lineHeight * (notesAtPlayhead.length + 1) + padding * 2;
        
        let tooltipX = PIANO_KEY_WIDTH + 10;
        let tooltipY = 20;
        
        if (tooltipX + tooltipWidth > this.displayWidth) {
            tooltipX = this.displayWidth - tooltipWidth - 10;
        }
        if (tooltipY + tooltipHeight > this.displayHeight) {
            tooltipY = this.displayHeight - tooltipHeight - 10;
        }
        
        this.ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        this.ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        this.ctx.strokeStyle = '#7bb1ff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        this.ctx.fillStyle = '#7bb1ff';
        this.ctx.font = 'bold 11px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Now Playing:', tooltipX + padding, tooltipY + padding + lineHeight);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '11px monospace';
        
        notesAtPlayhead.forEach((note, index) => {
            const octave = Math.floor(note.pitch / KEYS_PER_OCTAVE);
            const noteName = PIANO_KEYS[note.pitch % KEYS_PER_OCTAVE];
            const hand = note.hand === 'left' ? 'LH' : 'RH';
            const text = `${noteName}${octave} (${hand}) V:${note.velocity}`;
            
            this.ctx.fillText(text, tooltipX + padding, tooltipY + padding + (index + 2) * lineHeight);
        });
    }

    setPlayheadPos(tick) {
        this.playheadTick = tick;
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.tooltipX = (e.clientX - rect.left) / this.dpr;
        this.tooltipY = (e.clientY - rect.top) / this.dpr;
    }

    onMouseLeave() {
        this.hoveredNote = null;
    }

    onWheel(e) {
        if (e.target === this.canvas) {
            e.preventDefault();
            
            const zoomSpeed = 0.1;
            
            if (e.deltaY < 0) {
                this.zoomLevel = Math.min(3.0, this.zoomLevel + zoomSpeed);
            } else {
                this.zoomLevel = Math.max(0.5, this.zoomLevel - zoomSpeed);
            }
        }
    }

    getMaxPanX() {
        const ticksPerMeasure = 480 * 4;
        const pixelsPerTick = (100 / ticksPerMeasure) * this.zoomLevel;
        
        let maxTick = 0;
        for (const note of this.arrangement.notes) {
            const noteEndTick = note.quantized_start + note.quantized_duration;
            maxTick = Math.max(maxTick, noteEndTick);
        }
        
        return (maxTick * pixelsPerTick) + 200;
    }

    onKeyDown(e) {
        const panSpeed = 50;
        const maxPan = this.getMaxPanX();
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.panX = Math.max(0, this.panX - panSpeed);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.panX = Math.min(maxPan, this.panX + panSpeed);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.zoomLevel = Math.min(3.0, this.zoomLevel + 0.1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.1);
                break;
            case 'w':
            case 'W':
                e.preventDefault();
                this.octaveOffset = Math.max(0, this.octaveOffset - 1);
                break;
            case 's':
            case 'S':
                e.preventDefault();
                this.octaveOffset = Math.min(8 - this.visibleOctaves, this.octaveOffset + 1);
                break;
        }
    }

    colorToRgba(hex, alpha) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        alpha = Math.max(0, Math.min(1, alpha));
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    destroy() {
        this.isDestroyed = true;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
        this.canvas.removeEventListener('wheel', this.onWheel);
        window.removeEventListener('keydown', this.onKeyDown);
        
        console.log("PianoRoll destroyed");
    }
}