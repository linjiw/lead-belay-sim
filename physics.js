export const g = 9.81;

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function ropeStiffness(params) {
  // Heuristic calibration: converts rope elongation / impact rating into an effective
  // spring constant for the currently participating rope length. This is NOT a UIAA-certified
  // derivation; it is an educational approximation chosen to preserve trend behavior.
  const participation = Math.max(0.35, params.frictionParticipation);
  const effectiveLength = Math.max(1, params.ropeOut * participation);
  const dyn = params.ropeDynamicElongationPct / 100;
  const baseTensionAtDyn = params.ropeImpactForce * 1000 * 0.32;
  const kFromElong = baseTensionAtDyn / Math.max(0.2, effectiveLength * dyn);
  const kFromImpact = (params.ropeImpactForce * 1000) / Math.max(0.8, effectiveLength * 0.42);
  return clamp(0.65 * kFromElong + 0.35 * kFromImpact, 1200, 12000);
}

export function tetherStiffness(mode) {
  if (mode === 'hard') return 14000;
  if (mode === 'soft') return 5000;
  return 0;
}

export function deriveMetrics(params, sim) {
  const fallLength = params.firstClipClipped
    ? 2 * params.climberAboveClip + params.slack
    : 2 * (params.lastClipHeight + params.climberAboveClip) + params.slack;
  const theoreticalFF = fallLength / Math.max(params.ropeOut, 0.1);
  const actualFF = fallLength / Math.max(params.ropeOut * params.frictionParticipation, 0.1);
  const softness = Math.max(0, Math.min(100,
    55 + (params.softCatchIntensity * 16) + (sim.maxBelayerY * 28) - (sim.maxClimberForce / 1000 * 6.5) - (sim.maxDecel * 4.5)
  ));
  return {
    theoreticalFF,
    actualFF,
    maxClimberForce: sim.maxClimberForce,
    maxBelayerLoad: sim.maxBelayerLoad,
    maxAnchorLoad: sim.maxAnchorLoad,
    lowestPoint: sim.minClimberY,
    groundFall: sim.minClimberY < 0,
    belayerLift: sim.maxBelayerY,
    catchSoftness: softness,
    ropeLoadedAt: sim.ropeLoadedAt,
    k: sim.k,
    maxDecel: sim.maxDecel,
    fallLength,
  };
}

