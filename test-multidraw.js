import { computeRopeModel, generateDraws } from './physics.js';
import { defaultParams, presets } from './presets.js';

function assert(cond, message) { if (!cond) throw new Error(message); }
const base = { ...defaultParams(), ...presets.lightBelayerSoftCatch.values };
const belayer = { x: base.belayerStartX, y: 0.24 };
const climber = { x: 0.55, y: base.lastClipHeight + base.climberAboveClip };

const oneDraw = { ...base, drawCount: 1, routeWander: 0.02, quickdrawFrictionMu: 0.12 };
const manyDraws = { ...base, drawCount: 5, routeWander: 0.35, quickdrawFrictionMu: 0.3 };

const draws1 = generateDraws(oneDraw, 0);
const draws5 = generateDraws(manyDraws, 0);
assert(draws5.length >= draws1.length, 'More draw count should generate at least as many clipped draws');

const model1 = computeRopeModel({ belayerPoint: belayer, climberPoint: climber, draws: draws1, params: oneDraw });
const model5 = computeRopeModel({ belayerPoint: belayer, climberPoint: climber, draws: draws5, params: manyDraws });

assert(model5.totalPathLength > model1.totalPathLength, 'More draws/wander should increase rope path length');
assert(model5.tauTotal < model1.tauTotal, 'More friction / bends should reduce total transmission');
assert(model5.effectiveRopeLength <= model5.totalPathLength + 1e-9, 'Effective rope length should not exceed path length');
assert(model1.effectiveRopeLength > 0 && model5.effectiveRopeLength > 0, 'Effective rope length should stay positive');
assert(model5.drawDetails.length === draws5.length, 'Should produce one draw detail per draw');

console.log('Multi-draw tests passed.');
console.log({
  path1: model1.totalPathLength,
  path5: model5.totalPathLength,
  tau1: model1.tauTotal,
  tau5: model5.tauTotal,
  eff1: model1.effectiveRopeLength,
  eff5: model5.effectiveRopeLength,
});
