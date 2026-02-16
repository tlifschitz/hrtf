#!/usr/bin/env python3
"""
Convert CIPIC HRIR .mat file to JSON for the HRTF Lab.

Usage:
  python convert-cipic.py <path-to-subject-dir> [output.json]

Expects the standard CIPIC hrir_final.mat file.
Extracts horizontal plane (elevation index 8 = 0°) HRIRs
for the KEMAR subject (subject_021 or subject_165).

Requires: scipy, numpy

If you don't have scipy, use generate-hrir.py instead to create
synthetic HRIR data for testing.
"""
import json
import sys
import numpy as np

def main():
    try:
        from scipy.io import loadmat
    except ImportError:
        print("scipy not installed. Install with: pip install scipy")
        print("Or use: python generate-hrir.py for synthetic data")
        sys.exit(1)

    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <path-to-hrir_final.mat> [output.json]")
        sys.exit(1)

    mat_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "public/hrir/hrir-data.json"

    data = loadmat(mat_path)
    hrir_l = data["hrir_l"]  # shape: (25, 50, 200) = (azimuth, elevation, samples)
    hrir_r = data["hrir_r"]

    # CIPIC azimuths: -80 -65 -55 ... 0 ... 55 65 80
    cipic_azimuths = [
        -80, -65, -55, -45, -40, -35, -30, -25, -20, -15, -10, -5,
        0,
        5, 10, 15, 20, 25, 30, 35, 40, 45, 55, 65, 80,
    ]

    # Elevation index 8 corresponds to 0° elevation in CIPIC
    elev_idx = 8

    entries = []
    for az_idx, az in enumerate(cipic_azimuths):
        entries.append({
            "azimuth": az,
            "left": hrir_l[az_idx, elev_idx, :].tolist(),
            "right": hrir_r[az_idx, elev_idx, :].tolist(),
        })

    dataset = {
        "sampleRate": 44100,
        "entries": entries,
    }

    with open(out_path, "w") as f:
        json.dump(dataset, f)

    print(f"Wrote {len(entries)} entries to {out_path}")
    size_kb = len(json.dumps(dataset)) / 1024
    print(f"File size: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
