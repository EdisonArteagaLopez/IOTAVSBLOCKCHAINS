import EthereumClient from '../ethereum/client.js';
import IOTAClient from '../iota/client.js';
import MetricsCollector from '../utils/metrics.js';
import logger from '../utils/logger.js';
import csvExporter from '../utils/csv-export.js';

const TEST_ITERATIONS = 20;

async function testSepoliaGasCosts() {
  logger.test('Gas Costs Test', 'Sepolia');
  
  const client = new EthereumClient();
  const metrics = new MetricsCollector();
  
  const connected = await client.isConnected();
  if (!connected || !client.wallet) {
    logger.warn('Cannot test Sepolia gas costs');
    return null;
  }

  logger.info('Testing different transaction types...\n');

  // 1. Transferencias simples
  logger.info('📤 Simple transfers...');
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    try {
      const result = await client.sendTransaction(client.wallet.address, '0.0001');
      
      metrics.recordTransaction({
        type: 'simple_transfer',
        txHash: result.hash,
        gasUsed: parseInt(result.gasUsed),
        gasCost: parseFloat(result.gasCost),
        gasPrice: result.effectiveGasPrice,
        success: result.status
      });
      
      logger.info(`  [${i+1}/${TEST_ITERATIONS}] Gas: ${result.gasUsed} | Cost: ${result.gasCost} ETH`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error(`Transfer failed: ${error.message}`);
    }
  }

  // 2. Transferencias con datos (más costosas)
  logger.info('\n📝 Transfers with data...');
  for (let i = 0; i < Math.min(5, TEST_ITERATIONS); i++) {
    try {
      const data = `Test data ${i}: ${Date.now()}`;
      const result = await client.storeData(data);
      
      metrics.recordTransaction({
        type: 'data_transfer',
        txHash: result.hash,
        gasUsed: parseInt(result.gasUsed),
        gasCost: parseFloat(result.gasCost),
        dataSize: result.dataSize,
        success: true
      });
      
      logger.info(`  [${i+1}/5] Gas: ${result.gasUsed} | Cost: ${result.gasCost} ETH | Size: ${result.dataSize} bytes`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error(`Data transfer failed: ${error.message}`);
    }
  }

  const summary = metrics.getSummary();
  
  // Separar por tipo
  const simpleTransfers = metrics.metrics.filter(m => m.type === 'simple_transfer');
  const dataTransfers = metrics.metrics.filter(m => m.type === 'data_transfer');

  logger.separator();
  logger.result('Simple Transfers', simpleTransfers.length);
  if (simpleTransfers.length > 0) {
    const avgGas = simpleTransfers.reduce((sum, t) => sum + t.gasUsed, 0) / simpleTransfers.length;
    const avgCost = simpleTransfers.reduce((sum, t) => sum + t.gasCost, 0) / simpleTransfers.length;
    logger.result('  Avg Gas', avgGas.toFixed(0));
    logger.result('  Avg Cost', `${avgCost.toFixed(6)} ETH`);
  }
  
  logger.result('Data Transfers', dataTransfers.length);
  if (dataTransfers.length > 0) {
    const avgGas = dataTransfers.reduce((sum, t) => sum + t.gasUsed, 0) / dataTransfers.length;
    const avgCost = dataTransfers.reduce((sum, t) => sum + t.gasCost, 0) / dataTransfers.length;
    logger.result('  Avg Gas', avgGas.toFixed(0));
    logger.result('  Avg Cost', `${avgCost.toFixed(6)} ETH`);
  }

  return {
    network: 'Sepolia',
    summary,
    simpleTransfers,
    dataTransfers,
    metrics: metrics.exportMetrics()
  };
}

async function testIOTACosts() {
  logger.test('Costs Test', 'IOTA');
  
  const client = new IOTAClient();
  const metrics = new MetricsCollector();
  
  const connected = await client.isConnected();
  if (!connected) {
    logger.error('Cannot connect to IOTA');
    return null;
  }

  logger.info('Testing IOTA operations (feeless)...\n');

  // IOTA es feeless, pero medimos CPU y latencia
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    try {
      const result = await client.submitBlock({
        tag: 'COST_TEST',
        data: { test: 'cost', iteration: i }
      });
      
      metrics.recordTransaction({
        txHash: result.blockId,
        latency: result.latency,
        cpuTime: result.cpuTime,
        success: result.confirmed,
        gasUsed: 0,
        gasCost: 0
      });
      
      logger.info(`  [${i+1}/${TEST_ITERATIONS}] CPU: ${result.cpuTime.toFixed(2)}μs | Latency: ${result.latency}ms`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      logger.error(`Block failed: ${error.message}`);
    }
  }

  const summary = metrics.getSummary();

  logger.separator();
  logger.result('Total Operations', summary.totalTransactions);
  logger.result('Success Rate', `${summary.successRate.toFixed(2)}%`);
  logger.result('Avg CPU Time', `${summary.cpu?.mean?.toFixed(2) || 0}μs`);
  logger.result('Transaction Cost', '0 ETH (Feeless)');

  return {
    network: 'IOTA',
    summary,
    metrics: metrics.exportMetrics()
  };
}

async function runGasCostsTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 GAS COSTS BENCHMARK TEST');
  console.log('='.repeat(70) + '\n');
  
  const results = [];
  
  // Test Sepolia
  try {
    const sepoliaResult = await testSepoliaGasCosts();
    if (sepoliaResult) {
      results.push(sepoliaResult);
    }
  } catch (error) {
    logger.error('Sepolia test failed', error);
  }
  
  console.log('\n' + '-'.repeat(70) + '\n');
  
  // Test IOTA
  try {
    const iotaResult = await testIOTACosts();
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
    
    await csvExporter.exportSummary(results, 'gas_costs');
    
    for (const result of results) {
      await csvExporter.exportRawTransactions(
        result.metrics.rawData,
        'gas_costs',
        result.network.toLowerCase()
      );
    }
    
    if (results.length === 2) {
      await csvExporter.exportComparison(
        results[0].summary,
        results[1].summary,
        'gas_costs'
      );
    }
  }
  
  console.log('\n✅ Gas costs test completed!\n');
}

runGasCostsTest().catch(console.error);