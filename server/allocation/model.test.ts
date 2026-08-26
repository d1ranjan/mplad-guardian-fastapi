import { describe, expect, it } from "vitest";
import { parseOfficialAllocationCsv, trainAllocationContextModel } from "./model";

describe("official allocation context model", () => {
  it("parses the official public export shape", () => {
    const rows = parseOfficialAllocationCsv('"Sr. No.",State,Hon\'ble Members of Parliaments,Constituency,Allocated AMOUNT ( ₹ )\n1,Odisha,Example MP,Example Seat,147000000');
    expect(rows).toEqual([{ sourceRowNumber: 1, state: "Odisha", mpName: "Example MP", constituency: "Example Seat", allocatedAmount: 147000000 }]);
  });

  it("trains peer-median variance scores without asserting fraud", () => {
    const records = Array.from({ length: 20 }, (_, index) => ({ sourceRowNumber: index + 1, state: "Odisha", mpName: `Member ${index}`, constituency: `Seat ${index}`, allocatedAmount: index === 19 ? 294000000 : 147000000 }));
    const { scores, evaluation } = trainAllocationContextModel(records);
    expect(scores.at(-1)?.modelScore).toBe(100);
    expect(scores.at(-1)?.varianceDirection).toBe("above_peer_median");
    expect(evaluation.highVarianceCount).toBe(1);
    expect(evaluation.validation).toContain("no fraud labels");
  });
});
