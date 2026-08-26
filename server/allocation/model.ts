export type OfficialAllocationInput = {
  sourceRowNumber: number;
  state: string;
  mpName: string;
  constituency: string;
  allocatedAmount: number;
};

export type AllocationModelScore = OfficialAllocationInput & {
  statePeerCount: number;
  statePeerMedian: number;
  nationalPeerMedian: number;
  appliedVariancePercent: number;
  modelScore: number;
  contextBand: "high_variance" | "moderate_variance" | "expected_range";
  varianceDirection: "above_peer_median" | "below_peer_median" | "at_peer_median";
};

function parseCsvLine(line: string) {
  const values: string[] = [];
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

export function parseOfficialAllocationCsv(raw: string): OfficialAllocationInput[] {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const [header, ...data] = lines;
  if (!header?.includes("Allocated AMOUNT")) throw new Error("The official allocation CSV does not contain the expected allocated-amount column.");
  return data.map((line, index) => {
    const [serial, state, mpName, constituency, allocation] = parseCsvLine(line);
    return { sourceRowNumber: Number(serial) || index + 2, state, mpName, constituency, allocatedAmount: Number(allocation) };
  }).filter(row => row.state && row.mpName && row.constituency && Number.isFinite(row.allocatedAmount));
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function trainAllocationContextModel(records: OfficialAllocationInput[]) {
  if (records.length < 20) throw new Error("At least 20 public allocation records are required to train the allocation-context model.");
  const nationalPeerMedian = median(records.map(record => record.allocatedAmount));
  const byState = new Map<string, OfficialAllocationInput[]>();
  records.forEach(record => byState.set(record.state, [...(byState.get(record.state) ?? []), record]));
  const scores: AllocationModelScore[] = records.map(record => {
    const statePeers = byState.get(record.state) ?? [];
    const statePeerMedian = median(statePeers.map(peer => peer.allocatedAmount));
    const baseline = statePeers.length >= 5 ? statePeerMedian : nationalPeerMedian;
    const appliedVariancePercent = ((record.allocatedAmount - baseline) / Math.max(baseline, 1)) * 100;
    const modelScore = Math.min(100, Math.round(Math.abs(appliedVariancePercent)));
    const contextBand = modelScore >= 50 ? "high_variance" : modelScore >= 25 ? "moderate_variance" : "expected_range";
    const varianceDirection = appliedVariancePercent > 0.5 ? "above_peer_median" : appliedVariancePercent < -0.5 ? "below_peer_median" : "at_peer_median";
    return { ...record, statePeerCount: statePeers.length, statePeerMedian, nationalPeerMedian, appliedVariancePercent: Number(appliedVariancePercent.toFixed(2)), modelScore, contextBand, varianceDirection };
  });
  return {
    scores,
    evaluation: {
      trainingRows: records.length,
      stateCount: byState.size,
      nationalPeerMedian,
      highVarianceCount: scores.filter(score => score.contextBand === "high_variance").length,
      moderateVarianceCount: scores.filter(score => score.contextBand === "moderate_variance").length,
      expectedRangeCount: scores.filter(score => score.contextBand === "expected_range").length,
      validation: "Unsupervised peer-context model; no fraud labels are present in the public source, so precision/recall and fraud classification claims are intentionally not calculated.",
    },
  };
}
