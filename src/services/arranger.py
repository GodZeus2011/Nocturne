import numpy as np
from itertools import combinations
from src.utils.logger import logger

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

if __name__ == "__main__":
    engine = HarmonyEngine()

    c_maj = [60, 64, 67]
    vec = engine.get_interval_vector(c_maj)
    print(f"C Major Vector: {vec}")
