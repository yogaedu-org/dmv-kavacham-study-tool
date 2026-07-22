"""Prosody/F0 transfer PoC (#35): impose a melody's pitch contour onto spoken
English via Praat Manipulation + PSOLA (parselmouth). CPU-only, deterministic.

Now: a placeholder chant-style melody (until the real recitation lands, navaratri
-sadhana#1). Later: replace `MELODY_ST` with the F0 extracted from the real chant.
Usage: python pitch_transfer.py <in_speech.wav> <out.wav>
"""
import sys
import parselmouth
from parselmouth.praat import call

IN = sys.argv[1] if len(sys.argv) > 1 else "refs/eng_v1.wav"
OUT = sys.argv[2] if len(sys.argv) > 2 else "out/sung_v1.wav"

# A gentle chant-style contour: a reciting tone with small steps + cadential drops,
# 16 "notes" over the 4 eight-syllable pādas (semitones relative to the tonic).
MELODY_ST = [0, 0, 2, 0,   0, 2, 3, 0,   0, 0, 2, 0,   2, 0, -2, -5]

snd = parselmouth.Sound(IN)
dur = snd.get_total_duration()

# tonic = the voice's own median pitch, so the warp stays gentle (fewer artifacts)
pitch = snd.to_pitch()
tonic = call(pitch, "Get quantile", 0, 0, 0.5, "Hertz")
if tonic != tonic or tonic <= 0:  # NaN / unvoiced fallback
    tonic = 180.0
print("duration %.2fs, tonic %.1f Hz" % (dur, tonic))

manip = call(snd, "To Manipulation", 0.01, 60, 600)
pt = call("Create PitchTier", "mel", 0.0, dur)
n = len(MELODY_ST)
step = dur / n
for i, st in enumerate(MELODY_ST):
    hz = tonic * (2.0 ** (st / 12.0))
    t0 = i * step + step * 0.15
    t1 = (i + 1) * step - step * 0.15
    call(pt, "Add point", t0, hz)   # hold the note...
    call(pt, "Add point", t1, hz)   # ...to its end (PSOLA glides between notes)
call([manip, pt], "Replace pitch tier")
out = call(manip, "Get resynthesis (overlap-add)")
out.save(OUT, "WAV")
print("wrote", OUT)
