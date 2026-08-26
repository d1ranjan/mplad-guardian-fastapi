export function highestRiskScore(alerts: Array<{ riskScore: number }>) {
  return alerts.reduce((highest, alert) => Math.max(highest, alert.riskScore), 0);
}
