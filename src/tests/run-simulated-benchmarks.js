// src/tests/run-simulated-benchmarks.js
import EthereumClient from '../ethereum/client.js';
import IOTAClient from '../iota/client.js';
import MetricsCollector from '../utils/metrics.js';
import logger from '../utils/logger.js';
import csvExporter from '../utils/csv-export.js';
import seedrandom from 'seedrandom';

// ============================
// Parámetros
// ============================
const REPLICATIONS = Number(process.env.BENCH_REPLICATIONS || 30);
const SEED_START   = Number(process.env.BENCH_SEED_START   || 1);

// Config del benchmark base
const CONFIG = {
  latency: { iterations: 100 },
  throughput: { batchSize: 1000 },
  scalability: { batchSizes: [10, 100, 1000, 10000] },
  gasCosts: { iterations: 50 }
};

// ============================
// Utilidades RNG / Estadística
// ============================
function withSeed(seed, fn) {
  const rng = seedrandom(String(seed));
  const original = Math.random;
  Math.random = rng;
  return Promise.resolve().then(fn).finally(() => { Math.random = original; });
}

const Z95 = 1.96;
function mean(arr) { return arr.reduce((a,b)=>a+b,0)/arr.length; }
function sampleVariance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((acc,x)=>acc + (x-m)**2, 0)/(arr.length-1);
}
function ci95_normal(arr) {
  const n = arr.length;
  const m = mean(arr);
  const s2 = sampleVariance(arr);
  const s = Math.sqrt(s2);
  const half = Z95 * (s / Math.sqrt(n));
  return { n, mean: m, variance: s2, std: s, ci95_normal: [m-half, m+half] };
}
function pushMetric(bag, key, value) {
  if (value == null || Number.isNaN(value)) return;
  if (!bag[key]) bag[key] = [];
  bag[key].push(Number(value));
}
const fmt = (x, d=2) => (typeof x === 'number' ? x.toFixed(d) : x);

// ============================
// TEST 1: LATENCIA (Simulado)
// ============================
async function testLatencySimulated() {
  const results = [];

  // Sepolia
  const ethClient = new EthereumClient();
  const ethMetrics = new MetricsCollector();
  for (let i = 0; i < CONFIG.latency.iterations; i++) {
    try {
      const r = await ethClient.simulateTransaction('0x0000000000000000000000000000000000000000');
      ethMetrics.recordTransaction({
        txHash: r.hash, latency: r.latency, gasUsed: r.gasUsed,
        cpuTime: r.cpuTime, success: r.success
      });
    } catch (e) {
      ethMetrics.recordTransaction({ success:false, error:e.message });
    }
  }
  const ethSummary = ethMetrics.getSummary();
  results.push({ network: 'Sepolia', summary: ethSummary, metrics: ethMetrics.exportMetrics() });

  // IOTA
  const iotaClient = new IOTAClient();
  await iotaClient.isConnected();
  const iotaMetrics = new MetricsCollector();
  for (let i = 0; i < CONFIG.latency.iterations; i++) {
    try {
      const r = await iotaClient.submitBlock({ tag:'LATENCY_TEST', data:{ iteration:i } });
      iotaMetrics.recordTransaction({
        txHash: r.blockId, latency: r.latency, cpuTime: r.cpuTime, success: r.confirmed, gasUsed:0
      });
    } catch (e) {
      iotaMetrics.recordTransaction({ success:false, error:e.message });
    }
  }
  const iotaSummary = iotaMetrics.getSummary();
  results.push({ network: 'IOTA', summary: iotaSummary, metrics: iotaMetrics.exportMetrics() });

  // CSV resumen de esta corrida
  await csvExporter.exportSummary(results, 'latency_simulated');
  return results;
}

