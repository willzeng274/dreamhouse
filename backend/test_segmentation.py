#!/usr/bin/env python3
"""
Test script to verify segmentation and classification work correctly.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def test_env_loading():
    """Test if environment variables are loaded correctly."""
    print("=" * 60)
    print("Testing Environment Variable Loading")
    print("=" * 60)

    gemini_key = os.environ.get("GEMINI_API_KEY")

    if gemini_key:
        print("[OK] GEMINI_API_KEY is set")
        print(f"  Length: {len(gemini_key)} characters")
        print(f"  First 10 chars: {gemini_key[:10]}...")
        print(f"  Last 10 chars: ...{gemini_key[-10:]}")
    else:
        print("[ERROR] GEMINI_API_KEY is NOT set")
        print("\nPlease check your .env file!")
        return False

    return True


def test_fastsam_model():
    """Test if FastSAM model exists."""
    print("\n" + "=" * 60)
    print("Testing FastSAM Model")
    print("=" * 60)

    model_path = "FastSAM-s.pt"

    if os.path.exists(model_path):
        size_mb = os.path.getsize(model_path) / (1024 * 1024)
        print(f"[OK] FastSAM model found: {model_path}")
        print(f"  Size: {size_mb:.2f} MB")
    else:
        print(f"[ERROR] FastSAM model NOT found: {model_path}")
        print("\nRun: python setup_model.py")
        return False

    return True


def test_segmentation_service():
    """Test if segmentation service can be imported and initialized."""
    print("\n" + "=" * 60)
    print("Testing Segmentation Service")
    print("=" * 60)

    try:
        from app.services.segmentation_service import SegmentationService

        print("[OK] SegmentationService imported successfully")

        service = SegmentationService()
        print("[OK] Service initialized")
        print(f"  Model path: {service.model_path}")
        print(f"  Gemini model: {service.gemini_model}")
        print(f"  API key set: {'Yes' if service.gemini_api_key else 'No'}")
        print(
            f"  Gemini client: {'Initialized' if service.gemini_client else 'Not initialized'}"
        )

        if service.gemini_api_key:
            print(f"  API key length: {len(service.gemini_api_key)}")

        return True
    except Exception as e:
        print(f"[ERROR] Error initializing service: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("SEGMENTATION & CLASSIFICATION TEST SUITE")
    print("=" * 60 + "\n")

    tests = [
        ("Environment Variables", test_env_loading),
        ("FastSAM Model", test_fastsam_model),
        ("Segmentation Service", test_segmentation_service),
    ]

    results = {}

    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"\n[ERROR] Test '{test_name}' crashed: {e}")
            results[test_name] = False

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status}: {test_name}")

    all_passed = all(results.values())

    print("\n" + "=" * 60)
    if all_passed:
        print("[OK] ALL TESTS PASSED - Ready to use!")
    else:
        print("[ERROR] SOME TESTS FAILED - Please fix the issues above")
    print("=" * 60 + "\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
