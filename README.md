# 📘 IOTA vs Blockchain – Benchmark Suite (Simulated)

This project implements a **complete reproducible benchmark suite** to compare the performance of **IOTA** and **Ethereum/Sepolia** in a **fully simulated environment**, eliminating network noise and enabling rigorous statistical analysis.

It includes:
- **Latency**, **throughput**, and **scalability** tests  
- **Deterministic simulation** using seeded RNG  
- **Replicated executions** (N=30 by default)  
- Automatic computation of:
  - Mean  
  - Variance  
  - Standard deviation  
  - **95% Confidence Intervals (Normal distribution)**  
- Export to **CSV**  
- Full **Python analysis + plots**

---

## 🧪 1. Included Tests

### **1. Latency Test (Simulated)**
Measures:
- Average latency  
- p95 latency  
- CPU time  
- Success rate  

For networks:
- **Ethereum (Sepolia) – simulated**
- **IOTA – simulated**

---

### **2. Throughput Test (Simulated)**
Runs a batch of parallel simulated transactions/blocks.

Metrics:
- TPS (transactions per second)  
- Average latency  
- Success rate  

---

### **3. Scalability Test (Simulated)**
Evaluates performance for increasing batch sizes:

```
10, 100, 1000, 10000
```

For each batch:
- TPS  
- Latency  
- Success rate  

---

## 🔁 2. Replicated Executions (Monte Carlo)

`run-simulated-benchmarks.js` includes:

- `withSeed(seed, fn)`  
- `runReplicatedSuite(N)`  

This runs all benchmark tests **multiple times**, each with a fixed seed, enabling:

- Perfect reproducibility  
- Noise reduction  
- Statistical confidence  

### **95% Confidence Interval (Normal Distribution)**

$begin:math:display$
CI95 \= \\bar\{x\} \\pm 1\.96 \\cdot \\frac\{s\}\{\\sqrt\{n\}\}
$end:math:display$

Where:
- $begin:math:text$ \\bar\{x\} $end:math:text$ = sample mean  
- $begin:math:text$ s $end:math:text$ = standard deviation  
- $begin:math:text$ n $end:math:text$ = number of replications  

Exported metrics include:
- `mean`  
- `variance`  
- `std`  
- `ci95_lower`  
- `ci95_upper`  
- `n`

---

## 📁 3. Project Structure

```
src/
  ethereum/
  iota/
  tests/
    run-simulated-benchmarks.js
results/
  *.csv       ← auto-generated benchmark data
  *.png       ← graphs created by the analysis script
logs/
analysis/
  analyze_benchmarks.py
```

---

## ▶️ 4. Running the Benchmarks

### **Run the default simulated suite**
```bash
node src/tests/run-simulated-benchmarks.js
```

### **Run only the replicated suite**
Inside the file:
```js
runReplicatedSuite(30)
```

Or via CLI (if enabled):
```bash
node src/tests/run-simulated-benchmarks.js --replications 30
```

---

## 📊 5. Analysis & Visualization (Python)

Use the analysis script:

```
analysis/analyze_benchmarks.py
```

Run:
```bash
python analyze_benchmarks.py
```

This generates:

### **Markdown summary (SUMMARY.md)**
- Latency (mean + CI95)  
- p95 latency (CI95)  
- Throughput (CI95)  
- Scalability per batch size (CI95)  
- Success rate CI95  

### **Graphs (PNG)**
- `latency_ci95.png`
- `latency_p95_ci95.png`
- `latency_success_ci95.png`
- `throughput_ci95.png`
- `throughput_success_ci95.png`
- `scalability_tps_ci95.png`
- `scalability_latency_ci95.png`
- `scalability_success_ci95.png`

---

## 📦 6. How to Interpret the Results

This suite allows answering:

✔ Which network is faster?  
✔ Which network achieves higher throughput?  
✔ How does performance change with load?  
✔ How stable are results across seeds?  
✔ Are differences **statistically significant**?

### **Significance rule:**

- **If CI95 intervals do NOT overlap → significant difference**
- **If they overlap → not statistically significant**

---

## ♻️ 7. Cleaning Up Results

Not required, but you may wipe previous results:

```bash
rm -rf results/* logs/*
```

---

## 🧱 8. Requirements

- **Node.js ≥ 18**  
- **Python ≥ 3.10**

Python libraries:
```bash
pip install pandas matplotlib
```

---

## 🛠 9. Optional Enhancements

I can add:
- Full CLI flags (`--replicas`, `--tag`, `--skip-tests`)
- Parquet or JSONL export  
- Automatic PDF report  
- Jupyter Notebook  
- Real-network benchmark mode  
