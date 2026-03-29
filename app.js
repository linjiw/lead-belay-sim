import { simulate } from './physics.js';
import { fieldDefinitions, presets, defaultParams } from './presets.js';

const state = {
  params: defaultParams(),
  frames: [],
  result: null,
  playing: false,
  playIndex: 0,
};

const els = {
  controlsGrid: document.getElementById('controlsGrid'),
  summaryGrid: document.getElementById('summaryGrid'),
  states: document.getElementById('states'),
  preset: document.getElementById('preset'),
  runBtn: document.getElementById('runBtn'),
  resetBtn: document.getElementById('resetBtn'),
  timeline: document.getElementById('timeline'),
  timeLabel: document.getElementById('timeLabel'),
  frameLabel: document.getElementById('frameLabel'),
  statusPill: document.getElementById('statusPill'),
  canvas: document.getElementById('scene'),
};
const ctx = els.canvas.getContext('2d');

function setupPresetSelect() {
  Object.entries(presets).forEach(([key, preset]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = preset.label;
    els.preset.appendChild(opt);
  });
  els.preset.addEventListener('change', () => applyPreset(els.preset.value));
}

function buildControls() {
  els.controlsGrid.innerHTML = '';
  fieldDefinitions.forEach(([key, label, , min, max, step, unit]) => {
    const field = document.createElement('div');
    field.className = 'field';
    const title = document.createElement('label');
    title.textContent = label;
    field.appendChild(title);

    if (unit === 'bool') {
      const select = document.createElement('select');
      select.innerHTML = `<option value="1">是</option><option value="0">否</option>`;
      select.value = String(state.params[key]);
      select.addEventListener('change', () => { state.params[key] = Number(select.value); run(); });
      field.appendChild(select);
    } else {
      const range = document.createElement('input');
      range.type = 'range';
      range.min = min; range.max = max; range.step = step; range.value = state.params[key];
      const meta = document.createElement('div');
      meta.className = 'meta';
      const current = document.createElement('span');
      current.textContent = `${state.params[key]}${unit}`;
      const limits = document.createElement('span');
      limits.textContent = `${min}–${max}${unit}`;
      meta.append(current, limits);
      range.addEventListener('input', () => {
        state.params[key] = Number(range.value);
        current.textContent = `${state.params[key]}${unit}`;
      });
      range.addEventListener('change', run);
      field.append(range, meta);
    }
    els.controlsGrid.appendChild(field);
  });

  const anchorField = document.createElement('div');
  anchorField.className = 'field';
  anchorField.innerHTML = `<label>保护员约束模式</label>`;
  const anchorSelect = document.createElement('select');
  anchorSelect.innerHTML = `
    <option value="free">free</option>
    <option value="soft">soft tether</option>
    <option value="hard">hard tether</option>`;
  anchorSelect.value = state.params.anchorMode;
  anchorSelect.addEventListener('change', () => { state.params.anchorMode = anchorSelect.value; run(); });
  anchorField.appendChild(anchorSelect);
  els.controlsGrid.appendChild(anchorField);
}

function applyPreset(key) {
  state.params = { ...defaultParams(), ...presets[key].values };
  buildControls();
  run();
}

function renderSummary(metrics) {
  const items = [
    ['理论 Fall Factor', metrics.theoreticalFF.toFixed(2)],
    ['实际 Fall Factor', metrics.actualFF.toFixed(2)],
    ['Climber 峰值绳力', `${(metrics.maxClimberForce / 1000).toFixed(2)} kN`],
    ['Belayer 峰值受力', `${(metrics.maxBelayerLoad / 1000).toFixed(2)} kN`],
    ['Anchor 近似峰值', `${(metrics.maxAnchorLoad / 1000).toFixed(2)} kN`],
    ['最低点', `${metrics.lowestPoint.toFixed(2)} m`],
    ['Belayer 上提', `${metrics.belayerLift.toFixed(2)} m`],
    ['Catch softness', `${metrics.catchSoftness.toFixed(0)} / 100`],
    ['Ground fall', metrics.groundFall ? 'YES' : 'NO'],
    ['等效绳刚度', `${(metrics.k / 1000).toFixed(2)} kN/m`],
  ];
  els.summaryGrid.innerHTML = items.map(([label, value]) => `<div class="metric"><span class="label">${label}</span><div class="value">${value}</div></div>`).join('');

  const states = [
    {
      title: '冲坠严重度',
      text: metrics.actualFF > 0.9 ? '这是偏高 factor 的情形，系统余量明显更小。' : metrics.actualFF > 0.45 ? '中等 factor，软硬 catch 差别会很明显。' : '低到中低 factor，但仍可能因为首挂/低挂片问题接近地面。'
    },
    {
      title: '保护员—攀登者关系',
      text: state.params.belayerMass < state.params.climberMass ? '保护员更轻，通常更容易被带起，能降低峰值力，但低处冲坠更要防 ground fall。' : '保护员更重或更受限，通常更容易形成 hard catch，峰值力和 anchor load 往上走。'
    },
    {
      title: '绳线 / 快挂摩擦',
      text: state.params.frictionParticipation < 0.75 ? '当前设置让较少绳段参与伸长，等效系统更硬。' : '当前绳线较直、有效绳长较大，更容易出现位移大但力较缓的 catch。'
    },
    {
      title: '安全提醒',
      text: metrics.groundFall ? '当前参数出现 ground fall 判定。真实环境里这已经是高风险情形。' : '本次模拟未判定 ground fall，但这不等于现实一定安全。'
    }
  ];
  els.states.innerHTML = states.map(s => `<div class="stateCard"><strong>${s.title}</strong><div>${s.text}</div></div>`).join('');
}

