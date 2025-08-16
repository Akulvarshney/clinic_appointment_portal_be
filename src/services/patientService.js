import Prisma from "../prisma.js";
import { hashPassword } from "../util/password.js";

async function generateClientPortalId() {
  return await Prisma.$transaction(async (tx) => {
    const latest = await tx.clients.findFirst({
      where: {
        portalid: {
          startsWith: "CL_",
        },
      },
      orderBy: {
        portalid: "desc",
      },
      select: {
        portalid: true,
      },
    });

    // Step 2: Calculate new portalId
    let nextNumber = 1;
    if (latest?.portalid) {
      const numPart = parseInt(latest.portalid.split("_")[1]);
      if (!isNaN(numPart)) {
        nextNumber = numPart + 1;
      }
    }

    const newPortalId = `CL_${String(nextNumber).padStart(5, "0")}`;
    return newPortalId;
  });
}

export const registerClientService = async (
  Firstname,
  Secondname,
  address,
  mobile,
  dob,
  gender,
  occupation,
  email,
  emergencyContact,
  category,
  organization_id,
  roleId
) => {
  const portal_id = await generateClientPortalId();
  console.log("portlaId created>> ", portal_id);

  return await Prisma.$transaction(async (tx) => {
    const newUser = await tx.users.create({
      data: {
        email: email,
        password_hash: await hashPassword(process.env.DEFAULT_CLIENT_PASSWORD),
        full_name: Firstname + " " + Secondname,
        phone: mobile,
        login_id: portal_id,
      },
    });

    const user_org = await tx.user_organizations.create({
      data: {
        user_id: newUser.id,
        organization_id: organization_id,
      },
    });

    const client = await tx.clients.create({
      data: {
        first_name: Firstname,
        last_name: Secondname,
        email,
        phone: mobile,
        userid: newUser.id,
        address,
        category_id: category,
        date_of_birth: dob ? new Date(dob) : null,
        organization_id,
        gender,
        occupation,
        emergencycontact: emergencyContact,
        portalid: portal_id,
      },
    });
    await tx.user_roles.create({
      data: {
        role_id: roleId,
        user_organization_id: user_org.id,
      },
    });

    if (client) return { message: "Registration Successful", status: 200 };
    else return { message: "Error in Registration", status: 400 };
  });
};

export const clientListingService = async (search, page, limit, orgId) => {
  console.log(orgId);
  console.log(search);
  const whereClause = {
    OR: [
      { first_name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ],
    organization_id: orgId,
  };

  const clients = await Prisma.clients.findMany({
    // where: search ? whereClause : undefined,
    where: whereClause,
    skip: (page - 1) * limit,
    take: parseInt(limit),
    orderBy: { first_name: "asc" },
    include: {
      categories: true,
    },
  });
  console.log(clients);

  const totalCount = await Prisma.clients.count({
    where: search ? whereClause : undefined,
  });

  return {
    data: clients,
    total: totalCount,
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalCount / limit),
  };
};

export const clientSearchService = async (search, limit, orgId) => {
  console.log(orgId);
  console.log(search);
  const whereClause = {
    OR: [
      { first_name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ],
    organization_id: orgId,
  };

  const clients = await Prisma.clients.findMany({
    // where: search ? whereClause : undefined,
    where: whereClause,
    orderBy: { first_name: "asc" },
    take: limit ? parseInt(limit, 10) : 5,
    include: {
      categories: true,
    },
  });
  console.log(clients);

  const totalCount = await Prisma.clients.count({
    where: whereClause,
  });

  return {
    data: clients,
    total: totalCount,
  };
};

export const clientSearchByIdService = async (id) => {
  const client = await Prisma.clients.findUnique({
    where: { id: id },
    include: {
      categories: true,
      users: true,
      user_organizations: {
        include: {
          organizations: true,
        },
      },
    },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  return client;
};
