// Utilidades de distribuciones estadísticas para simulación realista de redes DLT

// Box-Muller: genera números aleatorios con distribución normal
function randn() {
  let u = 1 - Math.random();
  let v = 1 - Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Distribución log-normal (para latencias de red)
function lognormal({medianMs, p95Ms}) {
  const mu = Math.log(medianMs);
  const z95 = 1.6448536269514722;
  const sigma = (Math.log(p95Ms) - mu) / z95;
  const val = Math.exp(mu + sigma * randn());
  return Math.max(1, val);
}

// Distribución normal truncada
function truncatedNormal({mean, sd, min = 0, max = Infinity}) {
  for (let i = 0; i < 10; i++) {
    const x = mean + sd * randn();
    if (x >= min && x <= max) return x;
  }
  return Math.min(max, Math.max(min, mean));
}

// Distribución geométrica (para bloques hasta inclusión)
function geometricBlocks(p) {
  let k = 1;
  while (Math.random() > p) k++;
  return k;
}

// Distribución Gamma (Marsaglia-Tsang)
function gamma({shape, scale}) {
  let k = shape, theta = scale;
  
  if (k < 1) {
    const u = Math.random();
    return gamma({shape: k + 1, scale: theta}) * Math.pow(u, 1/k);
  }
  
  const d = k - 1/3, c = 1/Math.sqrt(9*d);
  
  while (true) {
    let x = randn();
    let v = (1 + c*x);
    if (v <= 0) continue;
    v = v*v*v;
    let u = Math.random();
    if (u < 1 - 0.331 * Math.pow(x, 4)) return d * v * theta;
    if (Math.log(u) < 0.5*x*x + d*(1 - v + Math.log(v))) return d * v * theta;
  }
}

// Simula spikes ocasionales en la latencia
function maybeSpike(ms, {spikeProb = 0.02, spikeMin = 300, spikeMax = 1200} = {}) {
  if (Math.random() < spikeProb) {
    return ms + (spikeMin + Math.random() * (spikeMax - spikeMin));
  }
  return ms;
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateEthereumLatency({
  inclusionProbPerBlock = 0.8,
  blockTimeMs = 12000,
  softConfirmBlocks = 1
} = {}) {
  const start = Date.now();
  
  let rtt = lognormal({medianMs: 90, p95Ms: 250});
  rtt = maybeSpike(rtt, {spikeProb: 0.01, spikeMin: 400, spikeMax: 1500});
  await sleep(rtt);
  
  const blocksToInclusion = geometricBlocks(inclusionProbPerBlock);
  const inclusionDelay = blocksToInclusion * blockTimeMs;
  await sleep(inclusionDelay);
  
  const confirmDelay = softConfirmBlocks * blockTimeMs;
  await sleep(confirmDelay);
  
  return {
    networkRttMs: Math.round(rtt),
    blocksToInclusion,
    inclusionDelayMs: inclusionDelay,
    confirmDelayMs: confirmDelay,
    totalMs: Date.now() - start,
    breakdown: {
      rtt: Math.round(rtt),
      inclusion: inclusionDelay,
      confirmation: confirmDelay
    }
  };
}

async function simulateIOTALatency() {
  const start = Date.now();
  
  let gossip = lognormal({medianMs: 70, p95Ms: 180});
  gossip = maybeSpike(gossip, {spikeProb: 0.01, spikeMin: 200, spikeMax: 800});
  await sleep(gossip);
  
  const solid = truncatedNormal({mean: 180, sd: 60, min: 80, max: 400});
  await sleep(solid);
  
  const confirm = gamma({shape: 3, scale: 270});
  await sleep(confirm);
  
  return {
    gossipMs: Math.round(gossip),
    solidificationMs: Math.round(solid),
    confirmationMs: Math.round(confirm),
    totalMs: Date.now() - start,
    breakdown: {
      gossip: Math.round(gossip),
      solidification: Math.round(solid),
      confirmation: Math.round(confirm)
    }
  };
}

export {
  randn,
  lognormal,
  truncatedNormal,
  geometricBlocks,
  gamma,
  maybeSpike,
  sleep,
  simulateEthereumLatency,
  simulateIOTALatency
};
