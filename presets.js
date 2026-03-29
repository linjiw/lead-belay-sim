export const fieldDefinitions = [
  ["climberMass", "Climber 体重", 80, 40, 120, 1, "kg"],
  ["belayerMass", "Belayer 体重", 70, 40, 120, 1, "kg"],
  ["climberAboveClip", "坠落前高于最后挂片", 1.2, 0.2, 4, 0.1, "m"],
  ["lastClipHeight", "当前最高已挂快挂高度", 4.2, 0.5, 18, 0.1, "m"],
  ["drawCount", "已挂快挂数量", 3, 1, 10, 1, "–"],
  ["firstDrawHeight", "第一把挂高度", 2.8, 0.5, 8, 0.1, "m"],
  ["drawSpacing", "相邻挂片平均间距", 1.0, 0.4, 3, 0.1, "m"],
  ["routeWander", "线路横向折线程度", 0.18, 0, 1.2, 0.02, "m"],
  ["quickdrawFrictionMu", "快挂摩擦系数 μ", 0.22, 0.05, 0.6, 0.01, "–"],
  ["ropeOut", "总已放出绳长", 8, 2, 40, 0.1, "m"],
  ["slack", "额外余绳", 0.2, 0, 1.5, 0.02, "m"],
  ["ropeDynamicElongationPct", "绳动态延展", 32, 20, 45, 1, "%"],
  ["ropeImpactForce", "绳标称冲击力(校准辅助)", 8.6, 6, 12, 0.1, "kN"],
  ["damping", "系统阻尼", 0.16, 0.01, 0.6, 0.01, "–"],
  ["firstClipClipped", "首挂已挂", 1, 0, 1, 1, "bool"],
  ["belayerStartX", "保护员离墙水平距离", 1.8, 0.5, 4, 0.1, "m"],
  ["belayerTetherLength", "保护员 tether 长度", 0.8, 0, 2, 0.05, "m"],
  ["softCatchTiming", "soft catch 时机", 0.55, 0, 1.2, 0.01, "s"],
  ["softCatchIntensity", "soft catch 强度", 0.6, 0, 1.5, 0.05, "–"],
  ["wallHeight", "墙高", 12, 4, 25, 0.5, "m"],
];

export const presets = {
  gymLowClipRisk: {
    label: "馆内低挂片 / ground-fall 风险",
    values: { climberMass: 78, belayerMass: 68, climberAboveClip: 1.2, lastClipHeight: 2.8, drawCount: 1, firstDrawHeight: 2.8, drawSpacing: 1.0, routeWander: 0.06, quickdrawFrictionMu: 0.14, ropeOut: 6.9, slack: 0.18, ropeDynamicElongationPct: 32, ropeImpactForce: 8.6, damping: 0.16, firstClipClipped: 0, belayerStartX: 1.7, belayerTetherLength: 0, softCatchTiming: 0.58, softCatchIntensity: 0.1, wallHeight: 10, anchorMode: 'free' }
  },
  lightBelayerSoftCatch: {
    label: "轻保护员 + soft catch",
    values: { climberMass: 80, belayerMass: 60, climberAboveClip: 1.5, lastClipHeight: 4.2, drawCount: 2, firstDrawHeight: 2.8, drawSpacing: 1.4, routeWander: 0.18, quickdrawFrictionMu: 0.22, ropeOut: 10.5, slack: 0.2, ropeDynamicElongationPct: 34, ropeImpactForce: 8.5, damping: 0.15, firstClipClipped: 1, belayerStartX: 1.9, belayerTetherLength: 0, softCatchTiming: 0.52, softCatchIntensity: 0.8, wallHeight: 14, anchorMode: 'free' }
  },
  heavyAnchoredHardCatch: {
    label: "重保护员 / anchored / hard catch",
    values: { climberMass: 70, belayerMass: 92, climberAboveClip: 1.2, lastClipHeight: 4.6, drawCount: 2, firstDrawHeight: 2.8, drawSpacing: 1.8, routeWander: 0.28, quickdrawFrictionMu: 0.3, ropeOut: 9.5, slack: 0.08, ropeDynamicElongationPct: 30, ropeImpactForce: 8.9, damping: 0.18, firstClipClipped: 1, belayerStartX: 1.4, belayerTetherLength: 0.35, softCatchTiming: 0.5, softCatchIntensity: 0, wallHeight: 14, anchorMode: 'hard' }
  },
  multipitchNearBelay: {
    label: "多段 near-belay 高 factor",
    values: { climberMass: 80, belayerMass: 80, climberAboveClip: 1.8, lastClipHeight: 1.8, drawCount: 1, firstDrawHeight: 1.8, drawSpacing: 1.0, routeWander: 0.05, quickdrawFrictionMu: 0.2, ropeOut: 3.6, slack: 0.08, ropeDynamicElongationPct: 31, ropeImpactForce: 8.6, damping: 0.16, firstClipClipped: 1, belayerStartX: 0.8, belayerTetherLength: 0.8, softCatchTiming: 0.58, softCatchIntensity: 0.15, wallHeight: 7, anchorMode: 'soft' }
  }
};

export function defaultParams() {
  const params = { anchorMode: 'free' };
  for (const [key, , value] of fieldDefinitions) params[key] = value;
  return params;
}
