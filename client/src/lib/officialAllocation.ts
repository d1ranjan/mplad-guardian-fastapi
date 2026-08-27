export const officialAllocationAssetUrl = "https://mpladguard-dtzanqrn.manus.space/manus-storage/mplads-official-allocation-2026_9689709f.csv";
export const officialAllocationFilename = "AllocatedLimitforHonbleMPs.csv";

export async function fetchOfficialAllocationCsv(fetcher: typeof fetch = fetch) {
  const response = await fetcher(officialAllocationAssetUrl);
  if (!response.ok) throw new Error("The packaged official allocation source could not be retrieved.");
  const text = await response.text();
  if (!text.includes("Allocated AMOUNT")) throw new Error("The packaged source does not match the expected official allocation CSV format.");
  return text;
}
