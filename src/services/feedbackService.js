import prisma from "../prisma.js";

function toBoolOrUndefined(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined;
}

export async function createFeedback({
  orgId,
  clientId,
  doctorId,
  employeeId,
  serviceIds,
  experience,
  comments,
  hasComplaint,
  complaintText,
}) {
  if (!orgId) throw new Error("orgId is required");
  if (!clientId) throw new Error("clientId is required");
  if (!doctorId) throw new Error("doctorId is required");
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new Error("serviceIds (non-empty array) is required");
  }
  if (!experience || !String(experience).trim()) {
    throw new Error("experience is required");
  }

  const hasComplaintBool = Boolean(hasComplaint);
  const complaintTextNorm = complaintText ? String(complaintText).trim() : "";
  if (hasComplaintBool && !complaintTextNorm) {
    throw new Error("complaintText is required when hasComplaint is true");
  }

  // Cross-org safety checks (keep feedback scoped to org)
  const [org, client, doctor] = await Promise.all([
    prisma.organizations.findFirst({ where: { id: orgId, is_valid: true } }),
    prisma.clients.findFirst({ where: { id: clientId, is_valid: true } }),
    prisma.doctors.findFirst({
      where: { id: doctorId, organization_id: orgId, is_valid: true },
    }),
  ]);

  if (!org) throw new Error("Invalid orgId");
  if (!client) throw new Error("Invalid clientId");
  if (!doctor) throw new Error("Invalid doctorId for this organization");

  let employee = null;
  if (employeeId) {
    employee = await prisma.employees.findFirst({
      where: { id: employeeId, organization_id: orgId, is_valid: true },
    });
    if (!employee) throw new Error("Invalid employeeId for this organization");
  }

  const uniqueServiceIds = Array.from(
    new Set(serviceIds.map((s) => String(s).trim()).filter(Boolean))
  );
  const services = await prisma.services.findMany({
    where: {
      id: { in: uniqueServiceIds },
      organization_id: orgId,
      is_valid: true,
    },
    select: { id: true },
  });
  if (services.length !== uniqueServiceIds.length) {
    throw new Error("One or more serviceIds are invalid for this organization");
  }

  const created = await prisma.$transaction(async (tx) => {
    const fb = await tx.feedback.create({
      data: {
        organization_id: orgId,
        client_id: clientId,
        doctor_id: doctorId,
        employee_id: employeeId || null,
        experience: String(experience).trim(),
        comments: comments ? String(comments).trim() : null,
        has_complaint: hasComplaintBool,
        complaint_text: hasComplaintBool ? complaintTextNorm : null,
      },
    });

    await tx.feedback_services.createMany({
      data: services.map((s) => ({
        feedback_id: fb.id,
        service_id: s.id,
      })),
    });

    return fb;
  });

  return prisma.feedback.findUnique({
    where: { id: created.id },
    include: {
      clients: true,
      doctors: true,
      employees: true,
      feedback_services: { include: { services: true } },
    },
  });
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
    ...(filters.clientId ? { client_id: String(filters.clientId) } : {}),
    ...(filters.doctorId ? { doctor_id: String(filters.doctorId) } : {}),
    ...(filters.employeeId ? { employee_id: String(filters.employeeId) } : {}),
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
            {
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
            {
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
            {
              feedback_services: {
                some: {
                  services: {
                    name: { contains: searchTerm, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        }
      : {}),
    ...(filters.serviceId
      ? {
          feedback_services: {
            some: { service_id: String(filters.serviceId) },
          },
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
        clients: true,
        doctors: true,
        employees: true,
        feedback_services: { include: { services: true } },
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

