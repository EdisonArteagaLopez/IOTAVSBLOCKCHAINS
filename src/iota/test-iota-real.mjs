import dotenv from "dotenv";
import { ethers } from "ethers";
import axios from "axios";

dotenv.config();

// === CONFIG ACTUALIZADA ===
const RPC_URL = "https://json-rpc.evm.testnet.iota.cafe";
const FAUCET_URL = "https://faucet.evm.testnet.iota.cafe/api/enqueue";
const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;
const SEND_AMOUNT = process.env.EVM_AMOUNT || "0.001";

if (!PRIVATE_KEY) throw new Error("Falta EVM_PRIVATE_KEY en .env");

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("============================================================");
  console.log("🚀 IOTA EVM TESTNET — Prueba real con cuenta 0x");
  console.log("============================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("✅ Conectado al RPC:", RPC_URL);
  console.log("👛 Dirección:", wallet.address);
  console.log("🔗 Explorer:", `https://explorer.evm.testnet.iota.cafe/address/${wallet.address}`);

  // 💧 Faucet
  console.log("\n💧 Solicitando fondos al faucet...");
  try {
    const res = await axios.post(FAUCET_URL, { address: wallet.address });
    console.log("✅ Faucet OK:", res.statusText);
  } catch (err) {
    console.error("⚠️ Faucet falló:", err.response?.statusText || err.message);
  }

  console.log("⏳ Esperando 20 segundos para que lleguen los fondos...");
  await sleep(20000);

  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Balance actual:", ethers.formatEther(balance), "IOTA-EVM");

  if (balance === 0n) {
    console.log("⚠️ Aún sin fondos. Revisa el faucet o espera unos minutos.");
    return;
  }

  // 📤 Self-transfer
  console.log(`\n📤 Enviando self-transfer de ${SEND_AMOUNT} tokens...`);
  const tx = await wallet.sendTransaction({
    to: wallet.address,
    value: ethers.parseEther(SEND_AMOUNT),
  });

  console.log("🧱 TX Hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Confirmada en bloque:", receipt.blockNumber);
  console.log("🔗 Explorer TX:", `https://explorer.evm.testnet.iota.cafe/tx/${tx.hash}`);
}

main().catch(err => {
  console.error("❌ Error fatal:", err.message);
  process.exit(1);
});
