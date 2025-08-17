import jwt from "jsonwebtoken";
import { verifyPassword } from "../util/password.js";
import prisma from "../prisma.js"; // make sure this is set up correctly
import dotenv from "dotenv";
import { saveToken } from "./tokenService.js";
dotenv.config();

export const loginUser = async (loginId, password) => {
  const user = await prisma.users.findFirst({
    where: {
      login_id: loginId,
    },
    include: {
      user_organizations: {
        where: { is_valid: true },
        include: {
          organizations: true,
          user_roles: {
            where: { is_valid: true },
            include: {
              roles: {
                include: {
                  tabs_role_table: {
                    where: { is_valid: true },
                    include: {
                      tabs: {
                        include: {
                          feature: {
                            where: { is_valid: true },
                          },
                        },
                      },
                      feature_tab_role: {
                        where: { is_valid: true },
                        include: {
                          feature: true,
                        },
                      },
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

  if (!user) throw new Error("User not found");
  if (!user.is_valid) throw new Error("User is deactivated.");
  if (!(await verifyPassword(password, user.password_hash))) {
    throw new Error("Invalid Password");
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

  await saveToken(user.id, token);

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login: new Date() },
  });

  const organizations = user.user_organizations.map((uo) => {
    const org = uo.organizations;

    const roles = uo.user_roles.map((ur) => {
      const role = ur.roles;

      const tabs = role.tabs_role_table.map((trt) => {
        const tab = trt.tabs;

        const features = trt.feature_tab_role.map((ftr) => {
          const feature = ftr.feature;
          return {
            feature_id: feature.id,
            feature_name: feature.feature_name,
            feature_unique_name: feature.feature_unique_name,
            is_valid: feature.is_valid,
            is_deletable: feature.is_deletable,
          };
        });

        return {
          tab_id: tab.id,
          tab_name: tab.tab_name,
          tab_path: tab.tab_path,
          tab_unique_name: tab.tab_unique_name,
          is_valid: tab.is_valid,
          tab_number: tab.tab_number,
          features,
        };
      });

      return {
        role_id: role.id,
        role_name: role.name,
        description: role.description,
        is_admin: role.is_admin,
        is_deletable: role.is_deletable,
        tabs,
      };
    });

    return {
      organizationId: org.id,
      organizationName: org.name,
      address: org.address,
      shortorgname: org.shortorgname,
      gstnumber: org.gstnumber,
      is_valid: org.is_valid,
      is_complete: org.is_complete,
      roles,
    };
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
    },
    organizations,
  };
};
