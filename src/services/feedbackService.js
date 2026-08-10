import prisma from "../prisma.js";

function toBoolOrUndefined(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined;
}



export async function getFeedbackList({
  orgId,
  page = 1,
  limit = 20,
  sortBy = "created_at",
  sortOrder = "desc",
  filters = {},
}) {
  if (!orgId) throw new Error("orgId is required");

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const hasComplaint = toBoolOrUndefined(filters.hasComplaint);
  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;
  const createdAt =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  const searchTerm = filters.search ? String(filters.search).trim() : "";
  const hasSearch = Boolean(searchTerm);

  const where = {
    organization_id: orgId,
    is_valid: true,
    ...(filters.clientId ? { appointments: { client_id: String(filters.clientId) } } : {}),
    ...(filters.doctorId ? { appointments: { doctor_id: String(filters.doctorId) } } : {}),
    ...(filters.employeeId ? { appointments: { employee_id: String(filters.employeeId) } } : {}),
    ...(filters.experience ? { experience: String(filters.experience) } : {}),
    ...(hasComplaint !== undefined ? { has_complaint: hasComplaint } : {}),
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(hasSearch
      ? {
          OR: [
            { experience: { contains: searchTerm, mode: "insensitive" } },
            { comments: { contains: searchTerm, mode: "insensitive" } },
            {
              complaint_text: {
                contains: searchTerm,
                mode: "insensitive",
              },
            },
            {
              appointments: {
                clients: {
                  OR: [
                    { first_name: { contains: searchTerm, mode: "insensitive" } },
                    { last_name: { contains: searchTerm, mode: "insensitive" } },
                    { email: { contains: searchTerm, mode: "insensitive" } },
                    { phone: { contains: searchTerm, mode: "insensitive" } },
                    { portalid: { contains: searchTerm, mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              appointments: {
                doctors: {
                  OR: [
                    { first_name: { contains: searchTerm, mode: "insensitive" } },
                    { last_name: { contains: searchTerm, mode: "insensitive" } },
                    { email: { contains: searchTerm, mode: "insensitive" } },
                    { phone: { contains: searchTerm, mode: "insensitive" } },
                    { portalid: { contains: searchTerm, mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              appointments: {
                employees: {
                  OR: [
                    { first_name: { contains: searchTerm, mode: "insensitive" } },
                    { last_name: { contains: searchTerm, mode: "insensitive" } },
                    { email: { contains: searchTerm, mode: "insensitive" } },
                    { phone: { contains: searchTerm, mode: "insensitive" } },
                    { portalid: { contains: searchTerm, mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              appointments: {
                services: {
                  name: { contains: searchTerm, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
    ...(filters.serviceId
      ? {
          appointments: { service_id: String(filters.serviceId) },
        }
      : {}),
  };

  const orderBy = { [sortBy]: sortOrder === "asc" ? "asc" : "desc" };

  const [total, items] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      include: {
        appointments: {
          include: {
            clients: true,
            doctors: true,
            employees: true,
            services: true,
          }
        },
        feedback_answers: {
          include: {
            feedback_questions: true
          }
        }
      },
    }),
  ]);

  return {
    page: pageNum,
    limit: limitNum,
    total,
    items,
  };
}

