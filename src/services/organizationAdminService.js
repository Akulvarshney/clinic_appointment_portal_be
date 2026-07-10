import prisma from "../prisma.js";

export const getOrganizationDetailsForSA = async (shortName) => {
  const org = await prisma.organizations.findFirst({
    where: { shortorgname: shortName },
    include: {
      _count: {
        select: {
          doctors: true,
          employees: true,
          appointments: true,
        },
      },
      client_organization_category: {
        select: { client_id: true },
        distinct: ["client_id"],
      },
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // Count unique clients
  const clientCount = org.client_organization_category.length;

  // Find users with the ADMIN role for this organization
  const adminUsers = await prisma.users.findMany({
    where: {
      user_organizations: {
        some: {
          organization_id: org.id,
          user_roles: {
            some: {
              roles: {
                name: "ADMIN",
                is_admin: true,
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      full_name: true,
      email: true,
      phone: true,
      login_id: true,
      created_at: true,
    },
  });

  return {
    organization: {
      id: org.id,
      name: org.name,
      short_name: org.shortorgname,
      address: org.address,
      state: org.state,
      created_at: org.created_at,
    },
    metrics: {
      doctors: org._count.doctors,
      employees: org._count.employees,
      appointments: org._count.appointments,
      clients: clientCount,
    },
    admins: adminUsers,
  };
};

export const getOrganizationAdminTabs = async (shortName) => {
  const org = await prisma.organizations.findFirst({
    where: { shortorgname: shortName },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const adminRole = await prisma.roles.findFirst({
    where: {
      organization_id: org.id,
      name: "ADMIN",
    },
  });

  if (!adminRole) {
    throw new Error("Admin role not found for this organization");
  }

  const tabRoles = await prisma.tabs_role_table.findMany({
    where: {
      role_id: adminRole.id,
    },
    include: {
      tabs: true,
      feature_tab_role: {
        include: {
          feature: true,
        },
      },
    },
  });

  const result = tabRoles.map((tabRole) => ({
    tabId: tabRole.tab_id,
    tabName: tabRole.tabs?.tab_name || null,
    tabUniqueName: tabRole.tabs?.tab_unique_name || null,
    isValid: tabRole.is_valid,
  }));

  return {
    roleId: adminRole.id,
    tabs: result,
  };
};

export const updateOrganizationAdminTabs = async (shortName, tabMapping) => {
  const org = await prisma.organizations.findFirst({
    where: { shortorgname: shortName },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const adminRole = await prisma.roles.findFirst({
    where: {
      organization_id: org.id,
      name: "ADMIN",
    },
  });

  if (!adminRole) {
    throw new Error("Admin role not found for this organization");
  }

  for (const tab of tabMapping) {
    const { tabId, isValid } = tab;

    const tabRole = await prisma.tabs_role_table.findFirst({
      where: {
        role_id: adminRole.id,
        tab_id: tabId,
      },
    });

    if (!tabRole) continue;

    const tabRoleId = tabRole.id;

    // Update the tab's validity for ADMIN
    await prisma.tabs_role_table.update({
      where: { id: tabRoleId },
      data: { is_valid: isValid },
    });

    // Automatically update all features under this tab role to the same validity for ADMIN
    await prisma.feature_tab_role.updateMany({
      where: { tab_role_id: tabRoleId },
      data: { is_valid: isValid },
    });

    // If revoking, cascade to ALL roles in the organization
    if (!isValid) {
      const orgRoles = await prisma.roles.findMany({
        where: { organization_id: org.id },
        select: { id: true }
      });
      const orgRoleIds = orgRoles.map(r => r.id);

      const allTabRolesForTab = await prisma.tabs_role_table.findMany({
        where: { role_id: { in: orgRoleIds }, tab_id: tabId },
        select: { id: true }
      });

      if (allTabRolesForTab.length > 0) {
        await prisma.tabs_role_table.updateMany({
          where: { id: { in: allTabRolesForTab.map(t => t.id) } },
          data: { is_valid: false }
        });

        await prisma.feature_tab_role.updateMany({
          where: { tab_role_id: { in: allTabRolesForTab.map(t => t.id) } },
          data: { is_valid: false }
        });
      }
    }
  }

  return "Tabs updated successfully.";
};
