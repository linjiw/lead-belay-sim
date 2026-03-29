import { simulate } from './physics.js';
import { defaultParams, presets } from './presets.js';

function assert(cond, message) { if (!cond) throw new Error(message); }
function clonePreset(key) { return { ...defaultParams(), ...presets[key].values }; }
function runCase(name, params) { return { name, metrics: simulate(params, { duration: 4.8, dt: 1/300 }).metrics }; }

const base = clonePreset('lightBelayerSoftCatch');
const longerRope = { ...base, ropeOut: base.ropeOut * 1.5 };
const moreFriction = { ...base, frictionParticipation: 0.6, frictionTransmission: 0.65 };
const hardBelayer = { ...base, belayerMass: 95, anchorMode: 'hard', belayerTetherLength: 0.35, softCatchIntensity: 0 };
const softBelayer = { ...base, belayerMass: 55, anchorMode: 'free', belayerTetherLength: 0, softCatchIntensity: 0.85 };
const firstClipOff = { ...clonePreset('gymLowClipRisk'), firstClipClipped: 0 };
const firstClipOn = { ...clonePreset('gymLowClipRisk'), firstClipClipped: 1 };

const results = [runCase('base', base), runCase('longerRope', longerRope), runCase('moreFriction', moreFriction), runCase('hardBelayer', hardBelayer), runCase('softBelayer', softBelayer), runCase('firstClipOff', firstClipOff), runCase('firstClipOn', firstClipOn)];
const byName = Object.fromEntries(results.map(r => [r.name, r.metrics]));

assert(byName.longerRope.maxClimberForce < byName.base.maxClimberForce, 'Longer rope should soften catch and lower climber peak force');
assert(byName.moreFriction.actualFF > byName.base.actualFF, 'More friction should increase actual fall factor');
assert(byName.moreFriction.maxClimberForce > byName.base.maxClimberForce, 'More friction should harden catch');
assert(byName.softBelayer.belayerLift > byName.hardBelayer.belayerLift, 'Softer/lighter belayer should be lifted more');
assert(byName.hardBelayer.maxAnchorLoad > byName.softBelayer.maxAnchorLoad, 'Hard belayer setup should increase anchor load');
assert(byName.firstClipOff.belayerLift > byName.firstClipOn.belayerLift, 'No first clip should allow more belayer displacement in the current model');
assert(byName.firstClipOff.actualFF > byName.firstClipOn.actualFF, 'No first clip should yield a higher actual fall factor estimate');

console.log('Trend tests passed.');
for (const r of results) console.log(`${r.name}: peak=${(r.metrics.maxClimberForce/1000).toFixed(2)}kN clear=${r.metrics.minGroundClearance.toFixed(2)}m FFa=${r.metrics.actualFF.toFixed(2)}`);
