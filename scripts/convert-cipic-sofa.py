#!/usr/bin/env python3
"""Download CIPIC SOFA files and convert them to JSON for the web app.

Usage:
    pip install netcdf4 requests
    python3 scripts/convert-cipic-sofa.py

Outputs:
    public/hrir/<subject-id>.json   — one per subject
    public/hrir/subjects.json       — manifest listing all converted subjects
"""

import json
import os
import sys
from pathlib import Path

import requests

try:
    import netCDF4
except ImportError:
    print("ERROR: netCDF4 is required. Install with: pip install netcdf4", file=sys.stderr)
    sys.exit(1)

BASE_URL = "https://sofacoustics.org/data/database/cipic"

# Subjects to convert: (id, label)
SUBJECTS = [
    ("003", "Subject 003"),
    ("008", "Subject 008"),
    ("021", "KEMAR Large Pinna (021)"),
    ("040", "Subject 040"),
    ("165", "KEMAR Small Pinna (165)"),
]

CACHE_DIR = Path("scripts/.sofa-cache")
OUTPUT_DIR = Path("public/hrir")
DECIMAL_PLACES = 6


def download_sofa(subject_id: str) -> Path:
    """Download a CIPIC SOFA file, caching locally."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"subject_{subject_id}.sofa"
    cached = CACHE_DIR / filename
    if cached.exists():
        print(f"  Using cached {cached}")
        return cached

    url = f"{BASE_URL}/{filename}"
    print(f"  Downloading {url} ...")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    cached.write_bytes(resp.content)
    print(f"  Saved to {cached} ({len(resp.content) / 1024:.0f} KB)")
    return cached


def convert_sofa_to_json(sofa_path: Path, subject_id: str, label: str) -> dict:
    """Read a SOFA file and return a JSON-serializable dict."""
    ds = netCDF4.Dataset(str(sofa_path), "r")

    sample_rate = float(ds.variables["Data.SamplingRate"][0])
    ir_data = ds.variables["Data.IR"][:]  # shape: (M, R, N) — measurements × receivers × samples
    positions = ds.variables["SourcePosition"][:]  # shape: (M, 3) — azimuth, elevation, radius

    entries = []
    num_measurements = ir_data.shape[0]
    for i in range(num_measurements):
        azimuth = round(float(positions[i, 0]), 2)
        elevation = round(float(positions[i, 1]), 2)
        left = [round(float(v), DECIMAL_PLACES) for v in ir_data[i, 0, :]]
        right = [round(float(v), DECIMAL_PLACES) for v in ir_data[i, 1, :]]
        entries.append({
            "azimuth": azimuth,
            "elevation": elevation,
            "left": left,
            "right": right,
        })

    ds.close()

    return {
        "sampleRate": int(sample_rate),
        "subjectId": subject_id,
        "entries": entries,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []

    for subject_id, label in SUBJECTS:
        print(f"\nProcessing subject {subject_id} ({label})...")
        try:
            sofa_path = download_sofa(subject_id)
            dataset = convert_sofa_to_json(sofa_path, subject_id, label)

            out_file = OUTPUT_DIR / f"{subject_id}.json"
            with open(out_file, "w") as f:
                json.dump(dataset, f, separators=(",", ":"))

            size_mb = out_file.stat().st_size / (1024 * 1024)
            n_entries = len(dataset["entries"])
            print(f"  Wrote {out_file} ({n_entries} entries, {size_mb:.1f} MB)")

            manifest.append({
                "id": subject_id,
                "label": label,
                "file": f"{subject_id}.json",
            })
        except Exception as e:
            print(f"  ERROR processing subject {subject_id}: {e}", file=sys.stderr)

    # Write manifest
    manifest_path = OUTPUT_DIR / "subjects.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nWrote manifest: {manifest_path} ({len(manifest)} subjects)")
    print("Done!")


if __name__ == "__main__":
    main()
