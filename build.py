import os
import sys
import shutil
import subprocess
import platform
from pathlib import Path
from datetime import datetime

class NocturneBuild:
    def __init__(self):
        self.root_dir = Path(__file__).parent
        self.build_dir = self.root_dir / "build"
        self.dist_dir = self.root_dir / "dist"
        self.version = "0.1.0"
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
    def log(self, message, level="INFO"):
        """Print formatted log message"""
        symbols = {
            "INFO": "ℹ️ ",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️ ",
            "STEP": "🔨",
            "CHECK": "✓ ",
        }
        print(f"{symbols.get(level, '')} {message}")
    
    def clean(self):
        """Remove previous build artifacts"""
        self.log("Cleaning previous builds...", "STEP")
        
        for dir_path in [self.build_dir, self.dist_dir]:
            if dir_path.exists():
                try:
                    shutil.rmtree(dir_path)
                    self.log(f"Removed {dir_path}", "CHECK")
                except Exception as e:
                    self.log(f"Could not remove {dir_path}: {e}", "WARNING")
    
    def check_python(self):
        """Verify Python version"""
        self.log("Checking Python version...", "STEP")
        
        if sys.version_info < (3, 10):
            self.log(f"Python 3.10+ required, found {sys.version}", "ERROR")
            return False
        
        self.log(f"Python {sys.version_info.major}.{sys.version_info.minor}", "CHECK")
        return True
    
    def check_dependencies(self):
        """Verify required packages are installed"""
        self.log("Checking dependencies...", "STEP")
        
        required = {
            "webview": "PyWebView (desktop bridge)",
            "torch": "PyTorch (AI framework)",
            "torchaudio": "PyTorch Audio",
            "librosa": "Audio analysis",
            "numpy": "Numerical computing",
            "scipy": "Scientific computing",
            "mido": "MIDI file creation",
            "PyInstaller": "EXE packaging",
        }
        
        missing = []
        for package, description in required.items():
            try:
                __import__(package.replace("-", "_"))
                self.log(f"{description}", "CHECK")
            except ImportError:
                self.log(f"{description} MISSING", "ERROR")
                missing.append(package)
        
        if missing:
            self.log(f"Missing: {', '.join(missing)}", "ERROR")
            self.log(f"Install with: pip install {' '.join(missing)}", "INFO")
            return False
        
        return True
    
    def check_files(self):
        """Verify required project files exist"""
        self.log("Checking project files...", "STEP")
        
        required_files = [
            "src/main.py",
            "web/index.html",
            "web/css/style.css",
            "web/js/app.js",
            "web/js/piano-roll.js",
            "web/js/playback.js",
            "requirements.txt",
        ]
        
        missing = []
        for file_path in required_files:
            full_path = self.root_dir / file_path
            if full_path.exists():
                self.log(file_path, "CHECK")
            else:
                self.log(f"{file_path} NOT FOUND", "ERROR")
                missing.append(file_path)
        
        if missing:
            self.log(f"Missing files: {', '.join(missing)}", "ERROR")
            return False
        
        return True
    
    def check_ffmpeg(self):
        """Check for FFmpeg"""
        self.log("Checking FFmpeg...", "STEP")
        
        ffmpeg_path = self.root_dir / "bin" / "ffmpeg.exe"
        
        if ffmpeg_path.exists():
            self.log("FFmpeg found (bundled)", "CHECK")
            return True
        
        self.log("FFmpeg not found at bin/ffmpeg.exe", "WARNING")
        self.log("Download from: https://ffmpeg.org/download.html", "INFO")
        self.log("Extract to: bin/ folder", "INFO")
        
        return False
    
    def detect_cuda(self):
        """Check for NVIDIA CUDA support"""
        self.log("Checking GPU support...", "STEP")
        
        try:
            import torch
            if torch.cuda.is_available():
                device_name = torch.cuda.get_device_name(0)
                self.log(f"CUDA detected: {device_name}", "CHECK")
                return True
            else:
                self.log("CUDA not available, will use CPU", "INFO")
                return False
        except Exception as e:
            self.log(f"GPU check failed: {e}", "WARNING")
            return False
    
    def create_spec(self):
        """Generate optimized PyInstaller spec file"""
        self.log("Creating optimized PyInstaller spec...", "STEP")
        
        spec_content = '''# -*- mode: python ; coding: utf-8 -*-
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

datas = [
    ('web', 'web'),
]

try:
    datas += collect_data_files('librosa', include_py_files=False)
except:
    pass

try:
    datas += collect_data_files('scipy', include_py_files=False, excludes=['**/*.pyc', '**/__pycache__'])
except:
    pass

hiddenimports = [
    'librosa',
    'librosa.util',
    'librosa.core',
    'soundfile',
    'audioread',
    'scipy',
    'scipy.signal',
    'scipy.fft',
    'numpy',
    'numpy.core',
    'torch',
    'torch.nn',
    'torchaudio',
    'mido',
    'webview',
]

excludedimports = [
    'matplotlib',
    'pandas',
    'notebook',
    'jupyter',
    'IPython',
    'pytest',
    'tests',
    'setuptools',
    'pip',
    'wheel',
    'tensorboard',
    'tensorflow.python.ops.numpy_ops',
    'cv2',
    'PIL.ImageQt',
    'PyQt5',
    'PyQt6',
    'PySide2',
    'PySide6',
    'tkinter.test',
]

a = Analysis(
    ['src/main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludedimports=excludedimports,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Nocturne',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[
        'vcruntime140.dll',
        'python311.dll',
        'torch_cpu.dll',
        'torch_python.dll',
    ],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[
        'vcruntime140.dll',
        'python311.dll',
    ],
    name='Nocturne'
)
'''
        
        spec_file = self.root_dir / "nocturne.spec"
        with open(spec_file, 'w') as f:
            f.write(spec_content)
        
        self.log(f"Created optimized spec", "CHECK")
        return spec_file
    
    def build_exe(self):
        """Run PyInstaller to create EXE"""
        self.log("Building executable with PyInstaller...", "STEP")
        
        spec_file = self.create_spec()
        
        cmd = [
            sys.executable,
            "-m", "PyInstaller",
            str(spec_file),
            "--distpath", str(self.dist_dir),
            "--workpath", str(self.build_dir),
            "--noconfirm",
        ]
        
        try:
            self.log("Running PyInstaller...", "INFO")
            result = subprocess.run(
                cmd,
                check=True,
                capture_output=False,
                text=True
            )
            self.log("Executable created successfully", "CHECK")
            return True
        except subprocess.CalledProcessError as e:
            self.log(f"Build failed: {e}", "ERROR")
            return False
        except FileNotFoundError:
            self.log("PyInstaller not found. Install with: pip install PyInstaller", "ERROR")
            return False
    
    def bundle_ffmpeg(self):
        """Copy FFmpeg to distribution folder"""
        self.log("Bundling FFmpeg...", "STEP")
        
        ffmpeg_src = self.root_dir / "bin" / "ffmpeg.exe"
        
        if not ffmpeg_src.exists():
            self.log(f"FFmpeg not found at {ffmpeg_src}", "WARNING")
            self.log("Application will use system FFmpeg (if installed)", "INFO")
            return True
        
        dist_app = self.dist_dir / "Nocturne"
        dist_bin = dist_app / "bin"
        dist_bin.mkdir(parents=True, exist_ok=True)
        
        try:
            shutil.copy(ffmpeg_src, dist_bin / "ffmpeg.exe")
            self.log(f"Copied FFmpeg to bin/", "CHECK")
            return True
        except Exception as e:
            self.log(f"Could not copy FFmpeg: {e}", "ERROR")
            return False
    
    def optimize_pytorch(self):
        """Remove unnecessary PyTorch files"""
        self.log("Optimizing PyTorch...", "STEP")
        
        torch_dir = self.dist_dir / "Nocturne" / "_internal" / "torch"
        
        if not torch_dir.exists():
            self.log("PyTorch not found in dist", "WARNING")
            return
        
        unnecessary_dirs = [
            "test",
            "testing",
            "include",
            "share",
        ]
        
        removed_size = 0
        
        for dir_name in unnecessary_dirs:
            dir_path = torch_dir / dir_name
            if dir_path.exists():
                try:
                    size = sum(f.stat().st_size for f in dir_path.rglob('*') if f.is_file())
                    shutil.rmtree(dir_path)
                    removed_size += size
                    self.log(f"Removed {dir_name}/", "CHECK")
                except Exception as e:
                    self.log(f"Could not remove {dir_name}: {e}", "WARNING")
        
        if removed_size > 0:
            removed_mb = removed_size / (1024 * 1024)
            self.log(f"Saved {removed_mb:.2f} MB", "SUCCESS")
    
    def optimize_scipy(self):
        """Remove unnecessary SciPy files"""
        self.log("Optimizing SciPy...", "STEP")
        
        scipy_dir = self.dist_dir / "Nocturne" / "_internal" / "scipy"
        
        if not scipy_dir.exists():
            self.log("SciPy not found in dist", "WARNING")
            return
        
        unnecessary_files = [
            "**/*.pyc",
            "**/__pycache__",
            "**/tests",
        ]
        
        removed_size = 0
        removed_count = 0
        
        for pattern in unnecessary_files:
            for file_path in scipy_dir.rglob(pattern):
                try:
                    if file_path.is_file():
                        size = file_path.stat().st_size
                        file_path.unlink()
                        removed_size += size
                        removed_count += 1
                    elif file_path.is_dir():
                        size = sum(f.stat().st_size for f in file_path.rglob('*') if f.is_file())
                        shutil.rmtree(file_path)
                        removed_size += size
                        removed_count += 1
                except Exception as e:
                    pass
        
        if removed_size > 0:
            removed_mb = removed_size / (1024 * 1024)
            self.log(f"Removed {removed_count} items, saved {removed_mb:.2f} MB", "SUCCESS")
    
    def get_exe_info(self):
        """Get information about built EXE"""
        exe_path = self.dist_dir / "Nocturne" / "Nocturne.exe"
        
        if not exe_path.exists():
            self.log("EXE not found", "ERROR")
            return
        
        size_bytes = exe_path.stat().st_size
        size_mb = size_bytes / (1024 * 1024)
        
        self.log(f"EXE Size: {size_mb:.2f} MB", "INFO")
        
        dist_app = self.dist_dir / "Nocturne"
        total_size = sum(
            f.stat().st_size 
            for f in dist_app.rglob('*') 
            if f.is_file()
        )
        total_mb = total_size / (1024 * 1024)
        
        self.log(f"Total Package Size: {total_mb:.2f} MB", "INFO")
    
    def create_run_script(self):
        self.log("Creating run script...", "STEP")
        
        run_script = self.root_dir / "run.bat"
        
        script_content = '''@echo off
cd /d "%~dp0"
dist\\Nocturne\\Nocturne.exe
pause
'''
        
        with open(run_script, 'w') as f:
            f.write(script_content)
        
        self.log("Created run.bat", "CHECK")
    
    def build(self):
        """Execute full build process"""
        print(f"\n{'='*60}")
        print(f"🌙 NOCTURNE BUILD SYSTEM")
        print(f"Version {self.version} | {self.timestamp}")
        print(f"{'='*60}\n")
        
        self.clean()
        print()
        
        if not self.check_python():
            print(f"\n{'='*60}")
            self.log("Build failed", "ERROR")
            print(f"{'='*60}\n")
            return False
        print()
        
        if not self.check_files():
            print(f"\n{'='*60}")
            self.log("Build failed", "ERROR")
            print(f"{'='*60}\n")
            return False
        print()
        
        if not self.check_dependencies():
            print(f"\n{'='*60}")
            self.log("Build failed", "ERROR")
            print(f"{'='*60}\n")
            return False
        print()
        
        self.check_ffmpeg()
        print()
        
        self.detect_cuda()
        print()
        
        if not self.build_exe():
            print(f"\n{'='*60}")
            self.log("Build failed", "ERROR")
            print(f"{'='*60}\n")
            return False
        print()
        
        self.bundle_ffmpeg()
        print()
        
        self.optimize_pytorch()
        print()
        
        self.optimize_scipy()
        print()
        
        self.get_exe_info()
        print()
        
        self.create_run_script()
        print()
        
        print(f"{'='*60}")
        self.log("Build complete!", "SUCCESS")
        print(f"Location: {self.dist_dir / 'Nocturne'}")
        print(f"Run: run.bat")
        print(f"{'='*60}\n")
        
        return True

def main():
    """Main entry point"""
    if len(sys.argv) > 1 and sys.argv[1] == "--clean":
        builder = NocturneBuild()
        builder.clean()
        print("✅ Clean complete\n")
        return
    
    builder = NocturneBuild()
    success = builder.build()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()