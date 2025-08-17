import { sendResponse } from "../util/response.js";
import {
  createRoleService,
  createRoleWithTabsFeatures,
  createEmployeeService,
  getRoleService,
  createDoctorService,
  getDoctorService,
  getEmployeesService,
  updateRoleService,
} from "../services/userMgmtService.js";
import { response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_organizations: {
          include: {
            organizations: true,
            user_roles: {
              include: {
                roles: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Transform the data to make it more accessible
    const userWithRoles = {
      ...user,
      organizations: user.user_organizations.map((userOrg) => ({
        ...userOrg.organizations,
        roles: userOrg.user_roles.map((userRole) => userRole.roles),
      })),
    };

    // Remove the nested structure since we've flattened it
    delete userWithRoles.user_organizations;

    return res.status(200).json({
      message: "User details retrieved successfully",
      user: userWithRoles,
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const createRoleController = async (req, res) => {
  try {
    const { roleName, roleDesc, orgId } = req.body;
    const response = await createRoleWithTabsFeatures(
      roleName,
      roleDesc,
      orgId
    );
    sendResponse(
      res,
      { message: response.message, status: response.status },
      200
    );
  } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(401).json({ message: error.message });
  }
};
export const getRolesController = async (req, res) => {
  try {
    const { orgId } = req.query;
    const response = await getRoleService(orgId);
    sendResponse(
      res,
      { message: response.message, response, status: response.status },
      200
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "Error getting the records" });
  }
};

export const getTabsAndFeaturesByRoleController = async (req, res) => {
  try {
    const { roleId } = req.query;

    console.log("Fetching tabs and features for roleId:", roleId);

    const tabRoles = await prisma.tabs_role_table.findMany({
      where: {
        role_id: roleId,
        // is_valid: true,
      },
      include: {
        tabs: true, // 'tabs' is the relation field to the `tabs` table
        feature_tab_role: {
          include: {
            feature: true, // 'feature' is the relation field to the `feature` table
          },
        },
      },
    });

    console.log("tabRoles:", tabRoles);

    const result = tabRoles.map((tabRole) => ({
      tabId: tabRole.tab_id,
      tabName: tabRole.tabs?.tab_name || null,
      tabUniqueName: tabRole.tabs?.tab_unique_name || null,
      features: tabRole.feature_tab_role.map((featureMap) => ({
        featureId: featureMap.feature_id,
        featureName: featureMap.feature?.feature_name || null,
        featureUniqueName: featureMap.feature?.feature_unique_name || null,
        isValid: featureMap.is_valid,
      })),
    }));

    return res.status(200).json({
      success: true,
      message: "Tabs and features fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getTabsAndFeaturesByRole:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const updateTabAndFeatureAccess = async (req, res) => {
  const { roleId, tabFeatureMapping } = req.body;

  if (!roleId || !Array.isArray(tabFeatureMapping)) {
    return res.status(400).json({
      success: false,
      message: "roleId and tabFeatureMapping are required",
    });
  }

  try {
    for (const tab of tabFeatureMapping) {
      const { tabId, features } = tab;

      // Fetch tab_role record
      const tabRole = await prisma.tabs_role_table.findFirst({
        where: {
          role_id: roleId,
          tab_id: tabId,
        },
      });

      if (!tabRole) {
        console.warn(
          `TabRole not found for tabId: ${tabId}, roleId: ${roleId}`
        );
        continue;
      }

      const tabRoleId = tabRole.id;

      let isAnyFeatureValid = false;

      for (const feature of features) {
        const { featureId, isValid } = feature;

        // Update or create feature access with correct is_valid value
        await prisma.feature_tab_role.upsert({
          where: {
            feature_id_tab_role_id: {
              feature_id: featureId,
              tab_role_id: tabRoleId,
            },
          },
          update: {
            is_valid: isValid,
          },
          create: {
            feature_id: featureId,
            tab_role_id: tabRoleId,
            is_valid: isValid,
          },
        });

        if (isValid) {
          isAnyFeatureValid = true;
        }
      }

      // Update tab validity based on feature access
      await prisma.tabs_role_table.update({
        where: { id: tabRoleId },
        data: { is_valid: isAnyFeatureValid },
      });
    }

    res.json({
      success: true,
      message: "Tabs and features updated successfully.",
    });
  } catch (error) {
    console.error("Error updating tab and feature access:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getEmployeesController = async (req, res) => {
  try {
    const {
      orgId,
      page = 1,
      limit = 10,
      search = "",
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;

    const response = await getEmployeesService({
      orgId,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      sortBy,
      sortOrder,
    });

    sendResponse(
      res,
      {
        message: "Employees fetched successfully",
        response,
        status: 200,
      },
      200
    );
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Error getting the records" });
  }
};

export const updateRoleController = async (req, res) => {
  try {
    const { userId, newRoleId, orgId } = req.body;
    const response = await updateRoleService(userId, newRoleId, orgId);
    sendResponse(
      res,
      { message: response.message, response, status: response.status },
      200
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "Error saving records the records" });
  }
};

export const getDoctorController = async (req, res) => {
  try {
    const { orgId } = req.query;
    const response = await getDoctorService(orgId);
    sendResponse(
      res,
      { message: response.message, response, status: response.status },
      200
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "Error getting the records" });
  }
};

export const createEmployeeController = async (req, res) => {
  try {
    const {
      roleId,
      emailId,
      firstName,
      lastName,
      DOB,
      gender,
      address,
      emergencyContact,
      //password,
      phone,
      //login_id,
      orgId,
    } = req.body;

    const response = await createEmployeeService(
      roleId,
      emailId,
      firstName,
      lastName,
      DOB,
      gender,
      address,
      emergencyContact,
      //password,
      phone,
      //login_id,
      orgId
    );
    sendResponse(
      res,
      { message: response.message, status: response.status },
      200
    );
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

export const createDoctorController = async (req, res) => {
  try {
    const {
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
      license_number,
    } = req.body;

    const response = await createDoctorService(
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
    );
    sendResponse(
      res,
      { message: response.message, status: response.status },
      200
    );
  } catch (error) {
    console.log("anaksha???? ", error);
    res.status(401).json({ message: error.message });
  }
};
