import os
import sys
from pathlib import Path
from dataclasses import dataclass

@dataclass
class Config:
    """Global configuration for Nocturne"""
    
    @staticmethod
    def get_base_dir():
        """Get base application directory"""
        if getattr(sys, 'frozen', False):
            return Path(sys._MEIPASS)
        return Path(__file__).parent.parent.parent
    
    @staticmethod
    def get_data_dir():
        """Get user data directory"""
        if sys.platform == 'win32':
            data_dir = Path(os.environ['APPDATA']) / 'Nocturne'
        else:
            data_dir = Path.home() / '.nocturne'
        
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir
    
    @staticmethod
    def get_cache_dir():
        """Get cache directory"""
        cache_dir = Config.get_data_dir() / 'cache'
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir
    
    @staticmethod
    def get_log_dir():
        """Get log directory"""
        log_dir = Config.get_data_dir() / 'logs'
        log_dir.mkdir(parents=True, exist_ok=True)
        return log_dir
    
    @staticmethod
    def get_ffmpeg_path():
        """Get FFmpeg executable path"""
        base_dir = Config.get_base_dir()
        
        bundled_ffmpeg = base_dir / 'bin' / 'ffmpeg.exe'
        if bundled_ffmpeg.exists():
            return str(bundled_ffmpeg)
        
        import shutil
        system_ffmpeg = shutil.which('ffmpeg')
        if system_ffmpeg:
            return system_ffmpeg
        
        raise RuntimeError("FFmpeg not found. Install FFmpeg or use bundled version.")
    
    @staticmethod
    def get_frontend_path():
        base_dir = Config.get_base_dir()
        frontend_dir = base_dir / 'web'
        
        if not frontend_dir.exists():
            raise RuntimeError(f"Frontend directory not found: {frontend_dir}")
        
        return frontend_dir
    
    @staticmethod
    def get_index_html():
        """Get index.html path"""
        frontend_dir = Config.get_frontend_path()
        index_path = frontend_dir / 'index.html'
        
        if not index_path.exists():
            raise RuntimeError(f"index.html not found: {index_path}")
        
        return str(index_path)
    
    VERSION = "0.1.0"
    APP_NAME = "Nocturne"
    AUTHOR = "Your Name"
    
    SAMPLE_RATE = 16000
    CHUNK_SIZE = 2048
    
    DEFAULT_DIFFICULTY = "normal"
    DEFAULT_STYLE = "pop"
    
    @staticmethod
    def use_cuda():
        """Check if CUDA should be used"""
        try:
            import torch
            return torch.cuda.is_available()
        except:
            return False
    
    @staticmethod
    def get_device():
        """Get PyTorch device"""
        try:
            import torch
            return 'cuda' if torch.cuda.is_available() else 'cpu'
        except:
            return 'cpu'

if __name__ == "__main__":
    print(f"Base dir: {Config.get_base_dir()}")
    print(f"Data dir: {Config.get_data_dir()}")
    print(f"Cache dir: {Config.get_cache_dir()}")
    print(f"FFmpeg: {Config.get_ffmpeg_path()}")
    print(f"Device: {Config.get_device()}")