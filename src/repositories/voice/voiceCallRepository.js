import prisma from "../../prisma.js";

/**
 * Data-access layer for VoiceCallLog. Kept free of business rules -
 * validation/orchestration belongs in services/voice/VoiceCallService.js and
 * services/voice/VoiceDashboardService.js.
 */

export const createCallLog = (data) => {
  return prisma.voiceCallLog.create({ data });
};

export const findCallLogBySid = (twilioCallSid) => {
  return prisma.voiceCallLog.findUnique({ where: { twilio_call_sid: twilioCallSid } });
};

export const updateCallLogBySid = (twilioCallSid, data) => {
  return prisma.voiceCallLog.update({
    where: { twilio_call_sid: twilioCallSid },
    data,
  });
};

export const findCallLogById = (id, organizationId) => {
  return prisma.voiceCallLog.findFirst({
    where: { id, organization_id: organizationId },
  });
};

export const countCalls = (where) => {
  return prisma.voiceCallLog.count({ where });
};

export const findCalls = ({ where, skip, take, orderBy }) => {
  return prisma.voiceCallLog.findMany({
    where,
    skip,
    take,
    orderBy,
    include: {
      client: {
        select: { id: true, first_name: true, last_name: true, phone: true },
      },
    },
  });
};

/**
 * Aggregate KPI totals for an organization directly from VoiceCallLog.
 * Optionally scoped to a `created_at` window (e.g. "today", "this month");
 * omitting both bounds aggregates across all time.
 */
export const aggregateDashboardTotals = async (
  organizationId,
  { createdFrom, createdTo } = {}
) => {
  const dateFilter =
    createdFrom || createdTo
      ? {
          created_at: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lte: createdTo } : {}),
          },
        }
      : {};

  const [totalCalls, completedCalls, failedCalls, durationAgg] = await Promise.all([
    prisma.voiceCallLog.count({ where: { organization_id: organizationId, ...dateFilter } }),
    prisma.voiceCallLog.count({
      where: { organization_id: organizationId, status: "COMPLETED", ...dateFilter },
    }),
    prisma.voiceCallLog.count({
      where: {
        organization_id: organizationId,
        status: { in: ["FAILED", "BUSY", "NO_ANSWER", "CANCELED"] },
        ...dateFilter,
      },
    }),
    prisma.voiceCallLog.aggregate({
      where: { organization_id: organizationId, duration_seconds: { not: null }, ...dateFilter },
      _sum: { duration_seconds: true },
      _avg: { duration_seconds: true },
    }),
  ]);

  return {
    totalCalls,
    completedCalls,
    failedCalls,
    totalDurationSeconds: durationAgg._sum.duration_seconds || 0,
    averageDurationSeconds: durationAgg._avg.duration_seconds || 0,
  };
};

/**
 * Per Twilio-number statistics (total calls + total duration), grouped by
 * from_number, for the organization.
 */
export const groupCallsByFromNumber = (organizationId) => {
  return prisma.voiceCallLog.groupBy({
    by: ["from_number"],
    where: { organization_id: organizationId },
    _count: { _all: true },
    _sum: { duration_seconds: true },
    orderBy: { from_number: "asc" },
  });
};
