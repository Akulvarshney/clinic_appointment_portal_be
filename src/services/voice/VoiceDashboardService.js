import * as voiceCallRepository from "../../repositories/voice/voiceCallRepository.js";

/**
 * Computes Voice Calls dashboard KPIs and per-number statistics directly
 * from VoiceCallLog - no separate aggregate/summary table is maintained, so
 * numbers are always accurate and there is nothing extra to keep in sync.
 */

/** Start of the current day in UTC (00:00:00), used to scope "today" KPIs. */
const getUtcStartOfToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/** Start of the current calendar month in UTC, used to scope "this month" KPIs. */
const getUtcStartOfMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const toKpis = (totals) => ({
  totalCalls: totals.totalCalls,
  completedCalls: totals.completedCalls,
  failedCalls: totals.failedCalls,
  totalDurationSeconds: totals.totalDurationSeconds,
});

/**
 * Default dashboard payload (shown on page load): today's KPIs plus the
 * all-time per-number breakdown table.
 */
export const getDashboard = async (organizationId) => {
  const [totals, byNumber] = await Promise.all([
    voiceCallRepository.aggregateDashboardTotals(organizationId, {
      createdFrom: getUtcStartOfToday(),
    }),
    voiceCallRepository.groupCallsByFromNumber(organizationId),
  ]);

  return {
    kpis: {
      totalCalls: totals.totalCalls,
      completedCalls: totals.completedCalls,
      failedCalls: totals.failedCalls,
      totalDurationSeconds: totals.totalDurationSeconds,
      averageDurationSeconds: Math.round(totals.averageDurationSeconds || 0),
    },
    numberStats: byNumber.map((row) => ({
      phoneNumber: row.from_number,
      totalCalls: row._count._all,
      totalDurationSeconds: row._sum.duration_seconds || 0,
    })),
  };
};

/**
 * Extended KPIs ("this month" + "total till date"), fetched only on demand
 * (e.g. when the user clicks "View More") rather than on every page load.
 */
export const getExtendedDashboard = async (organizationId) => {
  const [monthTotals, allTimeTotals] = await Promise.all([
    voiceCallRepository.aggregateDashboardTotals(organizationId, {
      createdFrom: getUtcStartOfMonth(),
    }),
    voiceCallRepository.aggregateDashboardTotals(organizationId),
  ]);

  return {
    month: toKpis(monthTotals),
    allTime: toKpis(allTimeTotals),
  };
};