// ============================
// TEST 2: THROUGHPUT (Simulado)
// ============================
async function testThroughputSimulated() {
  const results = [];

  // Sepolia
  const ethClient = new EthereumClient();
  const ethMetrics = new MetricsCollector();
  const ethStart = Date.now();
  const ethPromises = [];
  for (let i = 0; i < CONFIG.throughput.batchSize; i++) {
    const p = ethClient.simulateTransaction('0x0000000000000000000000000000000000000000')
      .then(r => ethMetrics.recordTransaction({
        txHash: r.hash, latency: r.latency, gasUsed: r.gasUsed,
        cpuTime: r.cpuTime, success: r.success
      }))
      .catch(e => ethMetrics.recordTransaction({ success:false, error:e.message }));
    ethPromises.push(p);
  }
  await Promise.all(ethPromises);
  const ethTotalTime = (Date.now() - ethStart)/1000;
  const ethSummary = ethMetrics.getSummary();
  const ethTps = ethSummary.totalTransactions / ethTotalTime;
  results.push({
    network:'Sepolia',
    summary: { ...ethSummary, throughput: ethTps, totalTime: ethTotalTime },
    metrics: ethMetrics.exportMetrics()
  });

  // IOTA
  const iotaClient = new IOTAClient();
  await iotaClient.isConnected();
  const iotaMetrics = new MetricsCollector();
  const iotaStart = Date.now();
  const iotaPromises = [];
  for (let i = 0; i < CONFIG.throughput.batchSize; i++) {
    const p = iotaClient.submitBlock({ tag:'THROUGHPUT_TEST', data:{ iteration:i } })
      .then(r => iotaMetrics.recordTransaction({
        txHash: r.blockId, latency: r.latency, cpuTime: r.cpuTime,
        success: r.confirmed, gasUsed:0
      }))
      .catch(e => iotaMetrics.recordTransaction({ success:false, error:e.message }));
    iotaPromises.push(p);
  }
  await Promise.all(iotaPromises);
  const iotaTotalTime = (Date.now() - iotaStart)/1000;
  const iotaSummary = iotaMetrics.getSummary();
  const iotaTps = iotaSummary.totalTransactions / iotaTotalTime;
  results.push({
    network:'IOTA',
    summary: { ...iotaSummary, throughput: iotaTps, totalTime: iotaTotalTime },
    metrics: iotaMetrics.exportMetrics()
  });

  // CSV
  await csvExporter.exportSummary(results, 'throughput_simulated');
  await csvExporter.exportComparison(results[0].summary, results[1].summary, 'throughput_simulated');
  return results;
}

// ============================
// TEST 3: ESCALABILIDAD (Simulado)
// ============================
async function testScalabilitySimulated() {
  const results = { sepolia: [], iota: [] };

  // Sepolia
  const ethClient = new EthereumClient();
  for (const batchSize of CONFIG.scalability.batchSizes) {
    const metrics = new MetricsCollector();
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const p = ethClient.simulateTransaction('0x0000000000000000000000000000000000000000')
        .then(r => metrics.recordTransaction({
          txHash:r.hash, latency:r.latency, gasUsed:r.gasUsed, cpuTime:r.cpuTime, success:r.success
        }))
        .catch(e => metrics.recordTransaction({ success:false, error:e.message }));
      promises.push(p);
    }
    await Promise.all(promises);
    const totalTime = (Date.now() - start)/1000;
    const s = metrics.getSummary();
    const tps = s.totalTransactions / totalTime;
    results.sepolia.push({ batchSize, tps, totalTime, avgLatency: s.latency.mean, successRate: s.successRate });
  }

  // IOTA
  const iotaClient = new IOTAClient();
  await iotaClient.isConnected();
  for (const batchSize of CONFIG.scalability.batchSizes) {
    const metrics = new MetricsCollector();
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const p = iotaClient.submitBlock({ tag:'SCALABILITY_TEST', data:{ iteration:i, batchSize } })
        .then(r => metrics.recordTransaction({
          txHash:r.blockId, latency:r.latency, cpuTime:r.cpuTime, success:r.confirmed, gasUsed:0
        }))
        .catch(e => metrics.recordTransaction({ success:false, error:e.message }));
      promises.push(p);
    }
    await Promise.all(promises);
    const totalTime = (Date.now() - start)/1000;
    const s = metrics.getSummary();
    const tps = s.totalTransactions / totalTime;
    results.iota.push({ batchSize, tps, totalTime, avgLatency: s.latency.mean, successRate: s.successRate });
  }

  // CSV simple por corrida
  const { createObjectCsvWriter } = await import('csv-writer');
  const path = await import('path');
  const fs = await import('fs');
  const resultsDir = path.join(process.cwd(), 'results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
  const csvWriter = createObjectCsvWriter({
    path: path.join(resultsDir, `scalability_simulated_${Date.now()}.csv`),
    header: [
      { id:'batchSize', title:'Batch Size' },
      { id:'sepolia_tps', title:'Sepolia TPS' },
      { id:'sepolia_latency', title:'Sepolia Latency (ms)' },
      { id:'iota_tps', title:'IOTA TPS' },
      { id:'iota_latency', title:'IOTA Latency (ms)' }
    ]
  });
  const rows = CONFIG.scalability.batchSizes.map((size, idx)=>({
    batchSize:size,
    sepolia_tps: fmt(results.sepolia[idx].tps),
    sepolia_latency: fmt(results.sepolia[idx].avgLatency),
    iota_tps: fmt(results.iota[idx].tps),
    iota_latency: fmt(results.iota[idx].avgLatency)
  }));
  await csvWriter.writeRecords(rows);

  return results;
}

