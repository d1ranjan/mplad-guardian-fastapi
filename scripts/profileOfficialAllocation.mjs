import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node scripts/profileOfficialAllocation.mjs <official-mplads-csv>");
  process.exit(1);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { values.push(current.trim()); current = ""; }
    else current += character;
  }
  values.push(current.trim());
  return values;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function robustStats(values) {
  const center = median(values);
  const mad = median(values.map(value => Math.abs(value - center)));
  const standardDeviation = Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / Math.max(values.length, 1));
  const useMad = mad > 0.000001;
  return {
    median: center,
    mad,
    standardDeviation,
    scale: useMad ? mad / 0.6745 : standardDeviation,
    scaleMethod: useMad ? "MAD" : "standard deviation fallback",
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

const raw = readFileSync(sourcePath, "utf8");
const rows = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).slice(1).map(parseCsvLine).map(cells => ({
  state: cells[1], mpName: cells[2], constituency: cells[3], allocation: Number(cells[4]),
})).filter(row => row.state && row.mpName && Number.isFinite(row.allocation));

const logValues = rows.map(row => Math.log1p(row.allocation));
const national = robustStats(logValues);
const byState = new Map();
for (const row of rows) byState.set(row.state, [...(byState.get(row.state) ?? []), row]);

const states = Object.fromEntries([...byState.entries()].map(([state, members]) => {
  const values = members.map(member => Math.log1p(member.allocation));
  const stats = robustStats(values);
  return [state, { n: members.length, allocationMedian: Math.round(Math.expm1(stats.median)), scaleMethod: stats.scaleMethod, allocationScaleLog: Number(stats.scale.toFixed(6)) }];
}));

const contextRecords = rows.map(row => {
  const logAllocation = Math.log1p(row.allocation);
  const stateMembers = byState.get(row.state) ?? [];
  const stateStats = robustStats(stateMembers.map(member => Math.log1p(member.allocation)));
  const nationalMedian = Math.expm1(national.median);
  const stateMedian = Math.expm1(stateStats.median);
  const nationalVariancePercent = ((row.allocation - nationalMedian) / Math.max(nationalMedian, 1)) * 100;
  const stateVariancePercent = ((row.allocation - stateMedian) / Math.max(stateMedian, 1)) * 100;
  const appliedVariancePercent = stateMembers.length >= 5 ? stateVariancePercent : nationalVariancePercent;
  const score = Math.min(100, Math.round(Math.abs(appliedVariancePercent)));
  return {
    ...row,
    allocationCrore: Number((row.allocation / 10_000_000).toFixed(4)),
    statePeerCount: stateMembers.length,
    statePeerMedian: Math.round(stateMedian),
    nationalPeerMedian: Math.round(nationalMedian),
    stateVariancePercent: Number(stateVariancePercent.toFixed(2)),
    nationalVariancePercent: Number(nationalVariancePercent.toFixed(2)),
    appliedVariancePercent: Number(appliedVariancePercent.toFixed(2)),
    contextualAnomalyScore: score,
  };
}).sort((a, b) => b.contextualAnomalyScore - a.contextualAnomalyScore || b.allocation - a.allocation);

const output = {
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  rowCount: rows.length,
  fittedAt: new Date().toISOString(),
  model: {
    name: "Robust Allocation Context Model",
    version: "official-allocation-v1",
    method: "State peer-median allocation variance scoring, falling back to the national median where fewer than five state peers exist. MAD/standard-deviation diagnostics are retained for model monitoring.",
    nationalMedian: Math.round(Math.expm1(national.median)),
    nationalScaleMethod: national.scaleMethod,
    nationalAllocationScaleLog: Number(national.scale.toFixed(6)),
  },
  stateModels: states,
  topContextualAnomalies: contextRecords.slice(0, 24),
};

console.log(JSON.stringify(output, null, 2));
