export const officialAllocationAssetUrl = "https://mpladguard-dtzanqrn.manus.space/manus-storage/mplads-official-allocation-2026_9689709f.csv";
export const officialAllocationFilename = "AllocatedLimitforHonbleMPs.csv";

export function isOfficialAllocationCsv(csv: string) {
  const header = (csv.split(/\r?\n/, 1)[0] || "").replace(/^\ufeff/, "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return header.includes("state") && header.includes("constituency") && header.includes("allocated amount") && (header.includes("members of parliaments") || header.includes("member of parliament"));
}

export async function fetchOfficialAllocationCsv(fetcher: typeof fetch = fetch) {
  const response = await fetcher(officialAllocationAssetUrl);
  if (!response.ok) throw new Error("The packaged official allocation source could not be retrieved.");
  const text = await response.text();
  if (!isOfficialAllocationCsv(text)) throw new Error("The packaged source does not match the expected official allocation CSV format.");
  return text;
}