// ============================
// Suite 1 corrida (usada dentro de cada réplica)
// ============================
async function runAllSimulatedTests() {
  const latency = await testLatencySimulated();
  const throughput = await testThroughputSimulated();
  const scalability = await testScalabilitySimulated();
  return { latency, throughput, scalability };
}

// ============================
// Réplicas + IC95(normal) + CSV + Reporte HTML con gráficos SVG
// ============================
async function runReplicatedSuite(replications = REPLICATIONS, { seedStart = SEED_START } = {}) {
  console.log('\n' + '='.repeat(80));
  console.log(`🧪 RUNNING REPLICATED SUITE: ${replications} seeds (start=${seedStart})`);
  console.log('='.repeat(80) + '\n');

  // muestras por métrica
  const samples = {
    latency: { Sepolia:{}, IOTA:{} },             // avgLatency, p95Latency, successRate
    throughput: { Sepolia:{}, IOTA:{} },          // tps, avgLatency, successRate
    scalability: { sepolia:{}, iota:{} }          // por batch: tps, avgLatency, successRate
  };

  const seeds = Array.from({ length: replications }, (_, i) => i + seedStart);

  for (const [idx, seed] of seeds.entries()) {
    console.log(`\n🔁 Replication ${idx+1}/${replications} (seed=${seed})`);
    await withSeed(seed, async () => {
      const res = await runAllSimulatedTests();

      // ----- LATENCY
      for (const entry of res.latency) {
        const net = entry.network; // 'Sepolia' | 'IOTA'
        const s = entry.summary;
        pushMetric(samples.latency[net], 'avgLatency', s?.latency?.mean);
        pushMetric(samples.latency[net], 'p95Latency', s?.latency?.p95);
        pushMetric(samples.latency[net], 'successRate', s?.successRate);
      }

      // ----- THROUGHPUT
      for (const entry of res.throughput) {
        const net = entry.network;
        const s = entry.summary;
        pushMetric(samples.throughput[net], 'tps', s?.throughput);
        pushMetric(samples.throughput[net], 'avgLatency', s?.latency?.mean);
        pushMetric(samples.throughput[net], 'successRate', s?.successRate);
      }

      // ----- SCALABILITY
      for (const [netKey, arr] of Object.entries(res.scalability)) {
        for (const row of arr) {
          const key = `batch_${row.batchSize}`;
          if (!samples.scalability[netKey][key]) samples.scalability[netKey][key] = {};
          pushMetric(samples.scalability[netKey][key], 'tps', row.tps);
          pushMetric(samples.scalability[netKey][key], 'avgLatency', row.avgLatency);
          pushMetric(samples.scalability[netKey][key], 'successRate', row.successRate);
        }
      }
    });
  }

  // ---- Estadísticas IC95(normal)
  const stats = { latency:{}, throughput:{}, scalability:{} };

  for (const section of ['latency','throughput']) {
    stats[section] = {};
    for (const net of Object.keys(samples[section])) {
      stats[section][net] = {};
      for (const metric of Object.keys(samples[section][net])) {
        const arr = samples[section][net][metric];
        const c = ci95_normal(arr);
        stats[section][net][metric] = { ...c };
      }
    }
  }

  stats.scalability = {};
  for (const netKey of Object.keys(samples.scalability)) {
    stats.scalability[netKey] = {};
    for (const batchKey of Object.keys(samples.scalability[netKey])) {
      stats.scalability[netKey][batchKey] = {};
      for (const metric of Object.keys(samples.scalability[netKey][batchKey])) {
        const arr = samples.scalability[netKey][batchKey][metric];
        const c = ci95_normal(arr);
        stats.scalability[netKey][batchKey][metric] = { ...c };
      }
    }
  }

  // ---- CSV por test
  await exportIC95Csvs(stats);

  // ---- HTML con gráficos SVG
  await exportHtmlReport(stats);

  // ---- Log compacto
  printSection('LATENCY (CI95 normal)', stats.latency, { avgLatency:' ms', p95Latency:' ms', successRate:' %' });
  printSection('THROUGHPUT (CI95 normal)', stats.throughput, { tps:' TPS', avgLatency:' ms', successRate:' %' });
  console.log('\nSCALABILITY (CI95 normal)\n' + '-'.repeat(70));
  for (const netKey of Object.keys(stats.scalability)) {
    console.log(`\n  ▶ ${netKey.toUpperCase()}`);
    for (const [batchKey, metrics] of Object.entries(stats.scalability[netKey])) {
      console.log(`    • ${batchKey}`);
      for (const [metric, o] of Object.entries(metrics)) {
        const unit = metric==='tps' ? ' TPS' : (metric==='avgLatency' ? ' ms' : (metric==='successRate' ? ' %' : ''));
        const [lo, hi] = o.ci95_normal;
        console.log(`      - ${metric}: mean=${fmt(o.mean)}${unit}, var=${fmt(o.variance)}${unit}^2, IC95=[${fmt(lo)}, ${fmt(hi)}]${unit} (n=${o.n})`);
      }
    }
  }

  return stats;
}

