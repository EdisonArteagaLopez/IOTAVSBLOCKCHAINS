import EthereumClient from '../ethereum/client.js';
import IOTAClient from '../iota/client.js';
import MetricsCollector from '../utils/metrics.js';
import logger from '../utils/logger.js';
import csvExporter from '../utils/csv-export.js';

const TEST_ITERATIONS = parseInt(process.env.TEST_ITERATIONS) || 50;

async function testSepoliaLatency() {
  logger.test('Latency Test', 'Sepolia');
  
  const client = new EthereumClient();
  const metrics = new MetricsCollector();
  
  // Verificar conexión
  const connected = await client.isConnected();
  if (!connected) {
    logger.error('Cannot connect to Sepolia');
    return null;
  }

  // Verificar que tenemos wallet configurada
  if (!client.wallet) {
    logger.warn('Wallet not configured. Skipping transaction tests.');
    logger.info('Only testing read operations...');
    
    // Test de latencia de lectura
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      try {
        const startTime = Date.now();
        await client.getBlockNumber();
        const latency = Date.now() - startTime;
        
        metrics.recordTransaction({
          latency,
          success: true,
          type: 'read'
        });
        
        logger.info(`[${i + 1}/${TEST_ITERATIONS}] Read latency: ${latency}ms`);
      } catch (error) {
        logger.error(`Read failed: ${error.message}`);
        metrics.recordTransaction({
          success: false,
          error: error.message
        });
      }
    }
  } else {
    // Test de latencia de transacciones
    logger.info(`Sending ${TEST_ITERATIONS} transactions...`);
    
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      try {
        // Usar una dirección de destino segura (dirección nula o propia wallet)
        const recipientAddress = client.wallet.address;
        
        const result = await client.sendTransaction(
          recipientAddress,
          '0.0001'
        );
        
        metrics.recordTransaction({
          txHash: result.hash,
          latency: result.latency,
          gasUsed: parseInt(result.gasUsed),
          gasCost: parseFloat(result.gasCost),
          cpuTime: result.cpuTime,
          success: result.status
        });
        
        logger.info(`[${i + 1}/${TEST_ITERATIONS}] TX: ${result.hash.substring(0, 10)}... | Latency: ${result.latency}ms | Gas: ${result.gasUsed}`);
        
        // Pequeña pausa para no saturar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        logger.error(`Transaction ${i + 1} failed: ${error.message}`);
        metrics.recordTransaction({
          success: false,
          error: error.message
        });
      }
    }
  }
  
  const summary = metrics.getSummary();
  
  logger.separator();
  logger.result('Total Transactions', summary.totalTransactions);
  logger.result('Success Rate', `${summary.successRate.toFixed(2)}%`);
  
  if (summary.latency) {
    logger.result('Average Latency', `${summary.latency.mean.toFixed(2)}ms`);
    logger.result('Min Latency', `${summary.latency.min.toFixed(2)}ms`);
    logger.result('Max Latency', `${summary.latency.max.toFixed(2)}ms`);
    logger.result('P95 Latency', `${summary.latency.p95.toFixed(2)}ms`);
  }
  
  if (summary.gas) {
    logger.result('Average Gas Used', summary.gas.mean.toFixed(0));
  }
  
  return { network: 'Sepolia', summary, metrics: metrics.exportMetrics() };
}

async function testIOTALatency() {
  logger.test('Latency Test', 'IOTA');
  
  const client = new IOTAClient();
  const metrics = new MetricsCollector();
  
  // Verificar conexión
  const connected = await client.isConnected();
  if (!connected) {
    logger.error('Cannot connect to IOTA');
    return null;
  }

  logger.info(`Sending ${TEST_ITERATIONS} blocks...`);
  
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    try {
      const result = await client.submitBlock({
        tag: 'LATENCY_TEST',
        data: {
          test: 'latency',
          iteration: i + 1,
          timestamp: Date.now()
        }
      });
      
      metrics.recordTransaction({
        txHash: result.blockId,
        latency: result.latency,
        cpuTime: result.cpuTime,
        success: result.confirmed,
        gasUsed: 0,
        gasCost: 0
      });
      
      logger.info(`[${i + 1}/${TEST_ITERATIONS}] Block: ${result.blockId.substring(0, 10)}... | Latency: ${result.latency}ms | Confirmed: ${result.confirmed}`);
      
      // Pequeña pausa
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      logger.error(`Block ${i + 1} failed: ${error.message}`);
      metrics.recordTransaction({
        success: false,
        error: error.message
      });
    }
  }
  
  const summary = metrics.getSummary();
  
  logger.separator();
  logger.result('Total Blocks', summary.totalTransactions);
  logger.result('Success Rate', `${summary.successRate.toFixed(2)}%`);
  
  if (summary.latency) {
    logger.result('Average Latency', `${summary.latency.mean.toFixed(2)}ms`);
    logger.result('Min Latency', `${summary.latency.min.toFixed(2)}ms`);
    logger.result('Max Latency', `${summary.latency.max.toFixed(2)}ms`);
    logger.result('P95 Latency', `${summary.latency.p95.toFixed(2)}ms`);
  }
  
  logger.result('Gas Cost', '0 (Feeless)');
  
  return { network: 'IOTA', summary, metrics: metrics.exportMetrics() };
}

async function runLatencyTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 LATENCY BENCHMARK TEST');
  console.log('='.repeat(70) + '\n');
  
  const results = [];
  
  // Test Sepolia
  try {
    const sepoliaResult = await testSepoliaLatency();
    if (sepoliaResult) {
      results.push(sepoliaResult);
    }
  } catch (error) {
    logger.error('Sepolia test failed', error);
  }
  
  console.log('\n' + '-'.repeat(70) + '\n');
  
  // Test IOTA
  try {
    const iotaResult = await testIOTALatency();
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
    
    await csvExporter.exportSummary(results, 'latency');
    
    // Exportar datos raw
    for (const result of results) {
      await csvExporter.exportRawTransactions(
        result.metrics.rawData,
        'latency',
        result.network.toLowerCase()
      );
    }
    
    // Comparación
    if (results.length === 2) {
      await csvExporter.exportComparison(
        results[0].summary,
        results[1].summary,
        'latency'
      );
    }
  }
  
  console.log('\n✅ Latency test completed!\n');
}

// Ejecutar test
runLatencyTest().catch(console.error);