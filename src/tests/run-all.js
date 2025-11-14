import { spawn } from 'child_process';
import logger from '../utils/logger.js';

const tests = [
  { name: 'Latency', file: 'latency.test.js', duration: '~20 min' },
  { name: 'Throughput', file: 'throughput.test.js', duration: '~5 min' },
  { name: 'Scalability', file: 'scalability.test.js', duration: '~15 min' },
  { name: 'Gas Costs', file: 'gas-costs.test.js', duration: '~10 min' },
  { name: 'Storage', file: 'storage.test.js', duration: '~5 min' },
  { name: 'Data Integrity', file: 'data-integrity.test.js', duration: '~2 min' }
];

function runTest(testFile) {
  return new Promise((resolve, reject) => {
    const testProcess = spawn('node', [`src/tests/${testFile}`], {
      stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test failed with code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      reject(error);
    });
  });
}

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 RUNNING ALL BENCHMARK TESTS');
  console.log('='.repeat(80) + '\n');

  logger.info('Test Suite:');
  tests.forEach((test, index) => {
    logger.info(`  ${index + 1}. ${test.name} - Est. ${test.duration}`);
  });

  const totalEstimatedTime = '~60 minutes';
  logger.warn(`\nTotal estimated time: ${totalEstimatedTime}`);
  logger.warn('Make sure you have sufficient ETH in your Sepolia wallet!\n');

  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();
  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    
    console.log('\n' + '='.repeat(80));
    console.log(`📊 TEST ${i + 1}/${tests.length}: ${test.name.toUpperCase()}`);
    console.log('='.repeat(80) + '\n');

    try {
      await runTest(test.file);
      results.push({ name: test.name, status: 'SUCCESS' });
      logger.success(`${test.name} test completed`);
    } catch (error) {
      results.push({ name: test.name, status: 'FAILED', error: error.message });
      logger.error(`${test.name} test failed: ${error.message}`);
    }

    // Pausa entre tests
    if (i < tests.length - 1) {
      logger.info('\nWaiting 10 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000 / 60).toFixed(2);

  // Resumen final
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80) + '\n');

  logger.info('Test Results:');
  results.forEach((result, index) => {
    const status = result.status === 'SUCCESS' ? '✅' : '❌';
    logger.info(`  ${status} ${index + 1}. ${result.name}: ${result.status}`);
    if (result.error) {
      logger.error(`     Error: ${result.error}`);
    }
  });

  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  const failCount = results.filter(r => r.status === 'FAILED').length;

  console.log('\n' + '-'.repeat(80));
  logger.result('Total Tests', tests.length);
  logger.result('Successful', successCount);
  logger.result('Failed', failCount);
  logger.result('Total Time', `${totalTime} minutes`);
  console.log('='.repeat(80) + '\n');

  logger.success('All tests completed!');
  logger.info('Results are available in the ./results directory\n');
}

runAllTests().catch(error => {
  logger.error('Test suite failed', error);
  process.exit(1);
});