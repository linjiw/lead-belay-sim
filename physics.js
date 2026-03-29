export const g = 9.81;

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function segmentLength(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function generateDraws(params, wallX = 0) {
  const draws = [];
  const count = Math.max(1, Math.round(params.drawCount || 1));
  const baseX = wallX + 0.02;
  const maxHeight = params.lastClipHeight + Math.max(0.05, params.climberAboveClip * 0.8);
  for (let i = 0; i < count; i++) {
    const y = params.firstDrawHeight + i * params.drawSpacing;
    const offsetSign = i % 2 === 0 ? 1 : -1;
    const x = baseX + offsetSign * params.routeWander * Math.min(1, 0.45 + i * 0.12);
    draws.push({ x, y, clipped: true, index: i + 1 });
  }
  const clipped = draws.filter(d => d.y <= maxHeight);
  return clipped.length ? clipped : [{ x: baseX, y: Math.min(params.firstDrawHeight, maxHeight), clipped: true, index: 1 }];
}

export function angleBetween(v1, v2) {
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  if (n1 < 1e-8 || n2 < 1e-8) return Math.PI;
  const dot = clamp((v1.x * v2.x + v1.y * v2.y) / (n1 * n2), -1, 1);
  return Math.acos(dot);
}

export function computeRopeModel({ belayerPoint, climberPoint, draws, params }) {
  const path = [belayerPoint, ...draws, climberPoint];
  const segments = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    segments.push({ from: a, to: b, length: segmentLength(a, b), index: i });
  }

  const mu = params.quickdrawFrictionMu ?? 0.22;
  const drawDetails = [];
  for (let i = 1; i < path.length - 1; i++) {
    const p0 = path[i - 1], p1 = path[i], p2 = path[i + 1];
    const vin = { x: p0.x - p1.x, y: p0.y - p1.y };
    const vout = { x: p2.x - p1.x, y: p2.y - p1.y };
    const phi = angleBetween(vin, vout);
    const theta = Math.max(0, Math.PI - phi);
    const tau = clamp(Math.exp(-mu * theta), 0.55, 1);
    drawDetails.push({ x: p1.x, y: p1.y, phi, theta, tau, index: i });
  }

  let tauTotal = 1;
  for (const d of drawDetails) tauTotal *= d.tau;
  tauTotal = clamp(tauTotal, 0.35, 1);

  // propagate participation from climber side downward
  const segmentWeights = new Array(segments.length).fill(1);
  let running = 1;
  for (let i = segments.length - 1; i >= 0; i--) {
    segmentWeights[i] = running;
    if (i > 0 && drawDetails[i - 1]) running *= drawDetails[i - 1].tau;
  }

  const totalPathLength = segments.reduce((s, seg) => s + seg.length, 0);
  let effectiveRopeLength = 0;
  for (let i = 0; i < segments.length; i++) effectiveRopeLength += segments[i].length * segmentWeights[i];
  effectiveRopeLength = clamp(effectiveRopeLength, 0.5, totalPathLength);

  return { path, segments, drawDetails, tauTotal, totalPathLength, effectiveRopeLength, segmentWeights };
}

export function ropeStiffness(params, effectiveLengthOverride) {
  const participation = Math.max(0.35, params.frictionParticipation);
  const effectiveLength = Math.max(1, effectiveLengthOverride ?? (params.ropeOut * participation));
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
  const actualFF = fallLength / Math.max(sim.effectiveRopeLength, 0.1);
  const softness = Math.max(0, Math.min(100,
    55 + (params.softCatchIntensity * 16) + (sim.maxBelayerY * 22) - (sim.maxClimberForce / 1000 * 7.5) - (sim.maxDecel * 5.5)
  ));
  return {
    theoreticalFF,
    actualFF,
    maxClimberForce: sim.maxClimberForce,
    maxBelayerLoad: sim.maxBelayerLoad,
    maxAnchorLoad: sim.maxAnchorLoad,
    lowestPoint: sim.minClimberY,
    minGroundClearance: sim.minGroundClearance,
    groundFall: sim.minGroundClearance < 0.02,
    belayerLift: sim.maxBelayerY,
    catchSoftness: softness,
    ropeLoadedAt: sim.ropeLoadedAt,
    k: sim.k,
    maxDecel: sim.maxDecel,
    fallLength,
    drawCount: sim.drawCount,
    totalPathLength: sim.totalPathLength,
    effectiveRopeLength: sim.effectiveRopeLength,
    tauTotal: sim.tauTotal,
    avgDrawTheta: sim.avgDrawTheta,
  };
}

