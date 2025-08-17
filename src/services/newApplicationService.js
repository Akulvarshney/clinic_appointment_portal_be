import { response } from "express";
import Prisma from "../prisma.js";
import { hashPassword } from "../util/password.js";
import {
  rejectApplicationTemplate,
  sendApproveApplicationTemplate,
} from "../util/emailTemplates.js";
import { sendEmail } from "../util/sendMail.js";

export const new_application_submit = async (
  org_name,
  org_short_name,
  email,
  Mobile,
  client_name
) => {
  try {
    const newApp = await Prisma.organization_applications.create({
      data: {
        organization_name: org_name,
        org_short_name: org_short_name,
        email,
        phone: Mobile,
        clientName: client_name,
      },
    });
    return {
      message: "Successfully Submitted with tacking id: " + newApp.trackingid,
    };
  } catch (err) {
    console.error("Error submitting application:", err);
    throw new Error("Application submission failed");
  }
};

export const checkStatus = async (trackingId, mobileNumber) => {
  console.log("tracking id ", trackingId, " ", mobileNumber);
  const record = await Prisma.organization_applications.findFirst({
    where: {
      trackingid: trackingId,
      phone: mobileNumber,
    },
  });
  console.log("record>> ", record);
  if (!record || record == undefined) {
    // throw new Error("Tracking id not found with this mobile ");
    throw new Error("Tracking id not found with this mobile");
  }
  return {
    message: "Tracking id Status Code:" + record.application_status,
    status: record.application_status,
  }; //0 Pending , 1 Approved , 2 Rejected
};

export const getStatusList = async (status) => {
  //  Pagination , sort
  const records = await Prisma.organization_applications.findMany({
    where: {
      application_status: status,
    },
  });
  console.log("records here ", records);
  if (!records) {
    throw new Error("No Data Found ");
  }
  return records;
};

export const NewApplicationActionService = async (uuid, Action, remarks) => {
  const record = await Prisma.organization_applications.findFirst({
    where: {
      id: uuid,
    },
  });

  if (!record) {
    throw new Error("Application not found");
  }
  if (record.application_status === "APPROVED") {
    return "Application Already Approved";
  }
  console.log(Action);
  switch (Action) {
    case "APPROVED":
      await ApproveApplication(uuid, record);

      return "Application Approved Succesfully";
    case "REJECTED":
      await Prisma.organization_applications.update({
        where: {
          id: uuid,
        },
        data: {
          application_status: "REJECTED",
          rejection_remarks: remarks,
        },
      });

      const { subject, html, text } = rejectApplicationTemplate(
        record.clientname,
        record.trackingid
      );
      await sendEmail({
        to: record.email,
        subject,
        html,
        text,
      });
      return "Application Rejected Succesfully";
  }
};

export async function ApproveApplication(uuid, record) {
  const hashedPassword = await hashPassword(
    process.env.DEFAULT_CLIENT_ADMIN_PASSWORD
  );

  const result = await Prisma.$transaction(
    async (tx) => {
      // Check for existing organization
      const existingOrg = await tx.organizations.findFirst({
        where: {
          OR: [
            { name: record.organization_name },
            { shortorgname: record.org_short_name },
          ],
        },
      });
      if (existingOrg)
        throw new Error(
          "Organization already exists with this Name or Short Name"
        );

      // Check for existing user
      // const existingUser = await tx.users.findUnique({
      //   where: { email: record.email },
      // });
      // if (existingUser) throw new Error("User with this email already exists");

      // Approve the application
      await tx.organization_applications.update({
        where: { id: uuid },
        data: { application_status: "APPROVED" },
      });

      // Create organization
      const newOrg = await tx.organizations.create({
        data: {
          name: record.organization_name,
          address: record.address,
          shortorgname: record.org_short_name,
        },
      });

      const loginId = "admin_" + record.org_short_name;

      // Create user
      const newUser = await tx.users.create({
        data: {
          email: record.email,
          password_hash: hashedPassword,
          full_name: record.clientname,
          phone: record.phone,
          login_id: loginId,
        },
      });

      // Link user to organization
      const userOrg = await tx.user_organizations.create({
        data: {
          user_id: newUser.id,
          organization_id: newOrg.id,
        },
      });

      // Create default roles
      const [adminRole, doctorRole, clientRole] = await Promise.all([
        tx.roles.create({
          data: {
            organization_id: newOrg.id,
            name: "ADMIN",
            description: "DEFAULT ADMIN",
            is_admin: true,
            is_deletable: false,
          },
        }),
        tx.roles.create({
          data: {
            organization_id: newOrg.id,
            name: "DOCTOR",
            description: "DEFAULT DOCTOR",
            is_admin: false,
            is_deletable: false,
          },
        }),
        tx.roles.create({
          data: {
            organization_id: newOrg.id,
            name: "CLIENT",
            description: "DEFAULT CLIENT",
            is_admin: false,
            is_deletable: false,
          },
        }),
      ]);

      await tx.user_roles.create({
        data: {
          user_organization_id: userOrg.id,
          role_id: adminRole.id,
        },
      });

      // Fetch all valid tabs and their features
      const tabs = await tx.tabs.findMany({
        where: { is_valid: true },
        include: { feature: true },
      });

      for (const tab of tabs) {
        // Create tab-role mappings
        const [adminTab, doctorTab, clientTab] = await Promise.all([
          tx.tabs_role_table.create({
            data: {
              tab_id: tab.id,
              role_id: adminRole.id,
              is_valid: true,
            },
          }),
          tx.tabs_role_table.create({
            data: {
              tab_id: tab.id,
              role_id: doctorRole.id,
              is_valid: false,
            },
          }),
          tx.tabs_role_table.create({
            data: {
              tab_id: tab.id,
              role_id: clientRole.id,
              is_valid: false,
            },
          }),
        ]);

        // Create feature-tab-role mappings
        const featureMappings = tab.feature.flatMap((feature) => [
          {
            feature_id: feature.id,
            tab_role_id: adminTab.id,
            is_valid: true,
          },
          {
            feature_id: feature.id,
            tab_role_id: doctorTab.id,
            is_valid: false,
          },
          {
            feature_id: feature.id,
            tab_role_id: clientTab.id,
            is_valid: false,
          },
        ]);

        if (featureMappings.length > 0) {
          await tx.feature_tab_role.createMany({ data: featureMappings });
        }
      }

      return { organizationId: newOrg.id, userId: newUser.id };
    },
    {
      timeout: 20000,
    }
  );

  const { subject, html, text } = sendApproveApplicationTemplate(
    record.clientname,
    record.trackingid,
    loginId,
    process.env.DEFAULT_CLIENT_ADMIN_PASSWORD
  );
  await sendEmail({
    to: record.email,
    subject,
    html,
    text,
  });

  return result;
}

export const checkShortNameService = async (shortName) => {
  console.log(shortName);
  const record = await Prisma.organization_applications.findMany({
    where: {
      org_short_name: shortName,
    },
  });
  console.log(record.length);
  if (record.length > 0) {
    throw new Error("Organization short name already exists");
  } else {
    return "1";
  }
};
