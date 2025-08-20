import prisma from "../prisma.js";
import { sendErrorResponse, sendResponse } from "../util/response.js";

export const getNotificationsByOrg = async (req, res) => {
  try {
    const { organization_id } = req.params;
    const notifications = await prisma.notifications_organizations.findMany({
      where: {
        organization_id,
        notifications: {
          is_valid: true,
        },
      },
      orderBy: { created_at: "desc" },
      include: {
        notifications: true,
      },
    });

    const formatted = notifications.map((n) => ({
      id: n.id, // mapping id
      notification_id: n.notification_id,
      organization_id: n.organization_id,
      name: n.notifications.name, // flattened
      description: n.notifications.description,
      is_active: n.is_active,
      created_at: n.created_at,
      updated_at: n.updated_at,
    }));
    return sendResponse(
      res,
      {
        message: "Notifications retrieved successfully",
        data: formatted,
      },
      200
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return sendErrorResponse(res, error, 500);
  }
};
// Used by SuperAdmin New added commit ?
export const createNotification = async (req, res) => {
  try {
    const { name, description, uniqueName } = req.body;

    const organizations = await prisma.organizations.findMany({
      where: { is_valid: true },
      select: { id: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // create notification
      const notification = await tx.notifications.create({
        data: {
          name,
          description,
          unique_notification_name: uniqueName,
          is_valid: true,
        },
      });

      // assign to organizations (only if orgs exist)
      if (organizations.length > 0) {
        await tx.notifications_organizations.createMany({
          data: organizations.map((org) => ({
            notification_id: notification.id,
            organization_id: org.id,
            is_active: false,
          })),
        });
      }

      return notification;
    });

    return sendResponse(
      res,
      {
        message: "Notification created and assigned to all organizations",
        data: result,
      },
      201
    );
  } catch (error) {
    console.error("Error creating notification:", error);
    return sendErrorResponse(res, error, 500);
  }
};

//Used by superAdmin
export const getALLNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notifications.findMany({
      orderBy: { created_at: "desc" },
    });

    return sendResponse(
      res,
      {
        message: "Notifications retrieved successfully",
        data: notifications,
      },
      200
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return sendErrorResponse(res, error, 500);
  }
};

export const changeNotificationStatusMaster = async (req, res) => {
  try {
    const { id } = req.query;
    const { enabled } = req.body;

    await prisma.$transaction(async (tx) => {
      // Update master notification
      await tx.notifications.update({
        where: { id },
        data: { is_valid: enabled },
      });

      await tx.notifications_organizations.updateMany({
        where: { notification_id: id },
        data: { is_active: false },
      });
    });

    return sendResponse(
      res,
      {
        message: "Notifications updated successfully",
      },
      200
    );
  } catch (error) {
    console.error("Error updating notifications:", error);
    return sendErrorResponse(res, error, 500);
  }
};

export const updateNotification = async (req, res) => {
  try {
    const { id } = req.query;
    const { is_active } = req.body;

    const updatedNotification = await prisma.notifications_organizations.update(
      {
        where: { id },
        data: {
          is_active,
          updated_at: new Date(),
        },
      }
    );

    return sendResponse(
      res,
      {
        message: "Notification updated successfully",
        data: updatedNotification,
      },
      200
    );
  } catch (error) {
    console.error("Error updating notification:", error);
    return sendErrorResponse(res, error, 500);
  }
};
