# 🚀 IOTA vs Blockchain Performance Comparison

Proyecto de comparación de rendimiento entre IOTA 2.0 y Ethereum (Sepolia) utilizando simulaciones con distribuciones estadísticas realistas.

## 📊 Resultados Clave

- **IOTA es 25x más rápida** en latencia de confirmación
- **IOTA procesa 17x más TPS** que Sepolia
- **IOTA escala 13x mejor** bajo alta carga
- **IOTA es 100% feeless** vs costos de gas en Ethereum

Ver [INFORME_FINAL.md](./INFORME_FINAL.md) para el análisis completo.

## 🛠️ Tecnologías

- Node.js v20+
- Ethers.js (Ethereum)
- IOTA SDK / REST API
- Distribuciones estadísticas realistas (Box-Muller, Log-normal, Gamma, Geométrica)

## 📁 Estructura del Proyecto
```
iota-vs-blockchain/
├── src/
│   ├── ethereum/client.js       # Cliente Ethereum/Sepolia
│   ├── iota/client.js           # Cliente IOTA 2.0
│   ├── utils/
│   │   ├── logger.js            # Sistema de logs
│   │   ├── metrics.js           # Recolección de métricas
│   │   ├── csv-export.js        # Exportación a CSV
│   │   └── network-distributions.js  # Distribuciones estadísticas
│   └── tests/
│       └── run-simulated-benchmarks.js  # Suite de tests
├── results/                     # Resultados en CSV
├── config/networks.json         # Configuración de redes
├── .env                         # Variables de entorno
├── INFORME_FINAL.md            # Informe ejecutivo
└── README.md
```

## 🚀 Instalación
```bash
# Clonar el proyecto
git clone <tu-repo>
cd iota-vs-blockchain

# Instalar dependencias
npm install

# Configurar credenciales
cp .env.example .env
nano .env
```

## 🧪 Ejecutar Tests
```bash
# Tests simulados (recomendado)
node src/tests/run-simulated-benchmarks.js

# Tests individuales
node src/tests/latency.test.js
node src/tests/throughput.test.js
node src/tests/scalability.test.js
```

## 📈 Tests Implementados

1. **Latencia** - Tiempo de confirmación de transacciones
2. **Throughput** - Transacciones por segundo (TPS)
3. **Escalabilidad** - Rendimiento bajo diferentes cargas (10-10,000 tx)
4. **Costos** - Gas usado vs transacciones feeless
5. **Almacenamiento** - Costo por byte almacenado
6. **Integridad** - Verificación de inmutabilidad de datos

## 🔬 Metodología

El proyecto utiliza **simulaciones con distribuciones estadísticas realistas** basadas en:
- Datos empíricos de comportamiento de red
- Modelos probabilísticos (Log-normal, Gamma, Geométrica)
- Latencias reales medidas en testnet
- Variabilidad y spikes ocasionales

## 📊 Resultados

Los resultados se exportan automáticamente a:
- `results/*.csv` - Datos raw y resúmenes
- `INFORME_FINAL.md` - Análisis ejecutivo

## 👥 Autor

[Tu Nombre]

## 📄 Licencia

MIT
# IOTAVSBLOCKCHAINS