export function simulate(params, options = {}) {
  const dt = options.dt ?? 1 / 240;
  const duration = options.duration ?? 4.8;
  const steps = Math.floor(duration / dt);

  const climberStart = { x: 0.55, y: params.lastClipHeight + params.climberAboveClip };
  const clip = { x: 0, y: params.lastClipHeight };
  const belayerAnchor = { x: params.belayerStartX, y: 0 };

  let climber = { x: climberStart.x, y: climberStart.y, vx: 0, vy: 0 };
  let belayer = { x: params.belayerStartX, y: 0, vx: 0, vy: 0 };

  const initialSeg1 = Math.hypot(climberStart.x - clip.x, climberStart.y - clip.y);
  const initialSeg2 = Math.hypot(params.belayerStartX - clip.x, 0 - clip.y);
  const initialPathLength = initialSeg1 + initialSeg2;
  // Important: the rope is already out at the start. Geometry sets the starting rope path,
  // while ropeOut mainly influences effective stiffness / fall-factor severity. Slack adds extra travel
  // before the rope becomes meaningfully loaded.
  const restLength = Math.max(0.3, initialPathLength + params.slack);
  const k = ropeStiffness(params);
  const c = clamp(2 * params.damping * Math.sqrt(k * Math.max(1, params.climberMass)), 20, 300);
  const tt = clamp(params.frictionTransmission, 0.35, 1);
  const kt = tetherStiffness(params.anchorMode);

  let maxClimberForce = 0;
  let maxBelayerLoad = 0;
  let maxAnchorLoad = 0;
  let minClimberY = Infinity;
  let maxBelayerY = 0;
  let softCatchTriggered = false;
  let ropeLoadedAt = null;
  let maxDecel = 0;
  const frames = [];

  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const seg1 = Math.hypot(climber.x - clip.x, climber.y - clip.y);
    const seg2 = Math.hypot(belayer.x - clip.x, belayer.y - clip.y);
    const currentLen = seg1 + seg2;

    const dir1 = seg1 > 1e-6 ? { x: (clip.x - climber.x) / seg1, y: (clip.y - climber.y) / seg1 } : { x: 0, y: -1 };
    const dir2 = seg2 > 1e-6 ? { x: (clip.x - belayer.x) / seg2, y: (clip.y - belayer.y) / seg2 } : { x: -1, y: 0 };

    const ext = Math.max(0, currentLen - restLength);
    const extRate = - (climber.vx * dir1.x + climber.vy * dir1.y) - (belayer.vx * dir2.x + belayer.vy * dir2.y);
    const T1 = ext > 0 ? clamp(k * ext + c * extRate, 0, 20000) : 0;
    const T2 = T1 * tt;
    if (T1 > 50 && ropeLoadedAt === null) ropeLoadedAt = t;

    // Soft catch approximation: a timed upward impulse on the belayer after rope loading.
    // Not a detailed human biomechanics model.
    if (!softCatchTriggered && ropeLoadedAt !== null && t >= ropeLoadedAt + params.softCatchTiming * 0.2) {
      belayer.vy += 1.15 * params.softCatchIntensity;
      belayer.vx += 0.12 * params.softCatchIntensity;
      softCatchTriggered = true;
    }

    const climberFx = T1 * dir1.x;
    const climberFy = T1 * dir1.y - params.climberMass * g;

    const tetherDx = belayer.x - belayerAnchor.x;
    const tetherDy = belayer.y - belayerAnchor.y;
    const tetherLen = Math.hypot(tetherDx, tetherDy);
    const tetherExcess = Math.max(0, tetherLen - params.belayerTetherLength);
    let tetherFx = 0, tetherFy = 0;
    if (kt > 0 && params.belayerTetherLength > 0 && tetherExcess > 0) {
      const td = { x: tetherDx / Math.max(tetherLen, 1e-6), y: tetherDy / Math.max(tetherLen, 1e-6) };
      const tetherForce = clamp(kt * tetherExcess, 0, 12000);
      tetherFx = -tetherForce * td.x;
      tetherFy = -tetherForce * td.y;
    }

    const footFriction = params.anchorMode === 'free' ? 35 : params.anchorMode === 'soft' ? 80 : 130;
    const desiredGroundFx = T2 * dir2.x - belayer.vx * 25;
    const groundFx = clamp(desiredGroundFx, -footFriction, footFriction);

    // If the first clip is in, low-height gym falls often limit belayer displacement more than
    // the unclipped case. This is a crude proxy, not a full redirect / geometry model.
    const firstClipLimiter = params.firstClipClipped ? clamp(1200 + 320 * params.lastClipHeight, 0, 5000) : 0;
    const firstClipFy = params.firstClipClipped && belayer.y > 0 ? -firstClipLimiter * belayer.y : 0;

    let belayerFx = T2 * dir2.x + tetherFx + groundFx;
    let belayerFy = T2 * dir2.y - params.belayerMass * g + tetherFy + firstClipFy;

    if (belayer.y <= 0 && belayerFy < 0) {
      belayerFy = 0;
      if (belayer.vy < 0) belayer.vy = 0;
      belayer.y = 0;
    }

    const ayC = climberFy / params.climberMass;
    const axC = climberFx / params.climberMass;
    const ayB = belayerFy / params.belayerMass;
    const axB = belayerFx / params.belayerMass;

    climber.vx = clamp(climber.vx + axC * dt, -25, 25); climber.vy = clamp(climber.vy + ayC * dt, -35, 20);
    belayer.vx = clamp(belayer.vx + axB * dt, -12, 12); belayer.vy = clamp(belayer.vy + ayB * dt, -20, 20);
    climber.x += climber.vx * dt; climber.y += climber.vy * dt;
    belayer.x += belayer.vx * dt; belayer.y += belayer.vy * dt;

    if (climber.x < 0.2) { climber.x = 0.2; if (climber.vx < 0) climber.vx *= -0.18; }
    if (belayer.x < 0.25) { belayer.x = 0.25; if (belayer.vx < 0) belayer.vx = 0; }

    const anchorLoad = T1 + T2;
    maxClimberForce = Math.max(maxClimberForce, T1);
    maxBelayerLoad = Math.max(maxBelayerLoad, T2);
    maxAnchorLoad = Math.max(maxAnchorLoad, anchorLoad);
    minClimberY = Math.min(minClimberY, climber.y);
    maxBelayerY = Math.max(maxBelayerY, belayer.y);
    maxDecel = Math.max(maxDecel, Math.max(0, -ayC / g));

    frames.push({ t, climber: { ...climber }, belayer: { ...belayer }, clip, T1, T2, anchorLoad, ext, minClimberY });
  }

  const metrics = deriveMetrics(params, { maxClimberForce, maxBelayerLoad, maxAnchorLoad, minClimberY, maxBelayerY, ropeLoadedAt, k, maxDecel });
  return { frames, metrics };
}
