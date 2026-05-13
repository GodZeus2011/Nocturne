import numpy as np
from itertools import combinations
#from src.utils.logger import logger

class HarmonyEngine:
    def __init__(self):
        self.CHORD_VEC = {
            "(0, 0, 1, 1, 1, 0)": "Maj/Min Triad",
            "(0, 1, 2, 1, 1, 1)": "Maj 7th",
            "(1, 0, 1, 1, 1, 2)": "Dim"
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
    
    def identify_chord_type(self, vector):
        v_str = str(tuple(vector))
        return self.CHORD_DNA.get(v_str, "Unknown Cluster")

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

if __name__ == "__main__":
    engine = HarmonyEngine()
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    test_chords = {
        "C Major Triad": [60, 64, 67],           
        "A Minor Triad": [57, 60, 64],           
        "C Major (Inverted)": [64, 67, 72],      
        "G Dominant 7th": [55, 59, 62, 65],     
        "Power Chord": [48, 55],                
        "Dissonant Cluster": [60, 61, 62],
        "F Major 7th": [53, 57, 60, 64]
    }

    for description, notes in test_chords.items():
        root_pc = engine.find_chord_root(notes)
        root_name = names[root_pc]
        print(f"{description.ljust(20)} | Notes: {notes} | Detected Root: {root_name}")
