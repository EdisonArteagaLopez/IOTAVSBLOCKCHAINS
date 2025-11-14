import EthereumClient from './src/ethereum/client.js';
import IOTAClient from './src/iota/client.js';
import logger from './src/utils/logger.js';

async function testConnections() {
  console.log('\n🔌 Testing Network Connections...\n');
  
  // Test Ethereum/Sepolia
  logger.info('Testing Sepolia connection...');
  const ethClient = new EthereumClient();
  
  try {
    const ethConnected = await ethClient.isConnected();
    
    if (ethConnected) {
      logger.success('✓ Sepolia connection successful');
      
      // Obtener información adicional
      const balance = await ethClient.getBalance();
      logger.info(`  Balance: ${balance} ETH`);
      
      const gasPrice = await ethClient.getGasPrice();
      logger.info(`  Current Gas Price: ${gasPrice.gasPrice} wei`);
      
      const stats = await ethClient.getNetworkStats();
      logger.info(`  Current Block: ${stats.blockNumber}`);
    } else {
      logger.error('✗ Could not connect to Sepolia');
    }
  } catch (error) {
    logger.error('Error testing Sepolia connection', error);
  }
  
  logger.separator();
  
  // Test IOTA
  logger.info('Testing IOTA connection...');
  const iotaClient = new IOTAClient();
  
  try {
    const iotaConnected = await iotaClient.isConnected();
    
    if (iotaConnected) {
      logger.success('✓ IOTA connection successful');
      
      // Obtener información adicional
      const nodeInfo = await iotaClient.getNodeInfo();
      logger.info(`  Node: ${nodeInfo.name}`);
      logger.info(`  Version: ${nodeInfo.version}`);
      logger.info(`  Latest Milestone: ${nodeInfo.status?.latestMilestone?.index || 'N/A'}`);
      
      const stats = await iotaClient.getNetworkStats();
      if (stats) {
        logger.info(`  Blocks/sec: ${stats.blocksPerSecond}`);
        logger.info(`  Confirmed Blocks/sec: ${stats.confirmedBlocksPerSecond}`);
      }
    } else {
      logger.error('✗ Could not connect to IOTA');
    }
  } catch (error) {
    logger.error('Error testing IOTA connection', error);
  }
  
  console.log('\n✅ Connection tests completed!\n');
}

// Ejecutar tests
testConnections().catch(console.error);
