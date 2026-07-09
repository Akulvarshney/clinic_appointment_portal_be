import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import { tabFeatureConfig } from "./TabsAndFeatureStatic.js";

export const ensureSuperAdminExists = async () => {
  const existing = await prisma.super_admins.findFirst({
    where: { is_valid: true },
    include: { users: true },
  });

  if (existing) {
    console.log(`✅ Super Admin already exists: ${existing.users.email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(process.env.DEFAULT_PASSWORD, 10);

  const user = await prisma.users.create({
    data: {
      email: "ayogiMed@gmail.com",
      password_hash: hashedPassword,
      full_name: "Ayogi Super Admin",
      phone: "9876543210",
      login_id: "superadmin",
    },
  });

  await prisma.super_admins.create({
    data: {
      user_id: user.id,
      is_valid: true,
    },
  });

  console.log("🚀 Initial Super Admin created successfully.");
};

export const syncTabsAndFeatures = async () => {
  console.log("🔄 Synchronizing Tabs and Features...");
  const startTime = Date.now();

  // 1. Fetch all existing tabs and features to minimize DB queries
  const existingTabs = await prisma.tabs.findMany();
  const tabMap = new Map(existingTabs.map((t) => [t.tab_unique_name, t]));

  const existingFeatures = await prisma.feature.findMany();
  const featureMap = new Map(
    existingFeatures.map((f) => [f.feature_unique_name, f])
  );

  // 2. Sync Tabs
  for (const tabConfig of tabFeatureConfig) {
    let tab = tabMap.get(tabConfig.tab_unique_name);
    if (!tab) {
      tab = await prisma.tabs.create({
        data: {
          tab_unique_name: tabConfig.tab_unique_name,
          tab_name: tabConfig.tab_name,
          tab_path: tabConfig.tab_path || null,
          is_valid: true,
        },
      });
      tabMap.set(tab.tab_unique_name, tab);
    } else if (tab.tab_path !== tabConfig.tab_path) {
      tab = await prisma.tabs.update({
        where: { id: tab.id },
        data: { tab_path: tabConfig.tab_path || null },
      });
      tabMap.set(tab.tab_unique_name, tab);
    }
  }

  // 3. Sync Features
  for (const tabConfig of tabFeatureConfig) {
    const tab = tabMap.get(tabConfig.tab_unique_name);
    for (const featureConfig of tabConfig.features) {
      let feature = featureMap.get(featureConfig.feature_unique_name);
      if (!feature) {
        feature = await prisma.feature.create({
          data: {
            tab_id: tab.id,
            feature_unique_name: featureConfig.feature_unique_name,
            feature_name: featureConfig.feature_name,
            is_valid: true,
          },
        });
        featureMap.set(feature.feature_unique_name, feature);
      }
    }
  }

  // 4. Fetch all roles and existing tab-roles mapping
  const roles = await prisma.roles.findMany();
  const existingTabRoles = await prisma.tabs_role_table.findMany();
  let tabRoleMap = new Map(
    existingTabRoles.map((tr) => [`${tr.tab_id}_${tr.role_id}`, tr])
  );

  const tabRolesToCreate = [];
  const tabRolesToUpdate = [];

  for (const tabConfig of tabFeatureConfig) {
    const tab = tabMap.get(tabConfig.tab_unique_name);
    for (const role of roles) {
      const key = `${tab.id}_${role.id}`;
      const tabRole = tabRoleMap.get(key);
      const tabRoleIsValid = role.is_admin || false;

      if (!tabRole) {
        tabRolesToCreate.push({
          tab_id: tab.id,
          role_id: role.id,
          is_valid: tabRoleIsValid,
        });
      } else if (role.is_admin && !tabRole.is_valid) {
        tabRolesToUpdate.push(tabRole.id);
      }
    }
  }

  // Bulk create new tab-roles
  if (tabRolesToCreate.length > 0) {
    console.log(`🔄 Bulk creating ${tabRolesToCreate.length} tab-roles...`);
    await prisma.tabs_role_table.createMany({
      data: tabRolesToCreate,
    });
  }

  // Bulk update invalid admin tab-roles
  if (tabRolesToUpdate.length > 0) {
    console.log(`🔄 Bulk updating ${tabRolesToUpdate.length} tab-roles...`);
    await prisma.tabs_role_table.updateMany({
      where: { id: { in: tabRolesToUpdate } },
      data: { is_valid: true },
    });
  }

  // If we created or updated any tab-roles, re-fetch them to update our in-memory map
  if (tabRolesToCreate.length > 0 || tabRolesToUpdate.length > 0) {
    const allTabRoles = await prisma.tabs_role_table.findMany();
    tabRoleMap = new Map(
      allTabRoles.map((tr) => [`${tr.tab_id}_${tr.role_id}`, tr])
    );
  }

  // 5. Fetch all existing feature-tab-roles mapping
  const existingFeatureTabRoles = await prisma.feature_tab_role.findMany();
  const featureTabRoleMap = new Map(
    existingFeatureTabRoles.map((ftr) => [
      `${ftr.tab_role_id}_${ftr.feature_id}`,
      ftr,
    ])
  );

  const featureTabRolesToCreate = [];
  const featureTabRolesToUpdate = [];

  for (const tabConfig of tabFeatureConfig) {
    const tab = tabMap.get(tabConfig.tab_unique_name);
    const allTabFeatures = Array.from(featureMap.values()).filter(
      (f) => f.tab_id === tab.id
    );

    for (const role of roles) {
      const tabRoleKey = `${tab.id}_${role.id}`;
      const tabRole = tabRoleMap.get(tabRoleKey);
      if (!tabRole) continue;

      const featureIsValid = role.is_admin || false;

      for (const feature of allTabFeatures) {
        const ftrKey = `${tabRole.id}_${feature.id}`;
        const featureTabRole = featureTabRoleMap.get(ftrKey);

        if (!featureTabRole) {
          featureTabRolesToCreate.push({
            tab_role_id: tabRole.id,
            feature_id: feature.id,
            is_valid: featureIsValid,
          });
        } else if (role.is_admin && !featureTabRole.is_valid) {
          featureTabRolesToUpdate.push(featureTabRole.id);
        }
      }
    }
  }

  // Bulk create new feature-tab-roles
  if (featureTabRolesToCreate.length > 0) {
    console.log(
      `🔄 Bulk creating ${featureTabRolesToCreate.length} feature-tab-roles...`
    );
    await prisma.feature_tab_role.createMany({
      data: featureTabRolesToCreate,
    });
  }

  // Bulk update invalid admin feature-tab-roles
  if (featureTabRolesToUpdate.length > 0) {
    console.log(
      `🔄 Bulk updating ${featureTabRolesToUpdate.length} feature-tab-roles...`
    );
    await prisma.feature_tab_role.updateMany({
      where: { id: { in: featureTabRolesToUpdate } },
      data: { is_valid: true },
    });
  }

  console.log(`✅ Tabs and Features synchronized in ${Date.now() - startTime}ms`);
};
