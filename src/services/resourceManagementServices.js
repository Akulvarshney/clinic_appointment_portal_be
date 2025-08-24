import Prisma from "../prisma.js";

export const createResourceService = async (resourceName, orgId) => {
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

    let nextNumber = 1;
    if (latest?.portal_id) {
      const numPart = parseInt(latest.portal_id.split("_")[1]);
      if (!isNaN(numPart)) {
        nextNumber = numPart + 1;
      }
    }

    const portalId = `RES_${String(nextNumber).padStart(5, "0")}`;

    const latestOrder = await tx.resources.findFirst({
      where: {
        organization_id: orgId,
      },
      orderBy: {
        resource_order: "desc",
      },
      select: {
        resource_order: true,
      },
    });

    const resourceOrder = latestOrder?.resource_order
      ? latestOrder.resource_order + 1
      : 1;

    const resource = await tx.resources.create({
      data: {
        portal_id: portalId,
        name: resourceName,
        organization_id: orgId,
        resource_order: resourceOrder,
      },
    });

    if (resource) {
      return { message: "Resource created successfully", status: 200 };
    } else {
      return { message: "Error in creating resource", status: 400 };
    }
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
  const resource = await Prisma.resources.findUnique({ where: { id } });
  if (!resource) {
    return { message: "Resource not found", status: 404 };
  }

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
    const currentOrder = resource.resource_order;
    const newOrder = payload.order;

    if (newOrder < currentOrder) {
      // Moving resource UP (e.g. 9 → 3)
      await Prisma.resources.updateMany({
        where: {
          resource_order: {
            gte: newOrder,
            lt: currentOrder,
          },
        },
        data: {
          resource_order: {
            increment: 1,
          },
        },
      });
    } else if (newOrder > currentOrder) {
      // Moving resource DOWN (e.g. 3 → 9)
      await Prisma.resources.updateMany({
        where: {
          resource_order: {
            lte: newOrder,
            gt: currentOrder,
          },
        },
        data: {
          resource_order: {
            decrement: 1,
          },
        },
      });
    }

    dataToUpdate.resource_order = newOrder;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return { message: "No fields to update", status: 400 };
  }

  const updated = await Prisma.resources.update({
    where: { id },
    data: dataToUpdate,
  });

  return { message: "Resource updated", status: 200, data: updated };
};
