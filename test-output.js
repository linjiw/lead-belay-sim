import { simulate } from './physics.js';
import { defaultParams, presets } from './presets.js';

function assert(cond, message) { if (!cond) throw new Error(message); }
const params = { ...defaultParams(), ...presets.lightBelayerSoftCatch.values };
const { frames, metrics } = simulate(params, { duration: 4.8, dt: 1/300 });

assert(Array.isArray(frames) && frames.length > 100, 'Simulation should produce a time series');
assert(typeof metrics.maxClimberForce === 'number', 'Metrics should include maxClimberForce');
assert(typeof metrics.minGroundClearance === 'number', 'Metrics should include minGroundClearance');
assert(frames.every(f => typeof f.groundClearance === 'number'), 'Each frame should include groundClearance');
assert(frames.every(f => f.contacts && typeof f.contacts.climberGroundContact === 'boolean'), 'Each frame should include contact flags');
assert(frames.every((f, i, arr) => i === 0 || f.t >= arr[i-1].t), 'Frame times should be monotonic');

console.log('Output-shape tests passed.');