function drawPerson(pt, color, r, highlight = false) {
  if (highlight) {
    ctx.fillStyle = 'rgba(255,123,123,0.16)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y - r * 1.6, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pt.x, pt.y - r);
  ctx.lineTo(pt.x, pt.y + r);
  ctx.moveTo(pt.x - r * 0.8, pt.y - r * 0.2);
  ctx.lineTo(pt.x + r * 0.8, pt.y - r * 0.2);
  ctx.moveTo(pt.x, pt.y + r);
  ctx.lineTo(pt.x - r * 0.7, pt.y + r * 1.8);
  ctx.moveTo(pt.x, pt.y + r);
  ctx.lineTo(pt.x + r * 0.7, pt.y + r * 1.8);
  ctx.stroke();
}

function draw(frame) {
  const { width, height } = els.canvas;
  ctx.clearRect(0, 0, width, height);

  const p = state.params;
  const scaleY = (height - 80) / Math.max(6, p.wallHeight);
  const scaleX = Math.min(180, width / 5.5);
  const ox = width * 0.22;
  const groundY = height - 50;
  const toCanvas = (pt) => ({ x: ox + pt.x * scaleX, y: groundY - pt.y * scaleY });
  const clip = toCanvas(frame.clip);
  const climber = toCanvas(frame.climber);
  const belayer = toCanvas(frame.belayer);
  const climberR = frame.radii ? frame.radii.climberRadius * scaleY : 12;
  const belayerR = frame.radii ? frame.radii.belayerRadius * scaleY : 12;

  ctx.strokeStyle = '#d4e2ff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(ox, groundY);
  ctx.lineTo(ox, groundY - p.wallHeight * scaleY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(190,220,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = 1; y <= p.wallHeight; y += 1.5) {
    ctx.beginPath();
    ctx.moveTo(ox - 10, groundY - y * scaleY);
    ctx.lineTo(ox + 10, groundY - y * scaleY);
    ctx.stroke();
  }

  ctx.fillStyle = '#5fd6ff';
  ctx.beginPath();
  ctx.arc(clip.x, clip.y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#8af4ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(belayer.x, belayer.y);
  ctx.lineTo(clip.x, clip.y);
  ctx.lineTo(climber.x, climber.y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,123,123,0.14)';
  ctx.fillRect(0, groundY - 36, width, 36);

  if (frame.contacts?.climberWallContact || frame.contacts?.climberGroundContact) {
    ctx.strokeStyle = 'rgba(255,123,123,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(climber.x, climber.y, climberR, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (frame.contacts?.belayerWallContact || frame.contacts?.belayerGroundContact) {
    ctx.strokeStyle = 'rgba(255,123,123,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(belayer.x, belayer.y, belayerR, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawPerson(belayer, '#7ee081', Math.max(10, belayerR * 0.7), frame.contacts?.belayerWallContact || frame.contacts?.belayerGroundContact || frame.contacts?.bodyContact);
  drawPerson(climber, '#ffcf66', Math.max(10, climberR * 0.7), frame.contacts?.climberWallContact || frame.contacts?.climberGroundContact || frame.contacts?.bodyContact);

  ctx.fillStyle = '#ecf2ff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`tension climber: ${(frame.T1 / 1000).toFixed(2)} kN`, width - 250, 30);
  ctx.fillText(`anchor load: ${(frame.anchorLoad / 1000).toFixed(2)} kN`, width - 250, 50);
  ctx.fillText(`extension: ${frame.ext.toFixed(2)} m`, width - 250, 70);
  ctx.fillText(`contacts: ${[
    frame.contacts?.climberWallContact ? 'C-wall' : null,
    frame.contacts?.climberGroundContact ? 'C-ground' : null,
    frame.contacts?.belayerWallContact ? 'B-wall' : null,
    frame.contacts?.belayerGroundContact ? 'B-ground' : null,
    frame.contacts?.bodyContact ? 'body' : null,
  ].filter(Boolean).join(', ') || 'none'}` , width - 250, 90);
  ctx.fillText(`rope loaded: ${frame.ropeLoaded ? 'yes' : 'no'}`, width - 250, 110);
  ctx.fillText(`clearance: ${frame.groundClearance.toFixed(2)} m`, width - 250, 130);
  ctx.fillText('ground', 12, groundY - 10);
}

function drawSeries(canvasCtx, canvas, frames, selector, color, currentIndex, opts = {}) {
  const { width, height } = canvas;
  canvasCtx.clearRect(0, 0, width, height);
  canvasCtx.fillStyle = '#0d1529';
  canvasCtx.fillRect(0, 0, width, height);
  const values = frames.map(selector);
  const minVal = opts.min ?? Math.min(...values);
  const maxVal = opts.max ?? Math.max(...values);
  const lo = Number.isFinite(minVal) ? minVal : 0;
  const hi = Number.isFinite(maxVal) && maxVal > lo ? maxVal : lo + 1;
  const pad = 24;
  canvasCtx.strokeStyle = 'rgba(255,255,255,0.12)';
  canvasCtx.lineWidth = 1;
  canvasCtx.beginPath();
  canvasCtx.moveTo(pad, height - pad);
  canvasCtx.lineTo(width - pad, height - pad);
  canvasCtx.moveTo(pad, pad);
  canvasCtx.lineTo(pad, height - pad);
  canvasCtx.stroke();
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  values.forEach((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - lo) / (hi - lo)) * (height - pad * 2);
    if (i === 0) canvasCtx.moveTo(x, y); else canvasCtx.lineTo(x, y);
  });
  canvasCtx.stroke();
  const idx = Math.min(currentIndex, values.length - 1);
  const cx = pad + (idx / Math.max(1, values.length - 1)) * (width - pad * 2);
  const cy = height - pad - ((values[idx] - lo) / (hi - lo)) * (height - pad * 2);
  canvasCtx.fillStyle = color;
  canvasCtx.beginPath();
  canvasCtx.arc(cx, cy, 4, 0, Math.PI * 2);
  canvasCtx.fill();
  canvasCtx.fillStyle = '#dfe8ff';
  canvasCtx.font = '12px sans-serif';
  canvasCtx.fillText(`min ${lo.toFixed(2)}`, 8, height - 8);
  canvasCtx.fillText(`max ${hi.toFixed(2)}`, 8, 16);
}

function drawCharts(currentIndex = 0) {
  if (!state.frames.length) return;
  drawSeries(forceCtx, els.forceChart, state.frames, f => f.T1 / 1000, '#6ee7ff', currentIndex, { min: 0 });
  drawSeries(clearanceCtx, els.clearanceChart, state.frames, f => f.groundClearance, '#ffcf66', currentIndex);
  drawSeries(belayerCtx, els.belayerChart, state.frames, f => f.belayer.y - f.radii.belayerRadius, '#7ee081', currentIndex, { min: 0 });
}

function updateTimeline() {
  const i = Number(els.timeline.value || 0);
  const frame = state.frames[i] || state.frames[0];
  if (!frame) return;
  draw(frame);
  els.timeLabel.textContent = `t = ${frame.t.toFixed(2)} s`;
  els.frameLabel.textContent = `${i + 1} / ${state.frames.length}`;
}

function animate() {
  if (!state.playing) return;
  state.playIndex = (state.playIndex + 1) % state.frames.length;
  els.timeline.value = state.playIndex;
  updateTimeline();
  requestAnimationFrame(animate);
}

function run() {
  const { frames, metrics } = simulate(state.params);
  state.frames = frames;
  state.result = metrics;
  els.timeline.max = String(Math.max(frames.length - 1, 0));
  els.timeline.value = '0';
  renderSummary(metrics);
  updateTimeline();
  state.playIndex = 0;
  state.playing = true;
  els.statusPill.textContent = metrics.groundFall ? '发生 ground-fall' : '模拟完成';
  els.statusPill.style.color = metrics.groundFall ? '#ffb1b1' : '#b6ffcb';
  animate();
}

els.runBtn.addEventListener('click', run);
els.resetBtn.addEventListener('click', () => applyPreset('gymLowClipRisk'));
els.timeline.addEventListener('input', () => { state.playing = false; updateTimeline(); });

setupPresetSelect();
els.preset.value = 'gymLowClipRisk';
applyPreset('gymLowClipRisk');
