# V2 Design Notes

## Goal
把 V1 从“单文件演示”推进到“更可测试、可解释的教育型模拟器”。

## Design choices

### 1. Split responsibilities
- `physics.js`: physics engine and metric derivation
- `presets.js`: inputs and presets
- `app.js`: UI wiring and canvas drawing
- `test.js`: automated sanity tests

### 2. What we intentionally model
- climber + belayer as two masses
- rope as effective spring-damper
- effective rope length reduced by friction participation
- lower belayer-side tension via transmission factor
- optional belayer tether
- soft catch as timed belayer impulse
- first-clip limiter as a crude low-height belayer-displacement constraint

### 3. What we intentionally do NOT claim
- exact rope certification-level behavior
- exact device-assisted braking curves
- exact quickdraw-by-quickdraw capstan friction
- exact human posture / wall contact dynamics

## Validation philosophy
Not "absolute truth". Instead:
1. avoid obvious numerical instability
2. enforce trend tests that match accepted lead-belay intuition
3. document limitations explicitly

## Remaining issues
- catch softness metric is still heuristic and saturates easily in very soft scenarios
- no force-time charts yet
- no segmented rope path through multiple draws
