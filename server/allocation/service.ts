import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  allocationModelRuns,
  allocationModelScores,
  officialAllocationImports,
  officialAllocationRecords,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { storageGetSignedUrl } from "../storage";
import { parseOfficialAllocationCsv, trainAllocationContextModel } from "./model";

const SOURCE_URL = "https://mplads.mospi.gov.in/digigov/dashboard.html";
const SOURCE_SCOPE = "18th Lok Sabha public dashboard allocation export; state, MP, constituency, and allocated amount.";
const SOURCE_ASSET_KEY = "mplads_allocated_limit_2026-08-26_848cd4e5.csv";
const SOURCE_ASSET_URL = "/manus-storage/mplads_allocated_limit_2026-08-26_848cd4e5.csv";
const MODEL_VERSION = "official-allocation-context-v1";

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}

async function sourceCsv() {
  const signedUrl = await storageGetSignedUrl(SOURCE_ASSET_KEY);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Unable to retrieve the preserved official allocation source (${response.status}).`);
  return response.text();
}

export async function ensureOfficialAllocationModel() {
  const db = await dbOrThrow();
  const current = await db.select().from(allocationModelRuns).where(eq(allocationModelRuns.status, "completed")).orderBy(desc(allocationModelRuns.trainedAt)).limit(1);
  if (current[0]) return current[0];
  const raw = await sourceCsv();
  const sourceSha256 = createHash("sha256").update(raw).digest("hex");
  const parsed = parseOfficialAllocationCsv(raw);
  const existingImport = await db.select().from(officialAllocationImports).where(eq(officialAllocationImports.sourceSha256, sourceSha256)).limit(1);
  let sourceImport = existingImport[0];
  if (!sourceImport) {
    const created = await db.insert(officialAllocationImports).values({ sourceUrl: SOURCE_URL, sourceScope: SOURCE_SCOPE, publicAssetUrl: SOURCE_ASSET_URL, sourceSha256, retrievedAt: new Date("2026-08-26T00:00:00.000Z"), rowCount: parsed.length });
    const sourceImportId = Number(created[0].insertId);
    await db.insert(officialAllocationRecords).values(parsed.map(record => ({ sourceImportId, sourceRowNumber: record.sourceRowNumber, state: record.state, mpName: record.mpName, constituency: record.constituency, allocatedAmount: record.allocatedAmount })));
    sourceImport = (await db.select().from(officialAllocationImports).where(eq(officialAllocationImports.id, sourceImportId)).limit(1))[0];
  }
  if (!sourceImport) throw new Error("Official allocation import was not persisted.");
  const storedRecords = await db.select().from(officialAllocationRecords).where(eq(officialAllocationRecords.sourceImportId, sourceImport.id));
  const { scores, evaluation } = trainAllocationContextModel(storedRecords.map(record => ({ sourceRowNumber: record.sourceRowNumber, state: record.state, mpName: record.mpName, constituency: record.constituency, allocatedAmount: record.allocatedAmount })));
  const createdRun = await db.insert(allocationModelRuns).values({
    modelCode: `ALLOC-${sourceSha256.slice(0, 10).toUpperCase()}-${nanoid(4).toUpperCase()}`,
    modelVersion: MODEL_VERSION,
    sourceImportId: sourceImport.id,
    trainingRows: storedRecords.length,
    methodology: "Unsupervised state peer-median allocation variance model. It is a context model, not a fraud classifier. High variance may have legitimate administrative explanations.",
    configuration: { minimumStatePeerCount: 5, score: "absolute percentage deviation from state median; national fallback", sourceAssetKey: SOURCE_ASSET_KEY },
    evaluation,
    status: "training",
  });
  const modelRunId = Number(createdRun[0].insertId);
  const recordByRow = new Map(storedRecords.map(record => [record.sourceRowNumber, record.id]));
  await db.insert(allocationModelScores).values(scores.map(score => ({
    modelRunId,
    allocationRecordId: recordByRow.get(score.sourceRowNumber)!,
    contextBand: score.contextBand,
    modelScore: score.modelScore,
    varianceDirection: score.varianceDirection,
    statePeerCount: score.statePeerCount,
    statePeerMedian: score.statePeerMedian,
    nationalPeerMedian: score.nationalPeerMedian,
    appliedVariancePercent: score.appliedVariancePercent,
  })));
  await db.update(allocationModelRuns).set({ status: "completed", completedAt: new Date() }).where(eq(allocationModelRuns.id, modelRunId));
  return (await db.select().from(allocationModelRuns).where(eq(allocationModelRuns.id, modelRunId)).limit(1))[0]!;
}

export async function getOfficialAllocationDashboard() {
  const model = await ensureOfficialAllocationModel();
  const db = await dbOrThrow();
  const source = (await db.select().from(officialAllocationImports).where(eq(officialAllocationImports.id, model.sourceImportId)).limit(1))[0]!;
  const rows = await db.select({ score: allocationModelScores, record: officialAllocationRecords }).from(allocationModelScores).innerJoin(officialAllocationRecords, eq(allocationModelScores.allocationRecordId, officialAllocationRecords.id)).where(eq(allocationModelScores.modelRunId, model.id)).orderBy(desc(allocationModelScores.modelScore), desc(officialAllocationRecords.allocatedAmount));
  const bands = ["high_variance", "moderate_variance", "expected_range"] as const;
  return {
    model,
    source,
    kpis: {
      recordCount: rows.length,
      stateCount: new Set(rows.map(row => row.record.state)).size,
      highVarianceCount: rows.filter(row => row.score.contextBand === "high_variance").length,
      medianAllocation: Number((model.evaluation as { nationalPeerMedian?: number } | null)?.nationalPeerMedian ?? 0),
    },
    bandBreakdown: bands.map(band => ({ band, count: rows.filter(row => row.score.contextBand === band).length })),
    records: rows.slice(0, 30).map(row => ({ ...row.score, record: row.record })),
  };
}

export async function getOfficialAllocationCase(scoreId: number) {
  await ensureOfficialAllocationModel();
  const db = await dbOrThrow();
  const row = await db.select({ score: allocationModelScores, record: officialAllocationRecords, model: allocationModelRuns, source: officialAllocationImports }).from(allocationModelScores).innerJoin(officialAllocationRecords, eq(allocationModelScores.allocationRecordId, officialAllocationRecords.id)).innerJoin(allocationModelRuns, eq(allocationModelScores.modelRunId, allocationModelRuns.id)).innerJoin(officialAllocationImports, eq(allocationModelRuns.sourceImportId, officialAllocationImports.id)).where(eq(allocationModelScores.id, scoreId)).limit(1);
  const base = row[0];
  if (!base) return null;
  const stateRows = await db.select({ score: allocationModelScores, record: officialAllocationRecords }).from(allocationModelScores).innerJoin(officialAllocationRecords, eq(allocationModelScores.allocationRecordId, officialAllocationRecords.id)).where(and(eq(allocationModelScores.modelRunId, base.score.modelRunId), eq(officialAllocationRecords.state, base.record.state))).orderBy(desc(officialAllocationRecords.allocatedAmount));
  return {
    ...base.score,
    record: base.record,
    model: base.model,
    source: base.source,
    statePeers: stateRows.map(item => ({ ...item.record, modelScore: item.score.modelScore, appliedVariancePercent: item.score.appliedVariancePercent })),
  };
}
