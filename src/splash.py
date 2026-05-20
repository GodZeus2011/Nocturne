import tkinter as tk
import threading
import time
import sys

class SplashScreen:
    def __init__(self, duration=3):
        self.root = tk.Tk()
        self.root.attributes('-topmost', True)
        self.duration = duration
        self.progress = 0
        
        self.root.overrideredirect(True)
        
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        
        window_width = 500
        window_height = 350
        
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        
        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")
        self.root.configure(bg="#121212")
        
        main_frame = tk.Frame(self.root, bg="#121212")
        main_frame.pack(fill=tk.BOTH, expand=True, padx=30, pady=30)
        
        logo_label = tk.Label(
            main_frame,
            text="🌙",
            font=("Arial", 100),
            bg="#121212",
            fg="#7bb1ff"
        )
        logo_label.pack(pady=(20, 10))
        
        title = tk.Label(
            main_frame,
            text="Nocturne",
            font=("Arial", 32, "bold"),
            bg="#121212",
            fg="#ffffff"
        )
        title.pack()
        
        subtitle = tk.Label(
            main_frame,
            text="AI Piano Transcription",
            font=("Arial", 14),
            bg="#121212",
            fg="#b0b0b0"
        )
        subtitle.pack(pady=(5, 20))
        
        progress_frame = tk.Frame(main_frame, bg="#2a2a2a", height=8)
        progress_frame.pack(fill=tk.X, pady=10)
        progress_frame.pack_propagate(False)
        
        self.progress_fill = tk.Frame(progress_frame, bg="#7bb1ff", height=8)
        self.progress_fill.place(x=0, y=0, relheight=1.0, relwidth=0.0)
        
        self.status_label = tk.Label(
            main_frame,
            text="Initializing...",
            font=("Arial", 11),
            bg="#121212",
            fg="#b0b0b0"
        )
        self.status_label.pack(pady=(5, 0))
        
        version_label = tk.Label(
            main_frame,
            text="v0.1.0",
            font=("Arial", 9),
            bg="#121212",
            fg="#808080"
        )
        version_label.pack(side=tk.BOTTOM, pady=(20, 0))
    
    def update_progress(self, value, status=""):
        """Update progress bar and status"""
        value = max(0, min(100, value))
        self.progress_fill.place(relwidth=value / 100)
        
        if status:
            self.status_label.config(text=status)
        
        try:
            self.root.update()
        except:
            pass
    
    def show(self, callback=None):
        """Display splash screen and run callback"""
        def run_loading():
            stages = [
                (0, "Initializing..."),
                (20, "Loading core modules..."),
                (40, "Loading AI models..."),
                (60, "Preparing audio engine..."),
                (80, "Setting up interface..."),
                (95, "Almost ready..."),
            ]
            
            start_time = time.time()
            
            for target_progress, status in stages:
                while self.progress < target_progress:
                    elapsed = time.time() - start_time
                    progress_percent = min((elapsed / self.duration) * 100, target_progress)
                    
                    self.update_progress(progress_percent, status)
                    self.progress = progress_percent
                    time.sleep(0.03)
            
            while self.progress < 100:
                elapsed = time.time() - start_time
                progress_percent = min((elapsed / self.duration) * 100, 100)
                
                self.update_progress(progress_percent, "Ready!")
                self.progress = progress_percent
                time.sleep(0.03)
            
            self.update_progress(100, "Launching Nocturne...")
            time.sleep(0.5)
            
            try:
                self.root.destroy()
            except:
                pass
            
            if callback:
                try:
                    callback()
                except Exception as e:
                    print(f"Error in callback: {e}")
                    import traceback
                    traceback.print_exc()
        
        thread = threading.Thread(target=run_loading, daemon=False)
        thread.start()
        
        try:
            self.root.mainloop()
        except:
            pass

def show_splash(duration=3, callback=None):
    """Convenience function to show splash screen"""
    splash = SplashScreen(duration=duration)
    splash.show(callback=callback)

if __name__ == "__main__":
    def on_complete():
        print("Splash complete!")
    
    show_splash(duration=3, callback=on_complete)