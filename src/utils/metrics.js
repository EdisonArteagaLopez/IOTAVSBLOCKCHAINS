class MetricsCollector {
  constructor() {
    this.metrics = [];
  }

  recordTransaction(data) {
    this.metrics.push({
      timestamp: Date.now(),
      ...data
    });
  }

  calculateStats(values) {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: values.length
    };
  }

  getLatencyStats() {
    const latencies = this.metrics
      .filter(m => m.latency !== undefined)
      .map(m => m.latency);
    
    return this.calculateStats(latencies);
  }

  getThroughput(timeWindowMs) {
    if (this.metrics.length === 0) return 0;

    const firstTimestamp = this.metrics[0].timestamp;
    const lastTimestamp = this.metrics[this.metrics.length - 1].timestamp;
    const totalTime = (lastTimestamp - firstTimestamp) / 1000;

    return totalTime > 0 ? this.metrics.length / totalTime : 0;
  }

  getGasStats() {
    const gasUsed = this.metrics
      .filter(m => m.gasUsed !== undefined)
      .map(m => m.gasUsed);
    
    return this.calculateStats(gasUsed);
  }

  getSuccessRate() {
    const total = this.metrics.length;
    const successful = this.metrics.filter(m => m.success === true).length;
    
    return total > 0 ? (successful / total) * 100 : 0;
  }

  getCPUUsage() {
    const cpuTimes = this.metrics
      .filter(m => m.cpuTime !== undefined)
      .map(m => m.cpuTime);
    
    return this.calculateStats(cpuTimes);
  }

  clear() {
    this.metrics = [];
  }

  getSummary() {
    return {
      totalTransactions: this.metrics.length,
      successRate: this.getSuccessRate(),
      latency: this.getLatencyStats(),
      throughput: this.getThroughput(),
      gas: this.getGasStats(),
      cpu: this.getCPUUsage()
    };
  }

  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      summary: this.getSummary(),
      rawData: this.metrics
    };
  }
}

export default MetricsCollector;