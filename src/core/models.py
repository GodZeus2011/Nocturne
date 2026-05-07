from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class Note:
    pitch: int          
    start: float        
    duration: float     
    velocity: int = 100 
    hand: str = "auto"  

    @property
    def end(self) -> float:
        return self.start + self.duration

@dataclass
class Chord:
    notes: List[Note]
    timestamp: float
    label: Optional[str] = None  
    root: Optional[int] = None 

@dataclass
class Arrangement:
    notes: List[Note]
    tempo: float                
    time_signature: str = "4/4"
    key: str = "C"               