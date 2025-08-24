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

export const getResources = async (orgId, status) => {
  const resources = await Prisma.resources.findMany({
    where: {
      organization_id: orgId,
      is_valid: true,
      status: status,
    },
  });
  return resources;
};

export const updateResourceService = async (id, payload) => {
  const dataToUpdate = {};

  if (payload.status) {
    if (!["ENABLED", "DISABLED"].includes(payload.status)) {
      return { message: "Invalid status", status: 400 };
    }
    dataToUpdate.status = payload.status;
  }

  if (payload.resourceName) {
    dataToUpdate.name = payload.resourceName;
  }

  if (payload.order !== undefined) {
    dataToUpdate.resource_order = payload.order;
  }

  // if (payload.orgId) {
  //   dataToUpdate.orgId = payload.orgId;
  // }

  if (Object.keys(dataToUpdate).length === 0) {
    return { message: "No fields to update", status: 400 };
  }

  const updated = await Prisma.resources.update({
    where: { id },
    data: dataToUpdate,
  });

  return { message: "Resource updated", status: 200, data: updated };
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
