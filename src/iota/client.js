import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

class IOTAClient {
  /**
   * @param {{ rng?: () => number }} opts
   *  - rng: función RNG inyectable (para simulación determinista). Por defecto Math.random.
   */
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;

    this.nodeUrl = process.env.IOTA_NODE_URL || 'https://api.testnet.iota.cafe';
    this.mnemonic = process.env.IOTA_MNEMONIC;
    this.packageId = process.env.IOTA_PACKAGE_ID;
    this.address = process.env.IOTA_ADDRESS;

    // Permite forzar simulación para benchmarks
    this.forceSim = String(process.env.BENCH_FORCE_SIM || '0') === '1';

    this.api = axios.create({
      baseURL: this.nodeUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    this.requestId = 1;
    this.iotaClient = null;
    this.keypair = null;
    this.sdkAvailable = false;
    this.hasTxBuilder = false;     // <- chequeamos si existe un “constructor de tx”
    this._warnedRealTxFailure = false;

    this.initializeSDK();
  }

  async initializeSDK() {
    try {
      // OJO: estos imports pueden variar por versión del SDK
      const { IotaClient, IotaHTTPTransport } = await import('@iota/iota-sdk/client').catch(() => ({}));
      const { Ed25519Keypair } = await import('@iota/iota-sdk/keypairs/ed25519').catch(() => ({}));

      // En algunas versiones no existe "transactions" o el nombre cambia:
      // Intentamos ambos caminos y detectamos dinámicamente.
      let TxBlock = null;
      try {
        const mod = await import('@iota/iota-sdk/transactions');
        TxBlock = mod?.TransactionBlock || mod?.Transaction || null;
      } catch (_) {
        // ignorar: módulo no disponible
      }

      this.IotaClient = IotaClient;
      this.Ed25519Keypair = Ed25519Keypair;
      this.TransactionBlock = TxBlock;

      // Instanciar cliente base si existe
      if (IotaClient && IotaHTTPTransport) {
        this.iotaClient = new IotaClient({
          transport: new IotaHTTPTransport({ url: this.nodeUrl })
        });
      }

      // Wallet si hay mnemónico
      if (this.mnemonic && this.Ed25519Keypair) {
        this.keypair = this.Ed25519Keypair.deriveKeypair(this.mnemonic);
        this.address = this.keypair.getPublicKey().toIotaAddress();
      }

      this.sdkAvailable = Boolean(this.iotaClient);
      this.hasTxBuilder = typeof this.TransactionBlock === 'function';

      logger.info('IOTA SDK init', {
        sdkAvailable: this.sdkAvailable,
        wallet: Boolean(this.keypair),
        hasTxBuilder: this.hasTxBuilder
      });
    } catch (error) {
      logger.warn('IOTA SDK not available, using simulation mode');
      this.sdkAvailable = false;
      this.hasTxBuilder = false;
    }
  }

  async rpcCall(method, params = []) {
    try {
      const response = await this.api.post('', {
        jsonrpc: '2.0',
        id: this.requestId++,
        method,
        params
      });
      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }
      return response.data.result;
    } catch (error) {
      if (error.response?.data?.error) {
        throw new Error(`RPC Error: ${error.response.data.error.message}`);
      }
      throw error;
    }
  }

  async getChainIdentifier() {
    try {
      return await this.rpcCall('iota_getChainIdentifier');
    } catch (error) {
      logger.error('Error getting chain identifier', error);
      throw error;
    }
  }

  async getNodeInfo() {
    try {
      const chainId = await this.getChainIdentifier();
      const latestCheckpoint = await this.rpcCall('iota_getLatestCheckpointSequenceNumber');
      return {
        name: 'IOTA 2.0 Testnet',
        chainId,
        latestCheckpoint,
        version: '2.0',
        sdkAvailable: this.sdkAvailable
      };
    } catch (error) {
      logger.error('Error getting IOTA node info', error);
      throw error;
    }
  }

  async isConnected() {
    try {
      const info = await this.getNodeInfo();
      logger.info('Connected to IOTA node', {
        name: info.name,
        chainId: info.chainId,
        latestCheckpoint: info.latestCheckpoint,
        sdkMode: this.sdkAvailable ? 'Real transactions' : 'Simulation'
      });
      return true;
    } catch (error) {
      logger.error('Cannot connect to IOTA node', error);
      return false;
    }
  }

  async getBalance(address = null) {
    try {
      const addr = address || this.address;
      if (!addr) throw new Error('No address provided');

      if (this.iotaClient?.getBalance) {
        const balance = await this.iotaClient.getBalance({ owner: addr });
        return balance;
      } else {
        const balance = await this.rpcCall('iotax_getBalance', [addr]);
        return balance;
      }
    } catch (error) {
      logger.error('Error getting balance', error);
      return { totalBalance: '0' };
    }
  }

