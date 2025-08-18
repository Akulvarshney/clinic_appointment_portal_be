import prisma from "../prisma.js";
import { sendErrorResponse, sendResponse } from "../util/response.js";

export const getNotificationsByOrg = async (req, res) => {
  try {
    const { organization_id } = req.params;

    const notifications = await prisma.notifications.findMany({
      where: { organization_id },
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

export const createNotification = async (req, res) => {
  try {
    const { name, description } = req.body;

    const organizations = await prisma.organizations.findMany({
      where: { is_valid: true },
      select: { id: true },
    });

    if (!organizations || organizations.length === 0) {
      return sendResponse(
        res,
        { message: "No organizations found to assign notifications" },
        404
      );
    }

    const notifications = await prisma.$transaction(
      organizations.map((org) =>
        prisma.notifications.create({
          data: {
            name,
            description,
            is_active: false,
            organization_id: org.id,
          },
        })
      )
    );

    return sendResponse(
      res,
      {
        message: "Notification created successfully for all organizations",
        data: notifications,
      },
      201
    );
  } catch (error) {
    console.error("Error creating notifications for organizations:", error);
    return sendErrorResponse(res, error, 500);
  }
};

export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const updatedNotification = await prisma.notifications.update({
      where: { id },
      data: {
        name,
        description,
        is_active,
        updated_at: new Date(),
      },
    });

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
