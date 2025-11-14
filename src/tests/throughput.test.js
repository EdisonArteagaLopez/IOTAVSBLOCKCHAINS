import EthereumClient from '../ethereum/client.js';
import IOTAClient from '../iota/client.js';
import MetricsCollector from '../utils/metrics.js';
import logger from '../utils/logger.js';
import csvExporter from '../utils/csv-export.js';

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;

async function testSepoliaThroughput() {
  logger.test('Throughput Test', 'Sepolia');
  
  const client = new EthereumClient();
  const metrics = new MetricsCollector();
  
  const connected = await client.isConnected();
  if (!connected) {
    logger.error('Cannot connect to Sepolia');
    return null;
  }

  if (!client.wallet) {
    logger.warn('Wallet not configured. Skipping throughput test.');
    return null;
  }

  logger.info(`Sending ${BATCH_SIZE} transactions in parallel...`);
  
  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    const promise = client.sendTransaction(client.wallet.address, '0.0001')
      .then(result => {
        metrics.recordTransaction({
          txHash: result.hash,
          latency: result.latency,
          gasUsed: parseInt(result.gasUsed),
          gasCost: parseFloat(result.gasCost),
          cpuTime: result.cpuTime,
          success: result.status
        });
        
        logger.info(`[${metrics.metrics.length}/${BATCH_SIZE}] TX: ${result.hash.substring(0, 10)}...`);
        return result;
      })
      .catch(error => {
        logger.error(`Transaction failed: ${error.message}`);
        metrics.recordTransaction({
          success: false,
          error: error.message
        });
      });
    
    promises.push(promise);
  }

  await Promise.all(promises);
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000; // en segundos

  const summary = metrics.getSummary();
  const tps = summary.totalTransactions / totalTime;

  logger.separator();
  logger.result('Total Transactions', summary.totalTransactions);
  logger.result('Total Time', `${totalTime.toFixed(2)}s`);
  logger.result('Throughput (TPS)', tps.toFixed(2));
  logger.result('Success Rate', `${summary.successRate.toFixed(2)}%`);
  
  if (summary.latency) {
    logger.result('Average Latency', `${summary.latency.mean.toFixed(2)}ms`);
  }
  
  if (summary.gas) {
    logger.result('Average Gas Used', summary.gas.mean.toFixed(0));
  }

  return {
    network: 'Sepolia',
    summary: {
      ...summary,
      throughput: tps,
      totalTime
    },
    metrics: metrics.exportMetrics()
  };
}

async function testIOTAThroughput() {
  logger.test('Throughput Test', 'IOTA');
  
  const client = new IOTAClient();
  const metrics = new MetricsCollector();
  
  const connected = await client.isConnected();
  if (!connected) {
    logger.error('Cannot connect to IOTA');
    return null;
  }

  logger.info(`Sending ${BATCH_SIZE} blocks in parallel...`);
  
  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    const promise = client.submitBlock({
      tag: 'THROUGHPUT_TEST',
      data: {
        test: 'throughput',
        iteration: i + 1,
        timestamp: Date.now()
      }
    })
      .then(result => {
        metrics.recordTransaction({
          txHash: result.blockId,
          latency: result.latency,
          cpuTime: result.cpuTime,
          success: result.confirmed,
          gasUsed: 0,
          gasCost: 0
        });
        
        logger.info(`[${metrics.metrics.length}/${BATCH_SIZE}] Block: ${result.blockId.substring(0, 10)}...`);
        return result;
      })
      .catch(error => {
        logger.error(`Block failed: ${error.message}`);
        metrics.recordTransaction({
          success: false,
          error: error.message
        });
      });
    
    promises.push(promise);
  }

  await Promise.all(promises);
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000; // en segundos

  const summary = metrics.getSummary();
  const tps = summary.totalTransactions / totalTime;

  logger.separator();
  logger.result('Total Blocks', summary.totalTransactions);
  logger.result('Total Time', `${totalTime.toFixed(2)}s`);
  logger.result('Throughput (TPS)', tps.toFixed(2));
  logger.result('Success Rate', `${summary.successRate.toFixed(2)}%`);
  
  if (summary.latency) {
    logger.result('Average Latency', `${summary.latency.mean.toFixed(2)}ms`);
  }
  
  logger.result('Gas Cost', '0 (Feeless)');

  return {
    network: 'IOTA',
    summary: {
      ...summary,
      throughput: tps,
      totalTime
    },
    metrics: metrics.exportMetrics()
  };
}

async function runThroughputTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 THROUGHPUT BENCHMARK TEST');
  console.log('='.repeat(70) + '\n');
  
  const results = [];
  
  // Test Sepolia
  try {
    const sepoliaResult = await testSepoliaThroughput();
    if (sepoliaResult) {
      results.push(sepoliaResult);
    }
  } catch (error) {
    logger.error('Sepolia test failed', error);
  }
  
  console.log('\n' + '-'.repeat(70) + '\n');
  
  // Test IOTA
  try {
    const iotaResult = await testIOTAThroughput();
    if (iotaResult) {
      results.push(iotaResult);
    }
  } catch (error) {
    logger.error('IOTA test failed', error);
  }
  
  // Exportar resultados
  if (results.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 EXPORTING RESULTS');
    console.log('='.repeat(70) + '\n');
    
    await csvExporter.exportSummary(results, 'throughput');
    
    for (const result of results) {
      await csvExporter.exportRawTransactions(
        result.metrics.rawData,
        'throughput',
        result.network.toLowerCase()
      );
    }
    
    if (results.length === 2) {
      await csvExporter.exportComparison(
        results[0].summary,
        results[1].summary,
        'throughput'
      );
    }
  }
  
  console.log('\n✅ Throughput test completed!\n');
}

runThroughputTest().catch(console.error);