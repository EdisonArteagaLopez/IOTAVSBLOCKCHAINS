// src/evm/shimmer-evm-test.mjs
import 'dotenv/config';
import { ethers } from 'ethers';

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 SHIMMER EVM TESTNET — Self Transfer');
  console.log('='.repeat(60) + '\n');

  const RPC_URL = process.env.SHIMMEREVM_RPC || 'https://json-rpc.evm.testnet.shimmer.network';
  const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;   // 0x... (NUNCA lo subas a git)
  const AMOUNT_ETH = process.env.EVM_AMOUNT || '0.001'; // SMR (equivalente EVM), expresado en ETH units

  if (!PRIVATE_KEY) {
    throw new Error('Falta EVM_PRIVATE_KEY en tu .env');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  console.log('RPC:', RPC_URL);
  console.log('Network chainId:', Number(network.chainId)); // Shimmer EVM testnet suele ser 1073

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log('Address:', wallet.address);

  const beforeBal = await provider.getBalance(wallet.address);
  console.log('Balance antes:', ethers.formatEther(beforeBal), 'SMR');

  const valueWei = ethers.parseEther(AMOUNT_ETH);

  console.log(`\n== Enviando ${AMOUNT_ETH} SMR a mí mismo ==`);
  const t0 = Date.now();
  const tx = await wallet.sendTransaction({
    to: wallet.address,
    value: valueWei,
  });
  console.log('TX hash:', tx.hash);
  console.log('Explorer:', `https://explorer.evm.testnet.shimmer.network/tx/${tx.hash}`);

  const receipt = await tx.wait(); // espera a minado
  const latencyMs = Date.now() - t0;

  const afterBal = await provider.getBalance(wallet.address);
  const gasUsed = receipt.gasUsed; // BigInt
  const effGasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice ?? 0n; // BigInt
  const gasCostWei = gasUsed * effGasPrice;

  console.log('\n--- RESULTADOS ---');
  console.log('Status:', receipt.status === 1 ? '✅ success' : '❌ failed');
  console.log('Block:', receipt.blockNumber);
  console.log('Gas used:', gasUsed.toString());
  console.log('Eff. gas price (wei):', effGasPrice.toString());
  console.log('Gas cost (SMR):', ethers.formatEther(gasCostWei));
  console.log('Latencia (ms):', latencyMs);
  console.log('Explorer:', `https://explorer.evm.testnet.shimmer.network/tx/${tx.hash}`);

  console.log('\nBalances:');
  console.log('  Antes:', ethers.formatEther(beforeBal), 'SMR');
  console.log('  Después:', ethers.formatEther(afterBal), 'SMR');
}

main().catch((e) => {
  console.error('❌ Error:', e?.message ?? e);
  process.exit(1);
});
