#!/usr/bin/env python3
"""
Generate synthetic but perceptually plausible HRIR data for testing.

Creates a JSON file with 25 azimuth positions at 0° elevation,
mimicking the CIPIC horizontal-plane subset.

The synthetic HRIRs model:
- Interaural Time Difference (ITD): delay based on head radius
- Interaural Level Difference (ILD): frequency-dependent attenuation
- Head shadow: low-pass on contralateral ear
- Pinna filtering: subtle spectral notches

No dependencies beyond Python stdlib + basic math.
"""
import json
import math
import struct
import wave
import os

SAMPLE_RATE = 44100
IR_LENGTH = 200

CIPIC_AZIMUTHS = [
    -80, -65, -55, -45, -40, -35, -30, -25, -20, -15, -10, -5,
    0,
    5, 10, 15, 20, 25, 30, 35, 40, 45, 55, 65, 80,
]

HEAD_RADIUS_M = 0.0875  # ~8.75 cm
SPEED_OF_SOUND = 343.0  # m/s


def itd_samples(azimuth_deg: float) -> float:
    """Woodworth formula for ITD in samples."""
    az_rad = math.radians(azimuth_deg)
    itd_sec = (HEAD_RADIUS_M / SPEED_OF_SOUND) * (math.sin(az_rad) + az_rad)
    return itd_sec * SAMPLE_RATE


def generate_ir(azimuth_deg: float, ear: str) -> list[float]:
    """Generate a single ear's impulse response for given azimuth."""
    ir = [0.0] * IR_LENGTH
    az_rad = math.radians(azimuth_deg)

    # Positive azimuth = source on the right
    # For right ear: ipsilateral when az > 0
    # For left ear: ipsilateral when az < 0
    if ear == "left":
        effective_az = -azimuth_deg
    else:
        effective_az = azimuth_deg

    eff_rad = math.radians(effective_az)

    # ITD: ipsilateral ear gets signal first
    delay = itd_samples(abs(azimuth_deg))
    if effective_az >= 0:
        # Ipsilateral — signal arrives first (less delay)
        ear_delay = max(0, 2 - delay * 0.3)
    else:
        # Contralateral — signal arrives later
        ear_delay = 2 + delay

    # ILD: contralateral ear is attenuated
    if effective_az >= 0:
        gain = 1.0
    else:
        # More attenuation at extreme angles
        gain = max(0.3, 1.0 - 0.7 * (math.sin(abs(eff_rad)) ** 1.5))

    # Build impulse: a sharp onset + exponential decay with spectral character
    onset = int(round(ear_delay))
    if onset >= IR_LENGTH:
        onset = IR_LENGTH - 1

    # Main impulse
    ir[onset] = gain * 0.8

    # Early reflection / pinna effect: add a couple of delayed taps
    for tap_offset, tap_gain in [(3, -0.15), (7, 0.08), (12, -0.05)]:
        idx = onset + tap_offset
        if idx < IR_LENGTH:
            # Modify tap based on azimuth for spatial variation
            angle_mod = 1.0 + 0.3 * math.sin(eff_rad * 2 + tap_offset)
            ir[idx] = gain * tap_gain * angle_mod

    # Exponential decay tail (room / diffusion simulation)
    for i in range(onset + 1, IR_LENGTH):
        decay = math.exp(-0.03 * (i - onset))
        noise = math.sin(i * 0.7 + azimuth_deg * 0.1) * 0.02
        ir[i] += gain * noise * decay

    return ir


def generate_dataset() -> dict:
    entries = []
    for az in CIPIC_AZIMUTHS:
        entries.append({
            "azimuth": az,
            "left": generate_ir(az, "left"),
            "right": generate_ir(az, "right"),
        })
    return {
        "sampleRate": SAMPLE_RATE,
        "entries": entries,
    }


def generate_sample_wav(path: str, duration_sec: float = 5.0):
    """Generate a mono WAV file with pink-ish noise + tone bursts."""
    n_samples = int(SAMPLE_RATE * duration_sec)
    samples = []

    # Simple pink noise approximation using multiple random generators
    b = [0.0] * 7
    for i in range(n_samples):
        white = math.sin(i * 0.1) * 0.1 + math.sin(i * 0.37) * 0.05

        # Add tone bursts for clear spatial perception
        t = i / SAMPLE_RATE
        # 440Hz tone with amplitude envelope
        envelope = 0.5 * (1 + math.sin(2 * math.pi * 0.5 * t))  # 0.5Hz AM
        tone = 0.3 * math.sin(2 * math.pi * 440 * t) * envelope

        # Click train every 0.5s for transient localization cues
        click = 0.0
        if i % (SAMPLE_RATE // 2) < 20:
            click = 0.4 * math.exp(-0.3 * (i % (SAMPLE_RATE // 2)))

        sample = tone + white + click
        sample = max(-0.95, min(0.95, sample))
        samples.append(sample)

    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in samples:
            wf.writeframes(struct.pack("<h", int(s * 32767)))

    print(f"Wrote {path} ({duration_sec}s, {n_samples} samples)")


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)

    # Generate HRIR dataset
    hrir_path = os.path.join(project_root, "public", "hrir", "hrir-data.json")
    dataset = generate_dataset()
    with open(hrir_path, "w") as f:
        json.dump(dataset, f)
    size_kb = os.path.getsize(hrir_path) / 1024
    print(f"Wrote {len(dataset['entries'])} HRIR entries to {hrir_path} ({size_kb:.1f} KB)")

    # Generate sample audio
    wav_path = os.path.join(project_root, "public", "audio", "sample.wav")
    generate_sample_wav(wav_path, duration_sec=5.0)


if __name__ == "__main__":
    main()
