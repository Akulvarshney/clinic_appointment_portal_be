import Prisma from "../prisma.js";

export const createResourceService = async (resourceName, orgId) => {
  return await Prisma.$transaction(async (tx) => {
    const portal = await generateResourcePortId();
    console.log("portal_id >>> ", portal);
    const resource = await Prisma.resources.create({
      data: {
        portal_id: portal,
        name: resourceName,
        organization_id: orgId,
      },
    });
    if (resource)
      return { message: "Resource created Successfully", status: 200 };
    else return { message: "Error in Creating Resource", status: 400 };
  });
};

export const getResources = async (orgId) => {
  const resources = await Prisma.resources.findMany({
    where: {
      organization_id: orgId,
      is_valid: true,
    },
  });
  return resources;
};

export const updateResourceService = async (id, status) => {
  if (!["ENABLED", "DISABLED"].includes(status)) {
    return { message: "Error", status: 400 };
  }
  const updated = await Prisma.resources.update({
    where: { id },
    data: {
      status: status,
    },
  });
  return { message: "Resource Updates", status: 200 };
};

async function generateResourcePortId() {
  return await Prisma.$transaction(async (tx) => {
    const latest = await tx.resources.findFirst({
      where: {
        portal_id: {
          startsWith: "RES_",
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

    const newPortalId = `RES_${String(nextNumber).padStart(5, "0")}`;
    return newPortalId;
  });
}
