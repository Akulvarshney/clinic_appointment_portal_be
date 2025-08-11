import Prisma from "../prisma.js";
import { hashPassword } from "../util/password.js";

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

export const getEmployeesService = async (orgId) => {
  const employees = await Prisma.employees.findMany({
    where: {
      organization_id: orgId,
      is_valid: true,
      
    },
    orderBy: {
      first_name: "asc",
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
                where: {
                  is_valid: true,
                },
                select: {
                  roles: {
                    select: {
                      name: true,
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return employees;
};

export const getDoctorService = async (orgId) => {
  const record = await Prisma.doctors.findMany({
    where: {
      organization_id: orgId,
      is_valid: true,
    },
    orderBy: {
      portalid: "asc",
    },
  });
  return record;
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

export const createEmployeeService = async (
  roleId,
  emailId,
  firstName,
  lastName,
  DOB,
  gender,
  address,
  emergencyContact,
  password,
  phone,
  login_id,
  orgId
) => {
  const login_id_check = await Prisma.users.findFirst({
    where: {
      login_id,
    },
  });
  if (login_id_check) {
    // return {
    //   message: "login_id already exists. Please enter a different login_id",
    //   status: 400,
    // };
    throw new Error(
      "login_id already exists. Please enter a different login_id"
    );
  }
  return await Prisma.$transaction(async (tx) => {
    const newUser = await tx.users.create({
      data: {
        email: emailId,
        password_hash: await hashPassword(password),
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
    if (newEmployee)
      return { message: "User created Successfully", status: 200 };
    else return { message: "Error in generating Employee", status: 400 };
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
  console.log("newPortalId>>>>>  , ", newPortalId);
  console.log("password>>>> ", process.env.DEFAULT_PASSWORD);
  return await Prisma.$transaction(async (tx) => {
    const newUser = await tx.users.create({
      data: {
        email: emailId,
        phone: phone,
        password_hash: await hashPassword(process.env.DEFAULT_PASSWORD),
        full_name: firstName + " " + lastName,
        phone: phone,
        login_id: newPortalId,
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
    if (newEmployee)
      return { message: "Doctor created Successfully", status: 200 };
    else return { message: "Error in generating Doctor", status: 400 };
  });
};
