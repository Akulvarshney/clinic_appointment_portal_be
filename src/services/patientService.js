import Prisma from "../prisma.js";
import { welcomeClientTemplate } from "../util/emailTemplates.js";
import { hashPassword } from "../util/password.js";
import { sendEmail } from "../util/sendMail.js";
import { checkNotificationActive } from "../util/checkNotificationActive.js";

async function generateClientPortalId(organization_id) {
  return await Prisma.$transaction(async (tx) => {
    const latest = await tx.client_organization_category.findFirst({
      where: {
        portal_id: {
          startsWith: "CL_",
        },
        organization_id,
      },
      orderBy: {
        portal_id: "desc",
      },
      select: {
        portal_id: true,
      },
    });

    // Step 2: Calculate new portal_id
    let nextNumber = 1;
    if (latest?.portal_id) {
      const numPart = parseInt(latest.portal_id.split("_")[1]);
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
  state,
  city,
  country,
  pinCode,
  emergencyContact,
  category,
  organization_id,
  roleId
) => {
  const login_id = await generateLoginId(Firstname, Secondname);
  const portal_id = await generateClientPortalId(organization_id);
  console.log("portlaId created>> ", portal_id);

  return await Prisma.$transaction(async (tx) => {
    const newUser = await tx.users.create({
      data: {
        email: email || "",
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

    const parsedDob =
      dob && !isNaN(new Date(dob).getTime()) ? new Date(dob) : null;

    const client = await tx.clients.create({
      data: {
        first_name: Firstname,
        last_name: Secondname,
        email: email || null,
        phone: mobile || null,
        userid: newUser.id,
        address: address || null,
        state: state || null,
        city: city || null,
        country: country || null,
        pinCode: pinCode || null,
        date_of_birth: parsedDob,
        gender: gender || null,
        occupation: occupation || null,
        emergencycontact: emergencyContact || null,
        portalid: portal_id,
      },
    });

    console.log("client new reg ", client);
    const client_ord_cat = await tx.client_organization_category.create({
      data: {
        organization_id,
        client_id: client.id,
        category_id: category,
        portal_id,
        //is_valid: true,
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

      if (valid_notification && email) {
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

export const clientListingService = async ({
  search,
  page,
  limit,
  orgId,
  categoryId,
  sort,
  sortDir,
}) => {
  const searchTerm = typeof search === "string" ? search.trim() : "";
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;

  // Build client filter for search
  const clientFilter = searchTerm
    ? {
        OR: [
          { first_name: { contains: searchTerm, mode: "insensitive" } },
          { last_name: { contains: searchTerm, mode: "insensitive" } },
          { phone: { contains: searchTerm } },
        ],
      }
    : {};

  // Build category filter
  const categoryFilter = categoryId ? { category_id: categoryId } : {};

  // Determine ordering
  let orderByClause;
  if (sort === "portalid") {
    orderByClause = { portal_id: sortDir || "asc" };
  } else if (sort === "name") {
    orderByClause = [
      { clients: { first_name: sortDir || "asc" } },
      { clients: { last_name: sortDir || "asc" } },
    ];
  } else {
    orderByClause = { clients: { first_name: "asc" } };
  }

  // Query client_organization_category table to handle portalid sorting and filters
  const categoriesWithClients =
    await Prisma.client_organization_category.findMany({
      where: {
        organization_id: orgId,
        ...categoryFilter,
        clients: clientFilter,
      },
      orderBy: orderByClause,
      include: {
        clients: true,
        categories: true,
        organizations: true,
      },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

  // Map results back to client structure
  const clients = categoriesWithClients.map((c) => ({
    ...c.clients,
    client_organization_category: [c],
  }));

  // Get total count for pagination
  const totalCount = await Prisma.client_organization_category.count({
    where: {
      organization_id: orgId,
      ...categoryFilter,
      clients: clientFilter,
    },
  });

  return {
    data: clients,
    total: totalCount,
    currentPage: pageNum,
    totalPages: Math.ceil(totalCount / limitNum),
  };
};

export const clientSearchService = async (search, limit, orgId) => {
  // NOTE: `clients` has no `organization_id` column - org membership is
  // resolved via the client_organization_category join table (same pattern
  // used by clientListingService above).
  const clientFilter = search
    ? {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
        ],
      }
    : {};

  const whereClause = {
    organization_id: orgId,
    clients: clientFilter,
  };

  const categoriesWithClients = await Prisma.client_organization_category.findMany({
    where: whereClause,
    orderBy: { clients: { first_name: "asc" } },
    take: limit ? parseInt(limit, 10) : 5,
    include: {
      clients: true,
      categories: true,
    },
  });

  const clients = categoriesWithClients.map((c) => ({
    ...c.clients,
    client_organization_category: [c],
  }));

  const totalCount = await Prisma.client_organization_category.count({
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