// ============================
// Export: CSVs IC95 (normal)
// ============================
async function exportIC95Csvs(stats) {
  try {
    const { createObjectCsvWriter } = await import('csv-writer');
    const path = await import('path');
    const fs = await import('fs');

    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
    const ts = Date.now();

    const mkWriter = (name) => createObjectCsvWriter({
      path: path.join(resultsDir, `${name}_${ts}.csv`),
      header: [
        { id:'section', title:'Section' },
        { id:'scope', title:'Scope' },
        { id:'metric', title:'Metric' },
        { id:'n', title:'N' },
        { id:'mean', title:'Mean' },
        { id:'variance', title:'Variance' },
        { id:'std', title:'Std' },
        { id:'ci95_lower', title:'CI95 Lower' },
        { id:'ci95_upper', title:'CI95 Upper' }
      ]
    });

    // LATENCY
    {
      const rows = [];
      for (const net of Object.keys(stats.latency)) {
        for (const metric of Object.keys(stats.latency[net])) {
          const s = stats.latency[net][metric];
          rows.push({
            section:'latency', scope:net, metric,
            n:s.n, mean:s.mean, variance:s.variance, std:s.std,
            ci95_lower:s.ci95_normal[0], ci95_upper:s.ci95_normal[1]
          });
        }
      }
      const w = await mkWriter('ci95_normal_latency');
      await w.writeRecords(rows);
      logger.success(`CSV IC95 (normal) LATENCY exportado`);
    }

    // THROUGHPUT
    {
      const rows = [];
      for (const net of Object.keys(stats.throughput)) {
        for (const metric of Object.keys(stats.throughput[net])) {
          const s = stats.throughput[net][metric];
          rows.push({
            section:'throughput', scope:net, metric,
            n:s.n, mean:s.mean, variance:s.variance, std:s.std,
            ci95_lower:s.ci95_normal[0], ci95_upper:s.ci95_normal[1]
          });
        }
      }
      const w = await mkWriter('ci95_normal_throughput');
      await w.writeRecords(rows);
      logger.success(`CSV IC95 (normal) THROUGHPUT exportado`);
    }

    // SCALABILITY
    {
      const rows = [];
      for (const netKey of Object.keys(stats.scalability)) {
        for (const batchKey of Object.keys(stats.scalability[netKey])) {
          for (const metric of Object.keys(stats.scalability[netKey][batchKey])) {
            const s = stats.scalability[netKey][batchKey][metric];
            rows.push({
              section:'scalability',
              scope:`${netKey}:${batchKey}`,
              metric, n:s.n, mean:s.mean, variance:s.variance, std:s.std,
              ci95_lower:s.ci95_normal[0], ci95_upper:s.ci95_normal[1]
            });
          }
        }
      }
      const w = await mkWriter('ci95_normal_scalability');
      await w.writeRecords(rows);
      logger.success(`CSV IC95 (normal) SCALABILITY exportado`);
    }
  } catch (e) {
    logger.error('CSV export (IC95 normal) failed', e);
  }
}

