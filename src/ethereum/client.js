import { ethers } from 'ethers';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

class EthereumClient {
  constructor() {
    this.rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    if (process.env.SEPOLIA_PRIVATE_KEY) {
      this.wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, this.provider);
    }
    
    this.address = process.env.SEPOLIA_ADDRESS;
  }

  async getBlockNumber() {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      logger.error('Error getting block number', error);
      throw error;
    }
  }

  async isConnected() {
    try {
      const blockNumber = await this.getBlockNumber();
      const network = await this.provider.getNetwork();
      
      logger.info('Connected to Ethereum network', {
        network: network.name,
        chainId: network.chainId.toString(),
        blockNumber
      });
      return true;
    } catch (error) {
      logger.error('Cannot connect to Ethereum network');
      return false;
    }
  }

  async getBalance(address = null) {
    try {
      const addr = address || this.address;
      const balance = await this.provider.getBalance(addr);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting balance', error);
      throw error;
    }
  }

  async getGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      return {
        gasPrice: feeData.gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      };
    } catch (error) {
      logger.error('Error getting gas price', error);
      throw error;
    }
  }

  async sendTransaction(to, valueInEth = '0.0001', customNonce = null) {
    if (!this.wallet) {
      throw new Error('Wallet not configured. Set SEPOLIA_PRIVATE_KEY in .env');
    }

    try {
      const startTime = Date.now();
      const cpuStart = process.cpuUsage();

      const nonce = customNonce !== null ? customNonce : await this.wallet.getNonce();

      const tx = await this.wallet.sendTransaction({
        to,
        value: ethers.parseEther(valueInEth),
        gasLimit: 21000,
        nonce
      });

      const sendTime = Date.now();
      const receipt = await tx.wait();
      const endTime = Date.now();
      const cpuEnd = process.cpuUsage(cpuStart);
      const cpuTime = (cpuEnd.user + cpuEnd.system) / 1000;

      const isSuccess = receipt.status === 1;
      
      if (!isSuccess) {
        logger.warn(`Transaction ${tx.hash} was reverted (status: 0)`);
      }

      return {
        hash: tx.hash,
        from: receipt.from,
        to: receipt.to,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice?.toString() || '0',
        gasCost: ethers.formatEther(
          BigInt(receipt.gasUsed) * (receipt.gasPrice || 0n)
        ),
        blockNumber: receipt.blockNumber,
        status: isSuccess,
        latency: endTime - startTime,
        sendLatency: sendTime - startTime,
        confirmLatency: endTime - sendTime,
        cpuTime,
        nonce,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error.receipt) {
        const endTime = Date.now();
        const cpuEnd = process.cpuUsage(cpuStart);
        
        logger.warn(`Transaction failed but was mined: ${error.receipt.hash}`);
        
        return {
          hash: error.receipt.hash,
          from: error.receipt.from,
          to: error.receipt.to,
          gasUsed: error.receipt.gasUsed.toString(),
          effectiveGasPrice: error.receipt.gasPrice?.toString() || '0',
          gasCost: ethers.formatEther(
            BigInt(error.receipt.gasUsed) * (error.receipt.gasPrice || 0n)
          ),
          blockNumber: error.receipt.blockNumber,
          status: false,
          latency: endTime - startTime,
          cpuTime: (cpuEnd.user + cpuEnd.system) / 1000,
          timestamp: new Date().toISOString(),
          error: 'Transaction reverted'
        };
      }
      
      logger.error('Error sending transaction', error);
      throw error;
    }
  }

  async simulateTransaction(to, valueInEth = '0.0001') {
    try {
      const startTime = Date.now();
      const cpuStart = process.cpuUsage();

      const { simulateEthereumLatency } = await import('../utils/network-distributions.js');

      const tx = {
        to,
        value: ethers.parseEther(valueInEth),
        gasLimit: 21000,
        nonce: Math.floor(Math.random() * 1000000)
      };

      const txData = ethers.Transaction.from(tx);
      const serialized = txData.unsignedSerialized;
      const txHash = ethers.keccak256(serialized);

      const latencyResult = await simulateEthereumLatency({
        inclusionProbPerBlock: 0.8,
        blockTimeMs: 12000,
        softConfirmBlocks: 1
      });

      const endTime = Date.now();
      const cpuEnd = process.cpuUsage(cpuStart);

      return {
        hash: txHash,
        simulated: true,
        gasUsed: 21000,
        gasCost: 0,
        latency: endTime - startTime,
        cpuTime: (cpuEnd.user + cpuEnd.system) / 1000,
        success: true,
        timestamp: new Date().toISOString(),
        breakdown: latencyResult.breakdown,
        networkStats: {
          rtt: latencyResult.networkRttMs,
          blocksToInclusion: latencyResult.blocksToInclusion,
          inclusionDelay: latencyResult.inclusionDelayMs,
          confirmDelay: latencyResult.confirmDelayMs
        }
      };
    } catch (error) {
      logger.error('Error in simulation', error);
      throw error;
    }
  }

  async storeData(data) {
    if (!this.wallet) {
      throw new Error('Wallet not configured');
    }

    try {
      const startTime = Date.now();
      const cpuStart = process.cpuUsage();

      const dataHex = ethers.hexlify(ethers.toUtf8Bytes(
        typeof data === 'string' ? data : JSON.stringify(data)
      ));

      const tx = await this.wallet.sendTransaction({
        to: this.address,
        value: 0,
        data: dataHex,
        gasLimit: 50000 + (dataHex.length * 16)
      });

      const sendTime = Date.now();
      const receipt = await tx.wait();
      const endTime = Date.now();
      const cpuEnd = process.cpuUsage(cpuStart);

      return {
        hash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        gasCost: ethers.formatEther(
          BigInt(receipt.gasUsed) * (receipt.gasPrice || 0n)
        ),
        dataSize: dataHex.length / 2,
        latency: endTime - startTime,
        cpuTime: (cpuEnd.user + cpuEnd.system) / 1000,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error storing data', error);
      throw error;
    }
  }

  async retrieveData(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      
      if (tx && tx.data && tx.data !== '0x') {
        const dataString = ethers.toUtf8String(tx.data);
        try {
          return JSON.parse(dataString);
        } catch {
          return dataString;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error retrieving data', error);
      throw error;
    }
  }

  async getNetworkStats() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const block = await this.provider.getBlock(blockNumber);
      const feeData = await this.provider.getFeeData();

      return {
        blockNumber,
        timestamp: block.timestamp,
        gasLimit: block.gasLimit.toString(),
        gasUsed: block.gasUsed.toString(),
        baseFeePerGas: block.baseFeePerGas?.toString() || '0',
        currentGasPrice: feeData.gasPrice?.toString() || '0'
      };
    } catch (error) {
      logger.error('Error getting network stats', error);
      return null;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default EthereumClient;
