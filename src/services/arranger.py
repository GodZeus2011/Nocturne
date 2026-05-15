import numpy as np
from itertools import combinations
from src.utils.logger import logger

class HarmonyEngine:
    def __init__(self):

        self.MAJ_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
        self.MIN_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        self.NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

        self.CHORD_VEC = {
            "(0, 0, 1, 1, 1, 0)": "Triad", 
            "(0, 1, 2, 1, 1, 1)": "Maj 7th",
            "(0, 2, 1, 1, 2, 0)": "Min 7th",
            "(0, 1, 1, 1, 1, 2)": "Dom 7th",
            "(1, 0, 1, 1, 1, 2)": "Diminished"
        }

    def get_interval_vector(self, midi_notes):
        if len(midi_notes) < 2:
            return [0, 0, 0, 0, 0, 0]
        
        pitch_classes = sorted(list(set([p % 12 for p in midi_notes])))

        vector = [0] * 6

        for n1, n2 in combinations(pitch_classes, 2):
            diff = abs(n1-n2)

            if diff > 6:
                diff = 12 - diff

            if 0 < diff <= 6:
                vector[diff - 1] += 1

        return vector

    def find_chord_root(self, midi_notes):
        if not midi_notes:
            return None
        
        pitch_classes = list(set([p % 12 for p in midi_notes]))

        if len(pitch_classes) == 1:
            return pitch_classes[0]
        
        scores = {pc: 0 for pc in pitch_classes}

        for n1 in pitch_classes:
            for n2 in pitch_classes:
                if n1 == n2: continue

                interval = (n2 - n1) % 12

                if interval == 7: 
                    scores[n1] += 10
                elif interval == 5: 
                    scores[n2] += 8
                elif interval == 4: 
                    scores[n1] += 5
                elif interval == 3: 
                    scores[n1] += 2
                elif interval == 9: 
                    scores[n2] += 2
        
        root = max(scores, key=scores.get)
        return root

    def detect_key(self, notes):
        
        if not notes:
            return "Unknown"

        histogram = np.zeros(12)
        for note in notes:
            histogram[note.pitch % 12] += note.duration

        if np.sum(histogram) > 0:
            histogram = histogram / np.sum(histogram)
        
        best_key = ""
        max_correlation = -1.1

        for i in range(12):
            major_test = np.roll(self.MAJ_PROFILE, i)
            minor_test = np.roll(self.MIN_PROFILE, i)

            corr_major = np.corrcoef(histogram, major_test)[0, 1]
            corr_minor = np.corrcoef(histogram, minor_test)[0, 1]

            if corr_major > max_correlation:
                max_correlation = corr_major
                best_key = f"{self.NOTE_NAMES[i]} Major"

            if corr_minor > max_correlation:
                max_correlation = corr_minor
                best_key = f"{self.NOTE_NAMES[i]} Minor"
        return best_key
    
    def get_chord_label(self, midi_notes):
        if len(midi_notes) < 2:
            return "N/A"
        
        root_pc = self.find_chord_root(midi_notes)
        vector = self.get_interval_vector(midi_notes)

        v_str = str(tuple(vector))
        quality = self.CHORD_VEC.get(v_str, "Cluster")

        if quality == "Triad":
            pitch_classes = [(p % 12) for p in midi_notes]
            if (root_pc + 4) % 12 in pitch_classes:
                quality = "Major"
            else:
                quality = "Minor"
        
        root_name = self.NOTE_NAMES[root_pc]
        return f"{root_name} {quality}"

class PianoArranger:
    def __init__(self):
        self.PIVOT_PITCH = 55

    def assign_hands(self, notes):
        for note in notes:
            if note.source == "bass":
                note.hand = "left"
            elif note.source == "vocal":
                note.hand = "right"
            else:
                note.hand = "left" if note.pitch < 55 else "right"

        logger.info(f"Hand Assignment Complete for {len(notes)} notes.")
        return notes

    def solve_physicality(self, notes):
        logger.info("Solving physicality constraints...")
        
        clean_notes = self._merge_notes(notes)
        
        final_notes = self._enforce_span(clean_notes)
        
        final_notes.sort(key=lambda x: x.start)
        
        return final_notes

    def _merge_notes(self, notes):
        if not notes: return []
        
        notes.sort(key=lambda x: (x.pitch, x.start))
        
        merged = []

        if notes:
            current = notes[0]
            for next_note in notes[1:]:
                if next_note.pitch == current.pitch and next_note.start <= current.end + 0.05:
                    new_end = max(current.end, next_note.end)
                    current.duration = new_end - current.start
                else:
                    merged.append(current)
                    current = next_note
            merged.append(current)
            
        return merged

    def _enforce_span(self, notes):
        
        notes.sort(key=lambda x: x.start)

        for i, note in enumerate(notes):
            if note.hand != "right": continue
            
            simultaneous_rh_notes = [note]
            for j in range(i + 1, len(notes)):
                if notes[j].start > note.start + 0.05: break 
                if notes[j].hand == "right":
                    simultaneous_rh_notes.append(notes[j])

            if len(simultaneous_rh_notes) > 1:
                pitches = [n.pitch for n in simultaneous_rh_notes]
                hi, lo = max(pitches), min(pitches)

                if (hi - lo) > 12:
                    for n in simultaneous_rh_notes:
                        if n.pitch == lo:
                            n.hand = "left"
        return notes
                            

if __name__ == "__main__":
    engine = HarmonyEngine()

    test_chords = {
        "C Major Triad": [60, 64, 67],           
        "A Minor Triad": [57, 60, 64],           
        "C Major (Inverted)": [64, 67, 72],      
        "G Dominant 7th": [55, 59, 62, 65],     
        "Power Chord": [48, 55],                
        "F Major 7th": [53, 57, 60, 64],
    }

    print("\n--- HARMONY ENGINE TEST ---")
    print(f"{'Description'.ljust(20)} | {'Root'.ljust(5)} | {'Vector'.ljust(18)} | {'Label'}")
    print("-" * 65)

    for desc, notes, in test_chords.items():
        root_pc = engine.find_chord_root(notes)
        root_name = engine.NOTE_NAMES[root_pc]
        vector = engine.get_interval_vector(notes)
        label = engine.get_chord_label(notes)

        print(f"{desc.ljust(20)} | {root_name.ljust(5)} | {str(vector).ljust(18)} | {label}")