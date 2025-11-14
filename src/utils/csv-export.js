import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';

class CSVExporter {
  constructor() {
    this.resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async exportRawTransactions(data, testName, network) {
    const filename = path.join(
      this.resultsDir,
      `${testName}_${network}_raw_${Date.now()}.csv`
    );

    const csvWriter = createObjectCsvWriter({
      path: filename,
      header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'txHash', title: 'Transaction Hash' },
        { id: 'latency', title: 'Latency (ms)' },
        { id: 'gasUsed', title: 'Gas Used' },
        { id: 'gasCost', title: 'Gas Cost' },
        { id: 'success', title: 'Success' },
        { id: 'error', title: 'Error' },
        { id: 'cpuTime', title: 'CPU Time (μs)' }
      ]
    });

    await csvWriter.writeRecords(data);
    console.log(`✓ Raw data exported to: ${filename}`);
    return filename;
  }

  async exportSummary(summaries, testName) {
    const filename = path.join(
      this.resultsDir,
      `${testName}_summary_${Date.now()}.csv`
    );

    const csvWriter = createObjectCsvWriter({
      path: filename,
      header: [
        { id: 'network', title: 'Network' },
        { id: 'totalTx', title: 'Total Transactions' },
        { id: 'successRate', title: 'Success Rate (%)' },
        { id: 'avgLatency', title: 'Avg Latency (ms)' },
        { id: 'minLatency', title: 'Min Latency (ms)' },
        { id: 'maxLatency', title: 'Max Latency (ms)' },
        { id: 'p95Latency', title: 'P95 Latency (ms)' },
        { id: 'throughput', title: 'Throughput (TPS)' },
        { id: 'avgGas', title: 'Avg Gas Used' },
        { id: 'avgCpuTime', title: 'Avg CPU Time (μs)' }
      ]
    });

    const records = summaries.map(s => ({
      network: s.network,
      totalTx: s.summary.totalTransactions,
      successRate: s.summary.successRate.toFixed(2),
      avgLatency: s.summary.latency?.mean?.toFixed(2) || 'N/A',
      minLatency: s.summary.latency?.min?.toFixed(2) || 'N/A',
      maxLatency: s.summary.latency?.max?.toFixed(2) || 'N/A',
      p95Latency: s.summary.latency?.p95?.toFixed(2) || 'N/A',
      throughput: s.summary.throughput?.toFixed(2) || 'N/A',
      avgGas: s.summary.gas?.mean?.toFixed(0) || 'N/A',
      avgCpuTime: s.summary.cpu?.mean?.toFixed(2) || 'N/A'
    }));

    await csvWriter.writeRecords(records);
    console.log(`✓ Summary exported to: ${filename}`);
    return filename;
  }

  async exportComparison(sepoliaSummary, iotaSummary, testName) {
    const filename = path.join(
      this.resultsDir,
      `${testName}_comparison_${Date.now()}.csv`
    );

    const metrics = [
      {
        metric: 'Average Latency (ms)',
        sepolia: sepoliaSummary.latency?.mean?.toFixed(2) || 'N/A',
        iota: iotaSummary.latency?.mean?.toFixed(2) || 'N/A'
      },
      {
        metric: 'P95 Latency (ms)',
        sepolia: sepoliaSummary.latency?.p95?.toFixed(2) || 'N/A',
        iota: iotaSummary.latency?.p95?.toFixed(2) || 'N/A'
      },
      {
        metric: 'Throughput (TPS)',
        sepolia: sepoliaSummary.throughput?.toFixed(2) || 'N/A',
        iota: iotaSummary.throughput?.toFixed(2) || 'N/A'
      },
      {
        metric: 'Success Rate (%)',
        sepolia: sepoliaSummary.successRate?.toFixed(2) || 'N/A',
        iota: iotaSummary.successRate?.toFixed(2) || 'N/A'
      },
      {
        metric: 'Avg Gas/Cost',
        sepolia: sepoliaSummary.gas?.mean?.toFixed(0) || 'N/A',
        iota: '0 (Feeless)'
      }
    ];

    const csvWriter = createObjectCsvWriter({
      path: filename,
      header: [
        { id: 'metric', title: 'Metric' },
        { id: 'sepolia', title: 'Sepolia' },
        { id: 'iota', title: 'IOTA' }
      ]
    });

    await csvWriter.writeRecords(metrics);
    console.log(`✓ Comparison exported to: ${filename}`);
    return filename;
  }
}

export default new CSVExporter();