import { simulate } from './physics.js';
import { defaultParams, presets } from './presets.js';

function assert(cond, message) { if (!cond) throw new Error(message); }
function clonePreset(key) { return { ...defaultParams(), ...presets[key].values }; }

const scenarios = [clonePreset('gymLowClipRisk'), clonePreset('lightBelayerSoftCatch'), clonePreset('heavyAnchoredHardCatch'), clonePreset('multipitchNearBelay')];

for (const params of scenarios) {
  const { frames } = simulate(params, { duration: 4.8, dt: 1/300 });
  for (const frame of frames) {
    const cr = frame.radii.climberRadius;
    const br = frame.radii.belayerRadius;
    assert(frame.climber.x >= cr - 1e-6, 'Climber should not penetrate wall boundary');
    assert(frame.belayer.x >= br - 1e-6, 'Belayer should not penetrate wall boundary');
    assert(frame.climber.y >= cr - 1e-6, 'Climber should not penetrate floor boundary');
    assert(frame.belayer.y >= br - 1e-6, 'Belayer should not penetrate floor boundary');
  }
}

console.log('Constraint tests passed.');
