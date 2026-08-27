/**
 * Presentation-only synthetic records. They are intentionally fictional and
 * exist to demonstrate explainable workflow controls, never as public evidence.
 */
const records = [
  ["MPL-OD-101", "Community rainwater harvesting unit at Naraj", "Construct a reinforced rainwater harvesting unit for the community school campus.", "Water infrastructure", "Odisha", "Cuttack", "Naraj", "Aarohan Civic Works", "2024-25", 820000, 790000, "2024-05-18", "2025-01-30", "2025-01-21", 100, "completed"],
  ["MPL-OD-102", "School campus rainwater capture system at Choudwar", "Install a reinforced rainwater harvesting structure and filtration channel in a government school.", "Water infrastructure", "Odisha", "Cuttack", "Choudwar", "Delta Rural Build", "2024-25", 860000, 840000, "2024-06-12", "2025-02-15", "2025-02-12", 100, "completed"],
  ["MPL-OD-103", "Rainwater harvesting facility at Banki health centre", "Build a rainwater recharge and collection facility for a public health centre.", "Water infrastructure", "Odisha", "Cuttack", "Banki", "Kalinga Water Systems", "2024-25", 780000, 760000, "2024-04-26", "2024-12-20", "2024-12-19", 100, "completed"],
  ["MPL-OD-104", "Rainwater harvesting structure at Salepur market", "Provide community rainwater collection, storage, and filtration at the Salepur market complex.", "Water infrastructure", "Odisha", "Cuttack", "Salepur", "Aarohan Civic Works", "2024-25", 910000, 885000, "2024-07-02", "2025-03-25", "2025-03-20", 100, "completed"],
  ["MPL-OD-105", "Integrated rainwater harvesting complex at Niali", "Construct a high-capacity rainwater harvesting and filtration complex for the Niali community hub.", "Water infrastructure", "Odisha", "Cuttack", "Niali", "Aarohan Civic Works", "2024-25", 2680000, 2640000, "2024-06-28", "2025-03-30", "2025-03-18", 100, "completed"],
  ["MPL-OD-106", "Accessible drinking-water point at Barang", "Install an accessible public drinking-water point at Barang community square.", "Water infrastructure", "Odisha", "Cuttack", "Barang", "Delta Rural Build", "2024-25", 640000, 638000, "2024-06-03", "2024-10-30", "2024-10-18", 82, "completed"],
  ["MPL-MH-201", "Concrete drainage channel in Ward 12", "Construct a covered concrete storm-water drainage channel near Market Road in Ward 12.", "Drainage", "Maharashtra", "Nashik", "Ward 12", "Deccan Transit Works", "2024-25", 1480000, 1200000, "2024-08-10", "2025-04-10", "2025-02-15", 82, "ongoing"],
  ["MPL-MH-202", "Stormwater drain near Market Road Ward 12", "Build a cement concrete drainage pathway for storm water beside Market Road at Ward 12.", "Drainage", "Maharashtra", "Nashik", "Ward 12", "Pragati Civic Studio", "2024-25", 1540000, 230000, "2024-08-18", "2025-05-12", "2025-02-18", 16, "ongoing"],
  ["MPL-MH-203", "Concrete drain near College Road", "Construct a covered concrete surface-water drain near College Road in Ward 7.", "Drainage", "Maharashtra", "Nashik", "Ward 7", "Pragati Civic Studio", "2024-25", 1350000, 1315000, "2024-04-12", "2024-11-28", "2024-11-20", 100, "completed"],
  ["MPL-MH-204", "Community drainage repair at Panchavati", "Repair a small concrete drainage channel and improve storm water flow in Panchavati.", "Drainage", "Maharashtra", "Nashik", "Panchavati", "Deccan Transit Works", "2024-25", 1120000, 1090000, "2024-05-12", "2024-12-20", "2024-12-16", 100, "completed"],
  ["MPL-AS-301", "Solar street lighting at Chabua market", "Install solar street lights along the Chabua market corridor.", "Street lighting", "Assam", "Dibrugarh", "Chabua", "North East Grid Services", "2025-26", 1260000, 650000, "2025-04-10", "2025-12-15", "2025-08-11", 54, "ongoing"],
  ["MPL-AS-302", "Solar street lighting at Tingrai junction", "Install solar lighting poles at Tingrai junction and approach road.", "Street lighting", "Assam", "Dibrugarh", "Tingrai", "North East Grid Services", "2025-26", 1180000, 520000, "2025-04-22", "2025-12-20", "2025-08-02", 48, "ongoing"],
  ["MPL-AS-303", "Solar street lighting at Lekai village road", "Provide solar street lights on the Lekai village road corridor.", "Street lighting", "Assam", "Dibrugarh", "Lekai", "North East Grid Services", "2025-26", 1310000, 720000, "2025-05-03", "2026-01-10", "2025-08-08", 55, "ongoing"],
  ["MPL-AS-304", "Solar street lighting at Mohanbari school route", "Install solar lamp posts on the Mohanbari school approach route.", "Street lighting", "Assam", "Dibrugarh", "Mohanbari", "North East Grid Services", "2025-26", 1210000, 600000, "2025-05-16", "2026-01-20", "2025-08-06", 50, "ongoing"],
  ["MPL-AS-305", "Solar street lighting at Lahowal bus stand", "Install solar street lights around Lahowal bus stand and adjoining lane.", "Street lighting", "Assam", "Dibrugarh", "Lahowal", "North East Grid Services", "2025-26", 1280000, 560000, "2025-06-02", "2026-02-12", "2025-08-13", 43, "ongoing"],
  ["MPL-AS-306", "Solar street lighting at Maijan public ground", "Provide solar lighting at Maijan public ground and pedestrian perimeter.", "Street lighting", "Assam", "Dibrugarh", "Maijan", "North East Grid Services", "2025-26", 1230000, 410000, "2025-06-11", "2026-02-20", "2025-08-09", 36, "ongoing"],
  ["MPL-AS-307", "Solar street lighting at Khowang square", "Install solar-powered street lights at Khowang community square.", "Street lighting", "Assam", "Dibrugarh", "Khowang", "Brahmaputra Civil Co.", "2025-26", 1160000, 430000, "2025-05-21", "2026-01-29", "2025-08-04", 40, "ongoing"],
  ["MPL-AS-308", "Solar street lighting at Mancotta civic lane", "Provide solar lamp posts in Mancotta civic lane and small market approach.", "Street lighting", "Assam", "Dibrugarh", "Mancotta", "Brahmaputra Civil Co.", "2025-26", 1190000, 450000, "2025-06-18", "2026-02-27", "2025-08-14", 41, "ongoing"],
  ["MPL-RJ-401", "Primary health sub-centre extension at Bassi", "Extend outpatient room and accessible approach path at the Bassi public health sub-centre.", "Health infrastructure", "Rajasthan", "Jaipur", "Bassi", "Aravali Public Works", "2023-24", 3400000, 1920000, "2023-06-15", "2024-04-20", "2024-06-01", 38, "on_hold"],
  ["MPL-RJ-402", "Community health equipment room at Chaksu", "Construct a health equipment room and accessible ramp at Chaksu community facility.", "Health infrastructure", "Rajasthan", "Jaipur", "Chaksu", "Aravali Public Works", "2023-24", 2200000, 2160000, "2023-05-09", "2024-02-12", "2024-02-02", 100, "completed"],
  ["MPL-RJ-403", "Accessible public health waiting area at Jamwa Ramgarh", "Build a covered public waiting area and drinking water point at the health facility.", "Health infrastructure", "Rajasthan", "Jaipur", "Jamwa Ramgarh", "Aravali Public Works", "2023-24", 1980000, 1970000, "2023-07-08", "2024-05-01", "2024-04-28", 100, "completed"],
];

const headers = ["project_code", "title", "description", "category", "state", "district", "locality", "vendor_name", "financial_year", "sanctioned_amount", "actual_expenditure", "sanction_date", "expected_completion_date", "last_update_date", "progress_percent", "project_status"];
const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
const iso = (date: string) => `${date}T00:00:00Z`;

export function buildPresentationDemoCsv() {
  return [headers.join(","), ...records.map(row => row.map((value, index) => escape(index >= 11 && index <= 13 ? iso(String(value)) : value)).join(","))].join("\n");
}

export function presentationDemoFile() {
  return new File([buildPresentationDemoCsv()], "mplad_guardian_presentation_synthetic.csv", { type: "text/csv" });
}

export const presentationDemoRecordCount = records.length;
