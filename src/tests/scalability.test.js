import EthereumClient from '../ethereum/client.js';
import IOTAClient from '../iota/client.js';
import MetricsCollector from '../utils/metrics.js';
import logger from '../utils/logger.js';
import csvExporter from '../utils/csv-export.js';

const BATCH_SIZES = process.env.BATCH_SIZES 
  ? process.env.BATCH_SIZES.split(',').map(Number)
  : [10, 25, 50, 100];

async function testNetworkScalability(client, networkName, isEthereum = true) {
  logger.test('Scalability Test', networkName);
  
  const allResults = [];
  
  for (const batchSize of BATCH_SIZES) {
    logger.info(`\n📦 Testing with ${batchSize} transactions...`);
    
    const metrics = new MetricsCollector();
    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < batchSize; i++) {
      let promise;
      
      if (isEthereum) {
        if (!client.wallet) {
          logger.warn('Wallet not configured. Skipping.');
          continue;
        }
        promise = client.sendTransaction(client.wallet.address, '0.0001');
      } else {
        promise = client.submitBlock({
          tag: 'SCALABILITY_TEST',
          data: { iteration: i, batchSize }
        });
      }

      promise
        .then(result => {
          metrics.recordTransaction({
            txHash: result.hash || result.blockId,
            latency: result.latency,
            gasUsed: parseInt(result.gasUsed || 0),
            cpuTime: result.cpuTime,
            success: result.status || result.confirmed
          });
        })
        .catch(error => {
          metrics.recordTransaction({
            success: false,
            error: error.message
          });
        });
      
      promises.push(promise);
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;

    const summary = metrics.getSummary();
    const tps = summary.totalTransactions / totalTime;

    logger.result(`Batch Size: ${batchSize}`, '');
    logger.result('  TPS', tps.toFixed(2));
    logger.result('  Success Rate', `${summary.successRate.toFixed(2)}%`);
    logger.result('  Avg Latency', `${summary.latency?.mean?.toFixed(2) || 'N/A'}ms`);

    allResults.push({
      batchSize,
      tps,
      totalTime,
      successRate: summary.successRate,
      avgLatency: summary.latency?.mean || 0,
      totalTransactions: summary.totalTransactions
    });

    // Pausa entre batches
    if (batchSize < BATCH_SIZES[BATCH_SIZES.length - 1]) {
      logger.info('Waiting 5s before next batch...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  return allResults;
}

async function runScalabilityTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 SCALABILITY BENCHMARK TEST');
  console.log('='.repeat(70) + '\n');
  
  const results = {};
  
  // Test Sepolia
  logger.info('Testing Sepolia scalability...');
  try {
    const ethClient = new EthereumClient();
    const connected = await ethClient.isConnected();
    
    if (connected && ethClient.wallet) {
      results.sepolia = await testNetworkScalability(ethClient, 'Sepolia', true);
    } else {
      logger.warn('Sepolia wallet not configured, skipping');
    }
  } catch (error) {
    logger.error('Sepolia test failed', error);
  }
  
  console.log('\n' + '-'.repeat(70) + '\n');
  
  // Test IOTA
  logger.info('Testing IOTA scalability...');
  try {
    const iotaClient = new IOTAClient();
    const connected = await iotaClient.isConnected();
    
    if (connected) {
      results.iota = await testNetworkScalability(iotaClient, 'IOTA', false);
    }
  } catch (error) {
    logger.error('IOTA test failed', error);
  }
  
  // Exportar resultados
  console.log('\n' + '='.repeat(70));
  console.log('📊 EXPORTING RESULTS');
  console.log('='.repeat(70) + '\n');
  
  const csvData = [];
  
  BATCH_SIZES.forEach((batchSize, index) => {
    const row = { batchSize };
    
    if (results.sepolia?.[index]) {
      row.sepolia_tps = results.sepolia[index].tps.toFixed(2);
      row.sepolia_latency = results.sepolia[index].avgLatency.toFixed(2);
      row.sepolia_success = results.sepolia[index].successRate.toFixed(2);
    }
    
    if (results.iota?.[index]) {
      row.iota_tps = results.iota[index].tps.toFixed(2);
      row.iota_latency = results.iota[index].avgLatency.toFixed(2);
      row.iota_success = results.iota[index].successRate.toFixed(2);
    }
    
    csvData.push(row);
  });
  
  // Guardar CSV
  const { createObjectCsvWriter } = await import('csv-writer');
  const path = await import('path');
  const csvWriter = createObjectCsvWriter({
    path: path.join(process.cwd(), 'results', `scalability_${Date.now()}.csv`),
    header: [
      { id: 'batchSize', title: 'Batch Size' },
      { id: 'sepolia_tps', title: 'Sepolia TPS' },
      { id: 'sepolia_latency', title: 'Sepolia Latency (ms)' },
      { id: 'sepolia_success', title: 'Sepolia Success (%)' },
      { id: 'iota_tps', title: 'IOTA TPS' },
      { id: 'iota_latency', title: 'IOTA Latency (ms)' },
      { id: 'iota_success', title: 'IOTA Success (%)' }
    ]
  });
  
  await csvWriter.writeRecords(csvData);
  logger.success('Scalability results exported');
  
  console.log('\n✅ Scalability test completed!\n');
}

runScalabilityTest().catch(console.error);