// ============================
// Export: HTML con gráficos SVG
// ============================
async function exportHtmlReport(stats) {
  const path = await import('path');
  const fs = await import('fs');
  const resultsDir = path.join(process.cwd(), 'results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
  const ts = Date.now();
  const out = path.join(resultsDir, `report_ci95_normal_${ts}.html`);

  // ---- Helpers para SVG
  const esc = (s) => String(s).replace(/[<&>]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  function barSvg(data, { width=640, height=360, padding=50, unit='' } = {}) {
    // data: [{label, mean, lo, hi}]
    const labels = data.map(d=>d.label);
    const maxVal = Math.max(...data.map(d=>d.hi));
    const minVal = Math.min(0, ...data.map(d=>d.lo));
    const plotW = width - padding*2;
    const plotH = height - padding*2;
    const n = data.length;
    const barW = plotW / (n*1.5);
    const x = (i)=> padding + (i+0.5)* (plotW/n);
    const y = (v)=> padding + plotH - ( (v-minVal)/(maxVal-minVal || 1) )*plotH;

    const bars = data.map((d, i) => {
      const x0 = x(i) - barW/2;
      const yM = y(d.mean);
      const y0 = y(0);
      const h  = Math.abs(yM - y0);
      const top = Math.min(yM, y0);
      const yLo = y(d.lo), yHi = y(d.hi);
      return `
        <rect x="${x0}" y="${top}" width="${barW}" height="${h}" fill="rgba(33,150,243,0.85)"></rect>
        <line x1="${x(i)}" y1="${yLo}" x2="${x(i)}" y2="${yHi}" stroke="#111" stroke-width="2"/>
        <line x1="${x(i)-barW*0.35}" y1="${yLo}" x2="${x(i)+barW*0.35}" y2="${yLo}" stroke="#111" stroke-width="2"/>
        <line x1="${x(i)-barW*0.35}" y1="${yHi}" x2="${x(i)+barW*0.35}" y2="${yHi}" stroke="#111" stroke-width="2"/>
        <text x="${x(i)}" y="${height-padding+18}" font-size="12" text-anchor="middle">${esc(labels[i])}</text>
        <text x="${x(i)}" y="${top-6}" font-size="11" text-anchor="middle">${fmt(d.mean)}</text>
      `;
    }).join('\n');

    // axis
    return `
<svg width="${width}" height="${height}" role="img" aria-label="bar chart">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#fff" stroke="#eee"/>
  <line x1="${padding}" y1="${height-padding}" x2="${width-padding}" y2="${height-padding}" stroke="#444"/>
  <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height-padding}" stroke="#444"/>
  ${bars}
  <text x="${padding}" y="${padding-10}" font-size="13" text-anchor="start">${esc(unit)}</text>
</svg>`;
  }

  function lineBandSvg(seriesMap, { width=720, height=420, padding=50, unit='', title='' } = {}) {
    // seriesMap: { name: [{x, mean, lo, hi}], ... }
    const allPts = Object.values(seriesMap).flat();
    const xs = [...new Set(allPts.map(p=>p.x))].sort((a,b)=>a-b);
    const maxY = Math.max(...allPts.map(p=>p.hi));
    const minY = Math.min(0, ...allPts.map(p=>p.lo));
    const plotW = width - padding*2;
    const plotH = height - padding*2;
    const xScale = (v)=> padding + ( (v - xs[0]) / ((xs[xs.length-1]-xs[0]) || 1) )*plotW;
    const yScale = (v)=> padding + plotH - ( (v - minY) / ((maxY-minY) || 1) )*plotH;

    const colors = ['#1e88e5','#43a047','#f4511e','#6d4c41','#8e24aa'];

    const groupsSvg = Object.entries(seriesMap).map(([name, pts], idx) => {
      const color = colors[idx % colors.length];
      const sorted = pts.sort((a,b)=>a.x-b.x);
      const line = sorted.map(p=> `${xScale(p.x)},${yScale(p.mean)}`).join(' ');
      const topBand = sorted.map(p=> `${xScale(p.x)},${yScale(p.hi)}`).join(' ');
      const botBand = sorted.slice().reverse().map(p=> `${xScale(p.x)},${yScale(p.lo)}`).join(' ');
      const legendsY = padding - 28 + (idx*14);
      return `
        <polyline fill="none" stroke="${color}" stroke-width="2" points="${line}"></polyline>
        <polygon fill="${color}22" stroke="none" points="${topBand} ${botBand}"></polygon>
        ${sorted.map(p=>`<circle cx="${xScale(p.x)}" cy="${yScale(p.mean)}" r="3" fill="${color}"></circle>`).join('')}
        <text x="${padding+10}" y="${legendsY}" font-size="12" fill="${color}">● ${esc(name)}</text>
      `;
    }).join('\n');

    // x ticks
    const xTicks = xs.map(v => `<text x="${xScale(v)}" y="${height-padding+18}" font-size="12" text-anchor="middle">${v}</text>`).join('\n');

    return `
<svg width="${width}" height="${height}" role="img" aria-label="line chart with CI band">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#fff" stroke="#eee"/>
  <line x1="${padding}" y1="${height-padding}" x2="${width-padding}" y2="${height-padding}" stroke="#444"/>
  <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height-padding}" stroke="#444"/>
  ${groupsSvg}
  ${xTicks}
  <text x="${padding}" y="${padding-10}" font-size="13" text-anchor="start">${esc(unit)}</text>
  ${title ? `<text x="${width/2}" y="24" font-size="16" text-anchor="middle">${esc(title)}</text>` : ''}
</svg>`;
  }

  // ---- Datos para gráficos
  const latencyAvg = [
    { label:'Sepolia', mean: stats.latency.Sepolia?.avgLatency?.mean ?? 0,
      lo: stats.latency.Sepolia?.avgLatency?.ci95_normal?.[0] ?? 0,
      hi: stats.latency.Sepolia?.avgLatency?.ci95_normal?.[1] ?? 0 },
    { label:'IOTA', mean: stats.latency.IOTA?.avgLatency?.mean ?? 0,
      lo: stats.latency.IOTA?.avgLatency?.ci95_normal?.[0] ?? 0,
      hi: stats.latency.IOTA?.avgLatency?.ci95_normal?.[1] ?? 0 }
  ];
  const latencyP95 = [
    { label:'Sepolia', mean: stats.latency.Sepolia?.p95Latency?.mean ?? 0,
      lo: stats.latency.Sepolia?.p95Latency?.ci95_normal?.[0] ?? 0,
      hi: stats.latency.Sepolia?.p95Latency?.ci95_normal?.[1] ?? 0 },
    { label:'IOTA', mean: stats.latency.IOTA?.p95Latency?.mean ?? 0,
      lo: stats.latency.IOTA?.p95Latency?.ci95_normal?.[0] ?? 0,
      hi: stats.latency.IOTA?.p95Latency?.ci95_normal?.[1] ?? 0 }
  ];
  const thrTps = [
    { label:'Sepolia', mean: stats.throughput.Sepolia?.tps?.mean ?? 0,
      lo: stats.throughput.Sepolia?.tps?.ci95_normal?.[0] ?? 0,
      hi: stats.throughput.Sepolia?.tps?.ci95_normal?.[1] ?? 0 },
    { label:'IOTA', mean: stats.throughput.IOTA?.tps?.mean ?? 0,
      lo: stats.throughput.IOTA?.tps?.ci95_normal?.[0] ?? 0,
      hi: stats.throughput.IOTA?.tps?.ci95_normal?.[1] ?? 0 }
  ];

  const seriesScalTps = {};
  for (const netKey of Object.keys(stats.scalability)) {
    const name = netKey.toUpperCase();
    seriesScalTps[name] = [];
    const entries = Object.entries(stats.scalability[netKey]);
    for (const [batchKey, o] of entries) {
      const batch = Number(String(batchKey).replace('batch_',''));
      const c = o?.tps;
      if (!c) continue;
      seriesScalTps[name].push({ x: batch, mean: c.mean, lo: c.ci95_normal[0], hi: c.ci95_normal[1] });
    }
    seriesScalTps[name].sort((a,b)=>a.x-b.x);
  }

  const seriesScalLat = {};
  for (const netKey of Object.keys(stats.scalability)) {
    const name = netKey.toUpperCase();
    seriesScalLat[name] = [];
    for (const [batchKey, o] of Object.entries(stats.scalability[netKey])) {
      const batch = Number(String(batchKey).replace('batch_',''));
      const c = o?.avgLatency;
      if (!c) continue;
      seriesScalLat[name].push({ x: batch, mean: c.mean, lo: c.ci95_normal[0], hi: c.ci95_normal[1] });
    }
    seriesScalLat[name].sort((a,b)=>a.x-b.x);
  }

  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<title>Benchmark Report (CI95 normal)</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial; margin:24px; color:#111}
  h1{margin:0 0 8px 0} h2{margin:28px 0 6px}
  .card{border:1px solid #eee; border-radius:12px; padding:16px; margin:12px 0; box-shadow:0 1px 2px rgba(0,0,0,0.03)}
  .row{display:flex; gap:20px; flex-wrap:wrap}
  .col{flex:1 1 640px}
  code{background:#f6f8fa; padding:2px 6px; border-radius:6px}
  table{border-collapse:collapse; width:100%}
  th,td{border:1px solid #eee; padding:8px 10px; text-align:right}
  th:first-child, td:first-child{text-align:left}
</style>
<body>
<h1>Benchmark Report <small style="font-size:60%;color:#666">IC 95% (normal)</small></h1>

<div class="row">
  <div class="card col">
    <h2>Latency (mean, ms) — CI95</h2>
    ${barSvg(latencyAvg, { unit:'ms' })}
  </div>
  <div class="card col">
    <h2>Latency (P95, ms) — CI95</h2>
    ${barSvg(latencyP95, { unit:'ms' })}
  </div>
</div>

<div class="card">
  <h2>Throughput (TPS) — CI95</h2>
  ${barSvg(thrTps, { unit:'TPS', width:720 })}
</div>

<div class="card">
  <h2>Scalability — TPS vs Batch (CI95)</h2>
  ${lineBandSvg(seriesScalTps, { unit:'TPS', title:'TPS vs Batch' })}
</div>

<div class="card">
  <h2>Scalability — Avg Latency vs Batch (CI95)</h2>
  ${lineBandSvg(seriesScalLat, { unit:'ms', title:'Latency vs Batch' })}
</div>

</body>
</html>`;

  await fs.promises.writeFile(out, html, 'utf-8');
  logger.success(`HTML report (CI95 normal) -> ${out}`);
}

// ============================
// Pretty print
// ============================
function printSection(title, obj, units = {}) {
  console.log(`\n${title}\n${'-'.repeat(70)}`);
  for (const k1 of Object.keys(obj)) {
    console.log(`\n  ▶ ${k1}`);
    for (const k2 of Object.keys(obj[k1])) {
      const o = obj[k1][k2];
      const unit = units[k2] || '';
      const [lo, hi] = o.ci95_normal || [NaN, NaN];
      console.log(`    - ${k2}: mean=${fmt(o.mean)}${unit}, var=${fmt(o.variance)}${unit}^2, IC95=[${fmt(lo)}, ${fmt(hi)}]${unit} (n=${o.n})`);
    }
  }
}

// ============================
// Arranque
// ============================
runReplicatedSuite(REPLICATIONS, { seedStart: SEED_START }).catch(err => {
  logger.error('Replicated suite failed', err);
  process.exit(1);
});
