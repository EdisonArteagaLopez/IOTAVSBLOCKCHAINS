# 📊 Informe de Comparación: IOTA vs Ethereum (Sepolia)

## Resumen Ejecutivo

Este estudio compara el rendimiento de dos redes DLT utilizando simulaciones con distribuciones estadísticas realistas basadas en datos empíricos de las redes.

---

## 🎯 Resultados Principales

### 1. Latencia de Transacciones

| Métrica | Ethereum/Sepolia | IOTA 2.0 | Ventaja IOTA |
|---------|------------------|----------|--------------|
| **Latencia Promedio** | 27,231 ms (~27s) | 1,091 ms (~1.1s) | **25x más rápido** |
| **P95 (95 percentil)** | 36,310 ms (~36s) | 1,996 ms (~2s) | **18x más rápido** |
| **Mejor Caso** | 24,077 ms (~24s) | 270 ms | **89x más rápido** |
| **Peor Caso** | 72,236 ms (~72s) | 4,021 ms (~4s) | **18x más rápido** |

**Conclusión:** IOTA es significativamente más rápida en confirmación de transacciones.

---

### 2. Throughput (Transacciones por Segundo)

| Red | TPS | Success Rate |
|-----|-----|--------------|
| **Sepolia** | 13.84 TPS | 100% |
| **IOTA** | 236.46 TPS | 100% |

**Conclusión:** IOTA procesa **17x más transacciones** por segundo que Sepolia.

---

### 3. Escalabilidad

Resultados con 10,000 transacciones en paralelo:

| Red | TPS | Latencia Promedio | Degradación |
|-----|-----|-------------------|-------------|
| **Sepolia** | 117.33 TPS | 27.3s | Estable |
| **IOTA** | 1,509.89 TPS | 1.3s | Mínima |

#### Curva de Escalabilidad:

**Sepolia:**
- 10 tx → 0.14 TPS
- 100 tx → 2.08 TPS
- 1,000 tx → 16.56 TPS
- 10,000 tx → 117.33 TPS

**IOTA:**
- 10 tx → 4.51 TPS
- 100 tx → 40.29 TPS
- 1,000 tx → 242.13 TPS
- 10,000 tx → 1,509.89 TPS

**Conclusión:** IOTA escala **13x mejor** que Sepolia bajo carga.

---

### 4. Costos de Transacción

| Red | Costo por TX | Costo por 1,000 TX |
|-----|--------------|---------------------|
| **Sepolia** | 21,000 gas (~0.000021 ETH) | ~0.021 ETH |
| **IOTA** | **$0.00 (Feeless)** | **$0.00** |

**Conclusión:** IOTA no tiene costos de transacción, ventaja significativa para aplicaciones de alto volumen.

---

## 🔬 Metodología

### Distribuciones Estadísticas Utilizadas

#### Ethereum/Sepolia:
- **RTT/RPC**: Log-normal (mediana: 90ms, P95: 250ms)
- **Inclusión en bloque**: Geométrica (p=0.8, tiempo de bloque: 12s)
- **Confirmación**: +1 bloque adicional (12s)
- **Spikes**: 1% probabilidad de latencia +400-1500ms

#### IOTA:
- **Gossip P2P**: Log-normal (mediana: 70ms, P95: 180ms)
- **Solidificación DAG**: Normal truncada (media: 180ms, sd: 60ms)
- **Confirmación**: Gamma (shape: 3, scale: 270ms)
- **Spikes**: 1% probabilidad de latencia +200-800ms

---

## 📈 Análisis de Resultados

### Ventajas de Ethereum/Sepolia:
✅ Red madura y ampliamente adoptada
✅ Ecosistema robusto de smart contracts
✅ Alta descentralización
✅ Seguridad probada en producción

### Ventajas de IOTA:
✅ **25x más rápida** en confirmación de transacciones
✅ **17x mayor throughput** (TPS)
✅ **13x mejor escalabilidad** bajo carga
✅ **Sin costos de transacción** (feeless)
✅ Arquitectura DAG sin minería

---

## 🎯 Casos de Uso Recomendados

### Ethereum/Sepolia es mejor para:
- Aplicaciones DeFi que requieren máxima seguridad
- Smart contracts complejos
- Aplicaciones donde el ecosistema maduro es crítico
- Casos donde la latencia no es crítica

### IOTA es mejor para:
- IoT y micropagos (por ser feeless)
- Aplicaciones que requieren baja latencia
- Sistemas de alto throughput (>100 TPS)
- Casos de uso donde el costo por transacción es prohibitivo

---

## 📊 Datos Técnicos

**Configuración de Tests:**
- Iteraciones de latencia: 100
- Batch de throughput: 1,000 transacciones
- Escalabilidad: 10, 100, 1,000, 10,000 transacciones
- Ambiente: Simulación con distribuciones estadísticas realistas

**Fecha de Ejecución:** Octubre 2025
**Redes Evaluadas:** Sepolia Testnet, IOTA 2.0 Testnet

---

## 🔚 Conclusiones

1. **Rendimiento**: IOTA supera significativamente a Ethereum en latencia (25x), throughput (17x) y escalabilidad (13x).

2. **Costos**: IOTA elimina completamente los costos de transacción, haciéndola ideal para aplicaciones de alto volumen.

3. **Madurez**: Ethereum tiene ventaja en ecosistema y adopción, mientras que IOTA ofrece arquitectura más moderna y eficiente.

4. **Recomendación**: La elección depende del caso de uso:
   - **Prioridad en seguridad/ecosistema** → Ethereum
   - **Prioridad en rendimiento/costos** → IOTA

---

*Datos generados mediante simulaciones con distribuciones estadísticas realistas basadas en comportamiento empírico de las redes.*
