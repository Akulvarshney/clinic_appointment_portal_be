import Prisma from "../prisma.js";
import { welcomeClientTemplate } from "../util/emailTemplates.js";
import { hashPassword } from "../util/password.js";
import { sendEmail } from "../util/sendMail.js";
import { checkNotificationActive } from "../util/checkNotificationActive.js";

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

async function generateLoginId(firstName, lastName) {
  const baseLoginId =
    lastName && lastName.trim() !== ""
      ? `${firstName.trim().toLowerCase()}.${lastName.trim().toLowerCase()}`
      : firstName.trim().toLowerCase();

  let counter = 1;
  const MAX_ATTEMPTS = 100;

  while (counter <= MAX_ATTEMPTS) {
    const suffix = counter === 1 ? "" : counter.toString().padStart(2, "0");
    const loginId = `${baseLoginId}${suffix}`;

    const existingUser = await Prisma.users.findUnique({
      where: { login_id: loginId },
      select: { id: true },
    });

    if (!existingUser) {
      return loginId; // ✅ Found unique ID
    }

    counter++;
  }

  throw new Error(
    "Failed to generate unique login ID after multiple attempts."
  );
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
  const login_id = await generateLoginId(Firstname, Secondname);
  const portal_id = await generateClientPortalId();
  console.log("portlaId created>> ", portal_id);

  return await Prisma.$transaction(async (tx) => {
    const newUser = await tx.users.create({
      data: {
        email: email,
        password_hash: await hashPassword(process.env.DEFAULT_CLIENT_PASSWORD),
        full_name: Firstname + " " + Secondname,
        phone: mobile,
        login_id: login_id,
      },
    });

    const orgName = await tx.organizations.findUnique({
      where: { id: organization_id },
    });
    if (!orgName) {
      throw new Error("Organization not found");
    }

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
        //category_id: category,
        date_of_birth: dob ? new Date(dob) : null,
        organization_id,
        gender,
        occupation,
        emergencycontact: emergencyContact,
        portalid: portal_id,
      },
    });
    console.log("client new reg ", client);
    const client_ord_cat = await tx.client_organization_category.create({
      data: {
        organization_id,
        client_id: client.id,
        category_id: category,
      },
    });
    console.log("client new reg2 ", client_ord_cat);
    await tx.user_roles.create({
      data: {
        role_id: roleId,
        user_organization_id: user_org.id,
      },
    });

    if (client) {
      const valid_notification = await checkNotificationActive(
        organization_id,
        "SEND_CLIENT_REG_EMAIL"
      );

      if (valid_notification) {
        console.log("Sending Email");
        const { subject, text, html } = welcomeClientTemplate(
          Firstname,
          orgName.name,
          login_id,
          process.env.DEFAULT_CLIENT_PASSWORD
        );
        await sendEmail({
          to: email,
          subject,
          text,
          html,
        });
      } else {
        console.log("not sending email");
      }

      return { message: "Registration Successful", status: 200 };
    } else return { message: "Error in Registration", status: 400 };
  });
};

// controller
export const clientListingConroller = async (req, res) => {
  const { search = "", page = 1, limit = 10, orgId, categoryId } = req.query;

  try {
    const response = await clientListingService({
      search,
      page,
      limit,
      orgId,
      categoryId,
    });
    res.json(response);
  } catch (error) {
    console.error("Error in client listing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// service
export const clientListingService = async ({
  search,
  page,
  limit,
  orgId,
  categoryId,
}) => {
  console.log("Org ID:", orgId);
  console.log("Search:", search);
  console.log("Page:", page);
  console.log("Category ID:", categoryId);

  // Ensure search is always a string
  const searchTerm = typeof search === "string" ? search.trim() : "";

  // Ensure pagination is numeric
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;

  // Build where clause safely
  const whereClause = {
    ...(orgId ? { organization_id: orgId } : {}), // only include if defined
    AND: [
      //{ is_valid: true },
      searchTerm
        ? {
            OR: [
              { first_name: { contains: searchTerm, mode: "insensitive" } },
              { last_name: { contains: searchTerm, mode: "insensitive" } },
              { phone: { contains: searchTerm } },
              { email: { contains: searchTerm, mode: "insensitive" } },
            ],
          }
        : {},
      //categoryId ? { category_id: categoryId } : {},
      categoryId
        ? {
            client_organization_category: {
              some: { category_id: categoryId },
            },
          }
        : {},
    ],
  };

  const clients = await Prisma.clients.findMany({
    where: whereClause,
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
    orderBy: { first_name: "asc" },
    //include: { categories: true },
    include: {
      client_organization_category: {
        include: {
          categories: true,
        },
      },
    },
  });

  const totalCount = await Prisma.clients.count({
    where: whereClause,
  });

  return {
    data: clients,
    total: totalCount,
    currentPage: pageNum,
    totalPages: Math.ceil(totalCount / limitNum),
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
      //categories: true,
      client_organization_category: {
        include: {
          categories: true,
        },
      },
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
