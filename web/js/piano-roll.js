class PianoRoll {
    constructor(canvasId, arrangement) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error("Canvas not found");
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.arrangement = arrangement;
        
        this.midiNoteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        this.whiteKeys = [0, 2, 4, 5, 7, 9, 11];
        
        this.pianoKeyWidth = 60;
        this.noteHeight = 10;
        
        this.totalPianoKeys = 88;
        this.visibleOctaves = 5;
        this.keysPerOctave = 12;
        
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        this.octaveOffset = 0;
        
        this.tooltipX = 0;
        this.tooltipY = 0;
        
        this.startMidi = 12;
        this.endMidi = 108;
        
        this.setupEventListeners();
        this.draw();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        window.addEventListener('keydown', (e) => this.onKeyDown(e), true);
    }

    draw() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, width, height);
        
        this.drawPiano();
        this.drawTimeline();
        this.drawNotes();
        this.drawPlayhead();
        this.drawCurrentNoteInfo();
        
        requestAnimationFrame(() => this.draw());
    }

    drawPiano() {
        const height = this.canvas.height;
        const width = this.pianoKeyWidth;
        
        this.ctx.fillStyle = '#1e1e1e';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.strokeStyle = '#333333';
        this.ctx.strokeRect(0, 0, width, height);
        
        const startOctave = 1 + this.octaveOffset;
        const endOctave = startOctave + this.visibleOctaves;
        
        let yPos = 0;
        
        for (let octave = startOctave; octave < endOctave; octave++) {
            for (let noteInOctave = 0; noteInOctave < 12; noteInOctave++) {
                const midiNote = octave * 12 + noteInOctave;
                
                const noteName = this.midiNoteNames[noteInOctave];
                const isWhiteKey = this.whiteKeys.includes(noteInOctave);
                
                if (isWhiteKey) {
                    this.ctx.fillStyle = '#f5f5f5';
                } else {
                    this.ctx.fillStyle = '#1a1a1a';
                }
                
                this.ctx.fillRect(0, yPos, width, this.noteHeight);
                this.ctx.strokeStyle = '#333333';
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(0, yPos, width, this.noteHeight);
                
                if (noteInOctave === 0) {
                    this.ctx.fillStyle = isWhiteKey ? '#000000' : '#ffffff';
                    this.ctx.font = 'bold 8px monospace';
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(`${noteName}${octave}`, 3, yPos + 8);
                }
                
                yPos += this.noteHeight;
            }
        }
    }

    drawTimeline() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        const ticksPerMeasure = 480 * 4;
        const pixelsPerTick = (100 / ticksPerMeasure) * this.zoomLevel;
        
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 1.5;
        this.ctx.font = '11px monospace';
        this.ctx.fillStyle = '#b0b0b0';
        this.ctx.textAlign = 'left';
        
        let measureNum = 1;
        let x = this.pianoKeyWidth;
        
        while (x - this.panX < width) {
            const screenX = x - this.panX;
            
            if (screenX > this.pianoKeyWidth) {
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
                    if (beatX > this.pianoKeyWidth && beatX < width) {
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
            const noteOctave = Math.floor(midiNote / 12);
            
            if (noteOctave < startOctave || noteOctave >= endOctave) {
                continue;
            }
            
            const noteInOctave = midiNote % 12;
            const yPos = (noteOctave - startOctave) * this.keysPerOctave * this.noteHeight + noteInOctave * this.noteHeight;
            
            const x = this.pianoKeyWidth + (note.quantized_start * pixelsPerTick) - this.panX;
            const y = yPos;
            
            const noteWidth = Math.max(2, note.quantized_duration * pixelsPerTick);
            const noteHeight = this.noteHeight - 1;
            
            if (x + noteWidth < this.pianoKeyWidth || x > this.canvas.width || 
                y + noteHeight < 0 || y > this.canvas.height) {
                continue;
            }
            
            const color = note.hand === 'left' ? '#3b82f6' : '#10b981';
            const opacity = 0.4 + (note.velocity / 127) * 0.6;
            
            this.ctx.fillStyle = color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
            this.ctx.fillRect(x + 1, y + 1, noteWidth, noteHeight);
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x + 1, y + 1, noteWidth, noteHeight);
        }
    }

    drawPlayhead() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        const playheadX = this.pianoKeyWidth - this.panX;
        
        this.ctx.strokeStyle = '#7bb1ff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(playheadX, 0);
        this.ctx.lineTo(playheadX, height);
        this.ctx.stroke();
    }

    drawCurrentNoteInfo() {
        const playheadX = this.pianoKeyWidth;
        const ticksPerMeasure = 480 * 4;
        const pixelsPerTick = (100 / ticksPerMeasure) * this.zoomLevel;
        
        const currentTick = (playheadX + this.panX - this.pianoKeyWidth) / pixelsPerTick;
        
        const notesAtPlayhead = this.arrangement.notes.filter(note => {
            return note.quantized_start <= currentTick && 
                   note.quantized_start + note.quantized_duration > currentTick;
        });
        
        if (notesAtPlayhead.length === 0) return;
        
        const padding = 10;
        const lineHeight = 14;
        const tooltipWidth = 140;
        const tooltipHeight = lineHeight * (notesAtPlayhead.length + 1) + padding * 2;
        
        const tooltipX = this.pianoKeyWidth + 10;
        const tooltipY = 20;
        
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
            const octave = Math.floor(note.pitch / 12);
            const noteName = this.midiNoteNames[note.pitch % 12];
            const hand = note.hand === 'left' ? 'LH' : 'RH';
            const text = `${noteName}${octave} (${hand}) V:${note.velocity}`;
            
            this.ctx.fillText(text, tooltipX + padding, tooltipY + padding + (index + 2) * lineHeight);
        });
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.tooltipX = x;
        this.tooltipY = y;
    }

    onMouseLeave() {
    }

    onWheel(e) {
        if (e.target === this.canvas) {
            e.preventDefault();
            
            const zoomSpeed = 0.1;
            
            if (e.deltaY < 0) {
                this.zoomLevel += zoomSpeed;
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
        
        const maxPixels = (maxTick * pixelsPerTick) + 200;
        return maxPixels;
    }

    onKeyDown(e) {
        const panSpeed = 50;
        const maxPan = this.getMaxPanX();
        
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.panX = Math.max(0, this.panX - panSpeed);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.panX = Math.min(maxPan, this.panX + panSpeed);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.zoomLevel += 0.1;
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.1);
        } else if (e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            this.octaveOffset = Math.max(0, this.octaveOffset - 1);
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            this.octaveOffset = Math.min(8 - this.visibleOctaves, this.octaveOffset + 1);
        }
    }
}