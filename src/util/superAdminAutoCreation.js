import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { tabFeatureConfig } from "./TabsAndFeatureStatic.js";

const prisma = new PrismaClient();

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

  for (const tabConfig of tabFeatureConfig) {
    console.log(`🔄 Syncing tab: ${tabConfig.tab_name}`);

    let tab = await prisma.tabs.findUnique({
      where: { tab_unique_name: tabConfig.tab_unique_name },
    });

    if (!tab) {
      tab = await prisma.tabs.create({
        data: {
          tab_unique_name: tabConfig.tab_unique_name,
          tab_name: tabConfig.tab_name,
          tab_path: tabConfig.tab_path || null,
          is_valid: true,
        },
      });
    } else {
      // Update path if missing or changed
      if (tab.tab_path !== tabConfig.tab_path) {
        tab = await prisma.tabs.update({
          where: { id: tab.id },
          data: { tab_path: tabConfig.tab_path || null },
        });
      }
    }

    // Always sync features for the tab
    for (const featureConfig of tabConfig.features) {
      const existingFeature = await prisma.feature.findUnique({
        where: { feature_unique_name: featureConfig.feature_unique_name },
      });

      if (!existingFeature) {
        await prisma.feature.create({
          data: {
            tab_id: tab.id,
            feature_unique_name: featureConfig.feature_unique_name,
            feature_name: featureConfig.feature_name,
            is_valid: true,
          },
        });
      }
    }

    // Always sync tab-role and feature-role mapping for all roles
    const roles = await prisma.roles.findMany();

    for (const role of roles) {
      console.log(`🔄 Syncing tab-role for role: ${role.name}`);

      let tabRole = await prisma.tabs_role_table.findFirst({
        where: { tab_id: tab.id, role_id: role.id },
      });

      if (!tabRole) {
        tabRole = await prisma.tabs_role_table.create({
          data: {
            tab_id: tab.id,
            role_id: role.id,
            is_valid: false,
          },
        });
      }

      const allTabFeatures = await prisma.feature.findMany({
        where: { tab_id: tab.id },
      });

      for (const feature of allTabFeatures) {
        const featureTabRole = await prisma.feature_tab_role.findFirst({
          where: {
            tab_role_id: tabRole.id,
            feature_id: feature.id,
          },
        });

        if (!featureTabRole) {
          await prisma.feature_tab_role.create({
            data: {
              feature_id: feature.id,
              tab_role_id: tabRole.id,
              is_valid: false,
            },
          });
        }
      }
    }
  }

  console.log("✅ Tabs and Features synchronized");
};
