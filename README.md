# Landolt C · Cortical Magnification

A mobile psychophysics app that estimates personal Schwartz cortical magnification
parameters **k₁** and **k₂** from Landolt C gap acuity thresholds.

Replication of **Pointer & Hess (1989)** — *Perception & Psychophysics*, 45(6), 529–538.

## Method

- True 4AFC: gap direction (↑ → ↓ ←) is random and independent of C position
- C placed on horizontal meridian only (left/right of fixation)
- 2-up / 1-down staircase → ~70.7% threshold, chance = 25%
- 6 eccentricities: 1°, 2°, 4°, 6°, 10°, 16° (auto-capped to screen width)
- Bracket phase (10 trials) + staircase (40 trials) per eccentricity
- Schwartz parameters estimated by robust (Huber) linear regression of T(e) = (e + k₂) / k₁

## Parameters

| Parameter | Meaning | Normal range |
|-----------|---------|-------------|
| k₂ | Foveal offset — shifts the singularity away from zero eccentricity | 0.3–1.5° |
| k₁ | Cortical scale factor — mm of cortex per unit of log-polar coordinate | 15–25 |

## Usage

1. Deploy to GitHub Pages (Settings → Pages → main branch / root)
2. Open on iPhone in **landscape** at a fixed viewing distance
3. Enter viewing distance and screen width on setup screen
4. Complete practice block then 6 eccentricity staircases (~15 min)
5. Results show fitted M(e) = k₁/(e + k₂) curve vs P&H population reference

## Install as PWA

In Safari: Share → Add to Home Screen. Runs fullscreen in landscape, works offline.

## References

- Pointer, J.S. & Hess, R.F. (1989). The contrast sensitivity gradient across the human visual field. *Perception & Psychophysics*, 45(6), 529–538.
- Schwartz, E.L. (1980). Computational anatomy and functional architecture of striate cortex. *Vision Research*, 20(8), 645–669.
- Rovamo, J. & Virsu, V. (1979). An estimation and application of the human cortical magnification factor. *Experimental Brain Research*, 37(3), 495–510.