export function simulate(params, options = {}) {
  const dt = options.dt ?? 1 / 240;
  const duration = options.duration ?? 4.8;
  const steps = Math.floor(duration / dt);

  const climberRadius = options.climberRadius ?? 0.22;
  const belayerRadius = options.belayerRadius ?? 0.24;
  const wallX = 0;
  const floorY = 0;

  const climberStart = { x: Math.max(0.55, wallX + climberRadius), y: params.lastClipHeight + params.climberAboveClip };
  const belayerAnchor = { x: params.belayerStartX, y: floorY };

  let climber = { x: climberStart.x, y: climberStart.y, vx: 0, vy: 0 };
  let belayer = { x: params.belayerStartX, y: floorY + belayerRadius, vx: 0, vy: 0 };

  const draws = generateDraws(params, wallX);
  const initialRopeModel = computeRopeModel({ belayerPoint: belayer, climberPoint: climberStart, draws, params });
  const restLength = Math.max(0.3, initialRopeModel.totalPathLength + params.slack);
  const kBase = ropeStiffness(params, initialRopeModel.effectiveRopeLength);
  const c = clamp(2 * params.damping * Math.sqrt(kBase * Math.max(1, params.climberMass)), 20, 300);
  const kt = tetherStiffness(params.anchorMode);

  let maxClimberForce = 0;
  let maxBelayerLoad = 0;
  let maxAnchorLoad = 0;
  let minClimberY = Infinity;
  let maxBelayerY = 0;
  let minGroundClearance = Infinity;
  let softCatchTriggered = false;
  let ropeLoadedAt = null;
  let maxDecel = 0;
  let lastRopeModel = initialRopeModel;
  const frames = [];

  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const ropeModel = computeRopeModel({ belayerPoint: belayer, climberPoint: climber, draws, params });
    lastRopeModel = ropeModel;
    const currentLen = ropeModel.totalPathLength;
    const segTop = ropeModel.segments[ropeModel.segments.length - 1];
    const segBot = ropeModel.segments[0];
    const dir1 = segTop.length > 1e-6 ? { x: (segTop.from.x - segTop.to.x) / segTop.length, y: (segTop.from.y - segTop.to.y) / segTop.length } : { x: 0, y: -1 };
    const dir2 = segBot.length > 1e-6 ? { x: (segBot.to.x - segBot.from.x) / segBot.length, y: (segBot.to.y - segBot.from.y) / segBot.length } : { x: -1, y: 0 };

    const ext = Math.max(0, currentLen - restLength);
    const extRate = - (climber.vx * dir1.x + climber.vy * dir1.y) - (belayer.vx * dir2.x + belayer.vy * dir2.y);
    const effectiveParticipatingLength = Math.max(
      ropeModel.effectiveRopeLength,
      params.ropeOut * clamp(0.55 + 0.45 * ropeModel.tauTotal, 0.45, 1)
    );
    const k = ropeStiffness(params, effectiveParticipatingLength);
    const T1 = ext > 0 ? clamp(k * ext + c * extRate, 0, 20000) : 0;
    const T2 = T1 * ropeModel.tauTotal;
    if (T1 > 50 && ropeLoadedAt === null) ropeLoadedAt = t;

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

    const firstClipLimiter = params.firstClipClipped ? clamp(1200 + 320 * params.firstDrawHeight, 0, 5000) : 0;
    const firstClipFy = params.firstClipClipped && belayer.y > 0 ? -firstClipLimiter * belayer.y : 0;

    let belayerFx = T2 * dir2.x + tetherFx + groundFx;
    let belayerFy = T2 * dir2.y - params.belayerMass * g + tetherFy + firstClipFy;

    const belayerOnGround = belayer.y <= floorY + belayerRadius + 1e-6;
    if (belayerOnGround && belayerFy < 0) {
      belayerFy = 0;
      if (belayer.vy < 0) belayer.vy = 0;
      belayer.y = floorY + belayerRadius;
    }

    const ayC = climberFy / params.climberMass;
    const axC = climberFx / params.climberMass;
    const ayB = belayerFy / params.belayerMass;
    const axB = belayerFx / params.belayerMass;

    climber.vx = clamp(climber.vx + axC * dt, -25, 25);
    climber.vy = clamp(climber.vy + ayC * dt, -35, 20);
    belayer.vx = clamp(belayer.vx + axB * dt, -12, 12);
    belayer.vy = clamp(belayer.vy + ayB * dt, -20, 20);
    climber.x += climber.vx * dt; climber.y += climber.vy * dt;
    belayer.x += belayer.vx * dt; belayer.y += belayer.vy * dt;

    let climberWallContact = false, climberGroundContact = false, belayerWallContact = false, belayerGroundContact = false;
    if (climber.x < wallX + climberRadius) { climber.x = wallX + climberRadius; if (climber.vx < 0) climber.vx = 0; climberWallContact = true; }
    if (climber.y < floorY + climberRadius) { climber.y = floorY + climberRadius; if (climber.vy < 0) climber.vy = 0; climberGroundContact = true; }
    if (belayer.x < wallX + belayerRadius) { belayer.x = wallX + belayerRadius; if (belayer.vx < 0) belayer.vx = 0; belayerWallContact = true; }
    if (belayer.y < floorY + belayerRadius) { belayer.y = floorY + belayerRadius; if (belayer.vy < 0) belayer.vy = 0; belayerGroundContact = true; }

    const minSpacing = climberRadius + belayerRadius;
    const dxCB = climber.x - belayer.x;
    const dyCB = climber.y - belayer.y;
    const distCB = Math.hypot(dxCB, dyCB);
    let bodyContact = false;
    if (distCB > 1e-6 && distCB < minSpacing) {
      const nx = dxCB / distCB, ny = dyCB / distCB;
      const overlap = minSpacing - distCB;
      climber.x += nx * overlap * 0.5; climber.y += ny * overlap * 0.5;
      belayer.x -= nx * overlap * 0.5; belayer.y -= ny * overlap * 0.5;
      bodyContact = true;
    }

    climber.x = Math.max(climber.x, wallX + climberRadius);
    climber.y = Math.max(climber.y, floorY + climberRadius);
    belayer.x = Math.max(belayer.x, wallX + belayerRadius);
    belayer.y = Math.max(belayer.y, floorY + belayerRadius);

    const anchorLoad = T1 + T2;
    maxClimberForce = Math.max(maxClimberForce, T1);
    maxBelayerLoad = Math.max(maxBelayerLoad, T2);
    maxAnchorLoad = Math.max(maxAnchorLoad, anchorLoad);
    const climberBottom = climber.y - climberRadius;
    minClimberY = Math.min(minClimberY, climberBottom);
    minGroundClearance = Math.min(minGroundClearance, climberBottom - floorY);
    maxBelayerY = Math.max(maxBelayerY, belayer.y - belayerRadius);
    maxDecel = Math.max(maxDecel, Math.max(0, -ayC / g));

    frames.push({
      t,
      climber: { ...climber },
      belayer: { ...belayer },
      clip: draws[draws.length - 1] || { x: wallX, y: params.lastClipHeight },
      draws,
      drawDetails: ropeModel.drawDetails,
      tauTotal: ropeModel.tauTotal,
      totalPathLength: ropeModel.totalPathLength,
      effectiveRopeLength: ropeModel.effectiveRopeLength,
      effectiveParticipatingLength,
      T1, T2, anchorLoad, ext,
      minClimberY,
      groundClearance: climberBottom - floorY,
      contacts: { climberWallContact, climberGroundContact, belayerWallContact, belayerGroundContact, bodyContact },
      radii: { climberRadius, belayerRadius },
      ropeLoaded: T1 > 50,
    });
  }

  const avgDrawTheta = lastRopeModel.drawDetails.length
    ? lastRopeModel.drawDetails.reduce((s, d) => s + d.theta, 0) / lastRopeModel.drawDetails.length
    : 0;
  const finalEffectiveParticipatingLength = Math.max(
    lastRopeModel.effectiveRopeLength,
    params.ropeOut * clamp(0.55 + 0.45 * lastRopeModel.tauTotal, 0.45, 1)
  );
  const metrics = deriveMetrics(params, {
    maxClimberForce,
    maxBelayerLoad,
    maxAnchorLoad,
    minClimberY,
    minGroundClearance,
    maxBelayerY,
    ropeLoadedAt,
    k: ropeStiffness(params, finalEffectiveParticipatingLength),
    maxDecel,
    drawCount: draws.length,
    totalPathLength: lastRopeModel.totalPathLength,
    effectiveRopeLength: lastRopeModel.effectiveRopeLength,
    effectiveParticipatingLength: finalEffectiveParticipatingLength,
    tauTotal: lastRopeModel.tauTotal,
    avgDrawTheta,
  });
  return { frames, metrics };
}
