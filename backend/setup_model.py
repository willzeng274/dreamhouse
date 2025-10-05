#!/usr/bin/env python3
"""
Setup script to copy FastSAM model from script folder to backend.
Run this once after cloning the repository.
"""

import os
import shutil
from pathlib import Path


def setup_fastsam_model():
    """Copy FastSAM model from script folder to backend."""

    # Get paths
    backend_dir = Path(__file__).parent
    script_dir = backend_dir.parent.parent / "script"

    model_name = "FastSAM-s.pt"
    source_path = script_dir / model_name
    dest_path = backend_dir / model_name

    # Check if model already exists in backend
    if dest_path.exists():
        print(f"[OK] {model_name} already exists in backend directory")
        return True

    # Check if model exists in script folder
    if not source_path.exists():
        print(f"[ERROR] {model_name} not found in {script_dir}")
        print(f"\nPlease download the model:")
        print(
            f"  wget https://github.com/CASIA-IVA-Lab/FastSAM/releases/download/v0.1/FastSAM-s.pt"
        )
        print(f"  # Or download manually and place in {script_dir}")
        return False

    # Copy the model
    try:
        print(f"Copying {model_name} from script folder to backend...")
        shutil.copy2(source_path, dest_path)
        print(f"[OK] Successfully copied {model_name} to backend directory")

        # Show file size
        size_mb = dest_path.stat().st_size / (1024 * 1024)
        print(f"  File size: {size_mb:.2f} MB")

        return True
    except Exception as e:
        print(f"[ERROR] Error copying model: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("FastSAM Model Setup")
    print("=" * 60)
    print()

    success = setup_fastsam_model()

    print()
    if success:
        print("[OK] Setup complete! You can now run the backend server.")
    else:
        print("[ERROR] Setup incomplete. Please follow the instructions above.")

    print("=" * 60)
