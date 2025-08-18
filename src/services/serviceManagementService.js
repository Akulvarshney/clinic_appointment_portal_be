import Prisma from "../prisma.js";

async function generateServicePortalId() {
  return await Prisma.$transaction(async (tx) => {
    const latest = await tx.services.findFirst({
      where: {
        portal_id: {
          startsWith: "SER_",
        },
      },
      orderBy: {
        portal_id: "desc",
      },
      select: {
        portal_id: true,
      },
    });

    // Step 2: Calculate new portalId
    let nextNumber = 1;
    if (latest?.portal_id) {
      const numPart = parseInt(latest.portal_id.split("_")[1]);
      if (!isNaN(numPart)) {
        nextNumber = numPart + 1;
      }
    }

    const newPortalId = `SER_${String(nextNumber).padStart(5, "0")}`;
    return newPortalId;
  });
}

export const createServiceInfo = async (serviceName, desc, price, orgId) => {
  return await Prisma.$transaction(async (tx) => {
    const portal = await generateServicePortalId();
    console.log("portal_id >>> ", portal);
    const service = await Prisma.services.create({
      data: {
        name: serviceName,
        description: desc,
        price: price,
        organization_id: orgId,
        portal_id: portal,
      },
    });
    if (service)
      return { message: "Service created Successfully", status: 200 };
    else return { message: "Error in Creating Service", status: 400 };
  });
};

export const getServicesInfo = async ({
  orgId,
  page = 1,
  limit = 10,
  search = "",
  status,
}) => {
  const skip = (page - 1) * limit;

  // Build dynamic filters
  const whereCondition = {
    organization_id: orgId,
    ...(status ? { status } : {}), // filter by ENABLED/DISABLED if provided
    is_valid: true,
    OR: search
      ? [
          { portal_id: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      : undefined,
  };

  try {
    const [services, totalCount] = await Promise.all([
      Prisma.services.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      Prisma.services.count({ where: whereCondition }),
    ]);

    return {
      message: "Getting Services Successfully",
      status: 200,
      data: {
        services,
        totalRecords: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    console.error("Database error in getServicesInfo:", error);
    throw {
      statusCode: 500,
      message: "Failed to fetch services",
    };
  }
};

export const getActiveServicesInfo = async (orgId) => {
  const Services = await Prisma.services.findMany({
    where: {
      organization_id: orgId,
      status: "ENABLED",
    },
  });
  return {
    message: "Getting Services Successfully",
    status: 200,
    data: Services,
  };
};

export const updateServices = async ({
  id,
  serviceName,
  desc,
  price,
  orgId,
  status,
}) => {
  const updatedService = await Prisma.services.update({
    where: { id },
    data: {
      ...(serviceName && { name: serviceName }),
      ...(desc && { description: desc }),
      ...(price && { price }),
      ...(orgId && { organization_id: orgId }),
      ...(status && { status }),
    },
  });

  return updatedService;
};

export const updateServicesInfo = async (req, res) => {};