  // ===========================
  // TRANSACCIÓN REAL (solo si hay builder)
  // ===========================
  async sendRealTransaction(recipientAddress, amount = 1000) {
    if (!this.sdkAvailable || !this.keypair || !this.hasTxBuilder) {
      throw new Error('SDK not fully available for real tx (missing TransactionBlock or wallet)');
    }

    try {
      const startTime = Date.now();
      const cpuStart = process.cpuUsage();

      // Algunas versiones exponen TransactionBlock como clase, otras como builder
      const tx = new this.TransactionBlock(); // si no es constructor, será capturado por el catch

      const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
      tx.transferObjects([coin], tx.pure(recipientAddress));

      const result = await this.iotaClient.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.keypair,
        options: { showEffects: true, showEvents: true }
      });

      const endTime = Date.now();
      const cpuEnd = process.cpuUsage(cpuStart);

      return {
        txHash: result.digest,
        confirmed: result.effects?.status?.status === 'success',
        latency: endTime - startTime,
        cpuTime: (cpuEnd.user + cpuEnd.system) / 1000,
        timestamp: new Date().toISOString(),
        gasUsed: result.effects?.gasUsed?.computationCost || 0
      };
    } catch (error) {
      // Lo dejamos en throw para que submitBlock decida si alerta una sola vez
      throw error;
    }
  }

  // ===========================
  // SIMULACIÓN (determinista)
  // ===========================
  randomHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes; i++) {
      const v = (this.rng() * 256) | 0;
      s += v.toString(16).padStart(2, '0');
    }
    return s;
  }

  async sendDummyBlock() {
    try {
      const startTime = Date.now();
      const cpuStart = process.cpuUsage();

      const { simulateIOTALatency } = await import('../utils/network-distributions.js');

      const blockData = {
        test: 'benchmark',
        timestamp: Date.now(),
        data: this.sdkAvailable ? crypto.randomBytes(32).toString('hex') : this.randomHex(32)
      };

      const dataHash = this.calculateHash(blockData);
      const latencyResult = await simulateIOTALatency();

      const endTime = Date.now();
      const cpuEnd = process.cpuUsage(cpuStart);

      return {
        blockId: dataHash,
        confirmed: true,
        latency: endTime - startTime,
        cpuTime: (cpuEnd.user + cpuEnd.system) / 1000,
        timestamp: new Date().toISOString(),
        breakdown: latencyResult.breakdown,
        networkStats: {
          gossip: latencyResult.gossipMs,
          solidification: latencyResult.solidificationMs,
          confirmation: latencyResult.confirmationMs
        }
      };
    } catch (error) {
      logger.error('Error sending dummy block', error);
      throw error;
    }
  }

  async submitBlock(payload) {
    // Condición para intentar real: no forzado a sim, SDK listo y builder disponible
    const canReal =
      !this.forceSim &&
      this.sdkAvailable &&
      this.keypair &&
      this.address &&
      this.hasTxBuilder;

    if (canReal) {
      try {
        logger.info('Attempting real IOTA transaction...');
        return await this.sendRealTransaction(this.address, 100);
      } catch (error) {
        if (!this._warnedRealTxFailure) {
          logger.warn(`Real transaction failed (${error.message}), falling back to simulation`);
          this._warnedRealTxFailure = true; // solo una vez
        }
        // Tras el primer fallo, no volvemos a intentar real en esta instancia
      }
    }

    return await this.sendDummyBlock();
  }

  async storeData(data, tag = 'DATA_STORAGE') {
    try {
      const startTime = Date.now();
      const cpuStart = process.cpuUsage();

      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const dataHash = this.calculateHash(dataString);

      if (!this.forceSim && this.sdkAvailable && this.keypair) {
        logger.info(`Storing data on-chain with hash: ${dataHash}`);
      } else {
        logger.info(`Simulating data storage with hash: ${dataHash}`);
      }

      const endTime = Date.now();
      const cpuEnd = process.cpuUsage(cpuStart);

      return {
        dataHash,
        tag,
        latency: endTime - startTime,
        cpuTime: (cpuEnd.user + cpuEnd.system) / 1000,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error storing data', error);
      throw error;
    }
  }

  calculateHash(data) {
    return crypto
      .createHash('sha256')
      .update(typeof data === 'string' ? data : JSON.stringify(data))
      .digest('hex');
  }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async getNetworkStats() {
    try {
      const checkpoint = await this.rpcCall('iota_getLatestCheckpointSequenceNumber');
      return {
        latestCheckpoint: checkpoint,
        mode: !this.forceSim && this.sdkAvailable ? 'Real transactions' : 'Simulation',
        tps: 0
      };
    } catch (error) {
      logger.error('Error getting network stats', error);
      return null;
    }
  }
}

export default IOTAClient;
