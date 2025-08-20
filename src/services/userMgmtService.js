import prisma from "../prisma.js";
import Prisma from "../prisma.js";
import {
  welcomeDoctoreTemplate,
  welcomeEmployeeTemplate,
} from "../util/emailTemplates.js";
import { hashPassword } from "../util/password.js";
import { sendEmail } from "../util/sendMail.js";
import { checkNotificationActive } from "../util/checkNotificationActive.js";

export const createRoleService = async (roleNname, roleDesc, orgId) => {
  const Newrole = await Prisma.roles.create({
    data: { organization_id: orgId, name: roleNname, description: roleDesc },
  });
  const tabs = await Prisma.tabs.findMany({
    where: { is_valid: true },
  });
  const features = await Prisma.feature.findMany({
    where: { is_valid: true },
  });

  for (const tab of tabs) {
    await Prisma.tabs_role_table.create({
      data: {
        tab_id: tab.id,
        role_id: Newrole.id,
        is_valid: false,
      },
    });
  }

  return "Role created Successfully";
};

export const createRoleWithTabsFeatures = async (roleName, roleDesc, orgId) => {
  try {
    const role = await Prisma.roles.create({
      data: {
        organization_id: orgId,
        name: roleName,
        description: roleDesc,
        is_admin: false,
      },
    });

    // 2. Get all tabs and their features
    const allTabs = await Prisma.tabs.findMany({
      where: { is_valid: true },
      include: { feature: true },
    });

    // 3. For each tab, create tabs_role_table + feature_tab_role records
    for (const tab of allTabs) {
      const tabRole = await Prisma.tabs_role_table.create({
        data: {
          tab_id: tab.id,
          role_id: role.id,
          is_valid: false,
        },
      });

      const featureRolesData = tab.feature.map((f) => ({
        feature_id: f.id,
        tab_role_id: tabRole.id,
        is_valid: false,
      }));

      if (featureRolesData.length > 0) {
        await Prisma.feature_tab_role.createMany({
          data: featureRolesData,
        });
      }
    }

    return {
      success: true,
      message: "Role created with tabs and features initialized.",
      data: role,
    };
  } catch (error) {
    console.error("Error in createRoleWithTabsFeatures:", error);
    throw new Error("Failed to create role with default tabs and features.");
  }
};

