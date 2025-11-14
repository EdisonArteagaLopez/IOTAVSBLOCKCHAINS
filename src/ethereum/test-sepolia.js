// scripts/test-sepolia.js
import EthereumClient from './client.js';


async function main() {
  const eth = new EthereumClient();

  const ok = await eth.isConnected();
  if (!ok) throw new Error('No hay conexión al RPC');

  const addr = eth.wallet?.address;
  if (!addr) throw new Error('Configura SEPOLIA_PRIVATE_KEY en .env');

  console.log('Address:', addr);
  console.log('Balance (ETH):', await eth.getBalance(addr));

  // 1) Enviar una transferencia mínima a ti mismo (opcional)
  console.log('\n== Enviando 0.00002 ETH a mí mismo ==');
  const res1 = await eth.sendTransaction(addr, '0.00002');
  console.log('TX1:', res1);

  // 2) Guardar datos estáticos en la blockchain (tx con data)
  console.log('\n== Enviando tx con data ==');
  const payload = { deviceId: 'static-demo', tempC: 23.56, hum: 61, ts: Date.now() };
  const res2 = await eth.storeData(payload);
  console.log('TX2:', res2);

  // 3) Recuperar el data de la última tx
  const recovered = await eth.retrieveData(res2.hash);
  console.log('\nRecuperado:', recovered);
}

main().catch((e) => {
  console.error('Fallo en test-sepolia:', e);
  process.exit(1);
});