export const getRoleService = async (orgId) => {
  console.log("orgId:", orgId);

  const record = await Prisma.roles.findMany({
    where: {
      organization_id: orgId,
      is_valid: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  return record;
};

export const getEmployeesService = async ({
  orgId,
  page,
  limit,
  search,
  sortBy,
  sortOrder,
}) => {
  const skip = (page - 1) * limit;

  const whereClause = {
    organization_id: orgId,
    is_valid: true,
    ...(search && {
      OR: [
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [employees, totalCount] = await Promise.all([
    Prisma.employees.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder.toLowerCase() === "asc" ? "asc" : "desc",
      },
      include: {
        users: {
          select: {
            login_id: true,
            is_valid: true,
            user_organizations: {
              where: {
                organization_id: orgId,
                is_valid: true,
              },
              select: {
                user_roles: {
                  where: { is_valid: true },
                  select: {
                    roles: { select: { name: true, id: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    Prisma.employees.count({ where: whereClause }),
  ]);

  return {
    data: employees,
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
};

export const getDoctorService = async ({
  orgId,
  page = 1,
  limit = 10,
  search,
}) => {
  try {
    const searchConditions = [];
    if (search) {
      searchConditions.push({
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { specialization: { contains: search, mode: "insensitive" } },
          { license_number: { contains: search, mode: "insensitive" } },
          { portalid: { contains: search, mode: "insensitive" } },

          {
            users: {
              is: {
                OR: [
                  { email: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search, mode: "insensitive" } },
                  { full_name: { contains: search, mode: "insensitive" } },
                  { login_id: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      });
    }

    const whereConditions = {
      organization_id: orgId,
      is_valid: true,
      ...(searchConditions.length > 0 && { AND: searchConditions }),
    };

    const skip = (page - 1) * limit;

    const totalRecords = await Prisma.doctors.count({
      where: whereConditions,
    });

    const records = await Prisma.doctors.findMany({
      where: whereConditions,
      orderBy: {
        portalid: "desc",
      },
      include: {
        users: true,
      },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      message: "Doctors retrieved successfully",
      status: "success",
      data: {
        records,
        currentPage: page,
        totalPages,
        totalRecords,
        recordsPerPage: limit,
      },
    };
  } catch (error) {
    console.error("Error in getDoctorService:", error);
    throw error;
  }
};

export const updateRoleService = async (userId, newRoleId, orgId) => {
  const userOrg = await Prisma.user_organizations.findFirst({
    where: {
      user_id: userId,
      organization_id: orgId,
    },
  });

  if (!userOrg) {
    throw new Error("User organization not found");
  }

  const userRole = await Prisma.user_roles.findFirst({
    where: {
      user_organization_id: userOrg.id,
    },
  });

  if (!userRole) throw new Error("User role not found");

  await Prisma.user_roles.update({
    where: { id: userRole.id },
    data: {
      role_id: newRoleId,
    },
  });

  return { message: "Role changed successfully", satus: 200 };
};

async function generateEmployeePortalId() {
  return await Prisma.$transaction(async (tx) => {
    const latest = await tx.employees.findFirst({
      where: {
        portalid: {
          startsWith: "EMP_",
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

    const newPortalId = `EMP_${String(nextNumber).padStart(5, "0")}`;
    return newPortalId;
  });
}

async function generateDoctorPortalId() {
  return await Prisma.$transaction(async (tx) => {
    const latest = await tx.doctors.findFirst({
      where: {
        portalid: {
          startsWith: "DOC_",
        },
      },
      orderBy: {
        portalid: "desc",
      },
      select: {
        portalid: true,
      },
    });
    console.log("doctor>>> ", latest);
    // Step 2: Calculate new portalId
    let nextNumber = 1;
    if (latest?.portalid) {
      const numPart = parseInt(latest.portalid.split("_")[1]);
      if (!isNaN(numPart)) {
        nextNumber = numPart + 1;
      }
    }

    const newPortalId = `DOC_${String(nextNumber).padStart(5, "0")}`;
    return newPortalId;
  });
}

export async function generateLoginId(orgName, firstName, DOB) {
  console.log(
    "Generating login_id for orgName:",
    orgName,
    "firstName:",
    firstName,
    "DOB:",
    DOB
  );
  const prefix = String(orgName).toLowerCase();

  let firstInitial = firstName.slice(0, 3).toLowerCase();
  const prefixRegex = /^(mr|mrs|ms|miss|dr|prof)\.?(\s|$)/i;
  if (prefixRegex.test(firstInitial.trim())) {
    firstInitial = firstName.slice(3, 6).toLowerCase();
  }
  const dob = new Date(DOB);
  const day = String(dob.getDate()).padStart(2, "0");

  const baseId = `${prefix}_${firstInitial}${day}`;
  let loginId = baseId;
  let counter = 1;

  while (true) {
    const existingUser = await prisma.users.findUnique({
      where: { login_id: loginId },
    });

    if (!existingUser) {
      return loginId;
    }

    loginId = `${baseId}_${counter}`;
    counter++;
  }
}

export const createEmployeeService = async (
  roleId,
  emailId,
  firstName,
  lastName,
  DOB,
  gender,
  address,
  emergencyContact,
  phone,
  orgId
) => {
  const shortorg = await Prisma.organizations.findFirst({
    where: {
      id: orgId,
    },
  });

  const role = await Prisma.roles.findFirst({
    where: {
      id: roleId,
      organization_id: orgId,
    },
  });
  if (!role) {
    throw new Error("Role not found for the given organization");
  }

  const name = shortorg ? shortorg.shortorgname : "EMP";
  const login_id = await generateLoginId(name, firstName, DOB);

  const hashedPassword = await hashPassword(process.env.DEFAULT_USER_PASSWORD);
  const login_id_check = await Prisma.users.findFirst({
    where: {
      login_id,
    },
  });
  if (login_id_check) {
    throw new Error(
      "login_id already exists. Please enter a different login_id"
    );
  }
  return await Prisma.$transaction(async (tx) => {
    const newUser = await tx.users.create({
      data: {
        email: emailId,
        password_hash: hashedPassword,
        full_name: firstName + " " + lastName,
        phone: phone,
        login_id: login_id,
      },
    });
    const user_org = await tx.user_organizations.create({
      data: {
        user_id: newUser.id,
        organization_id: orgId,
      },
    });
    await tx.user_roles.create({
      data: {
        role_id: roleId,
        user_organization_id: user_org.id,
      },
    });

    const newPortalId = await generateEmployeePortalId();

    console.log("newPortalId>>>>>  , ", newPortalId);
    const newEmployee = await tx.employees.create({
      data: {
        portalid: newPortalId,
        userid: newUser.id,
        first_name: firstName,
        last_name: lastName,
        email: emailId,
        phone: phone,
        date_of_birth: DOB,
        gender,
        address,
        emergencycontact: emergencyContact,
        organization_id: orgId,
      },
    });
    if (newEmployee) {
      const valid_notification = await checkNotificationActive(
        orgId,
        "SEND_EMP_REG_EMAIL"
      );
      if (valid_notification) {
        console.log("Sending email");
        const { subject, html, text } = welcomeEmployeeTemplate(
          firstName,
          shortorg.name,
          role.name,
          login_id,
          process.env.DEFAULT_USER_PASSWORD
        );
        await sendEmail({
          to: emailId,
          subject,
          html,
          text,
        });
      } else {
        console.log("Not Sending email");
      }

      return { message: "User created Successfully", status: 200 };
    } else return { message: "Error in generating Employee", status: 400 };
  });
};

export const createDoctorService = async (
  roleId,
  emailId,
  firstName,
  lastName,
  DOB,
  gender,
  address,
  emergencyContact,
  phone,
  orgId,
  license_number
) => {
  const newPortalId = await generateDoctorPortalId();

  const shortorg = await Prisma.organizations.findFirst({
    where: {
      id: orgId,
    },
  });
  const name = shortorg ? shortorg.shortorgname : "DOC";
  const login_id = await generateLoginId(name, firstName, DOB);

  console.log("login_id >>> ", login_id);

  const login_id_check = await Prisma.users.findFirst({
    where: {
      login_id,
    },
  });

  if (login_id_check) {
    throw new Error("Login Id already exists.");
  }

  const password = await hashPassword(process.env.DEFAULT_USER_PASSWORD);

  return await Prisma.$transaction(async (tx) => {
    const newUser = await tx.users.create({
      data: {
        email: emailId,
        phone: phone,
        password_hash: password,
        full_name: firstName + " " + lastName,
        phone: phone,
        login_id: login_id,
      },
    });
    const user_org = await tx.user_organizations.create({
      data: {
        user_id: newUser.id,
        organization_id: orgId,
      },
    });
    await tx.user_roles.create({
      data: {
        role_id: roleId,
        user_organization_id: user_org.id,
      },
    });

    const newEmployee = await tx.doctors.create({
      data: {
        portalid: newPortalId,
        userid: newUser.id,
        first_name: firstName,
        last_name: lastName,
        email: emailId,
        phone: phone,
        date_of_birth: DOB,
        gender,
        address,
        emergencycontact: emergencyContact,
        organization_id: orgId,
        license_number,
      },
    });
    if (newEmployee) {
      const valid_notification = await checkNotificationActive(
        orgId,
        "SEND_DOCT_REG_EMAIL"
      );
      if (valid_notification) {
        console.log("send email");
        const { subject, html, text } = welcomeDoctoreTemplate(
          firstName,
          shortorg.name,
          login_id,
          process.env.DEFAULT_USER_PASSWORD
        );
        await sendEmail({
          to: emailId,
          subject,
          html,
          text,
        });
      } else {
        console.log("Not sending email");
      }
      return { message: "Doctor created Successfully", status: 200 };
    } else return { message: "Error in generating Doctor", status: 400 };
  });
};
