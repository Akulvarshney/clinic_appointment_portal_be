import prisma from "../prisma.js";

import { sendErrorResponse } from "../util/response.js";
export const checkOrgInfoComplete = async (req, res, next) => {
  const { organization_id } = req.body;
  const response = await prisma.organizations.findFirst({
    where: {
      id: organization_id,
    },
  });
  console.log(response);
  if (response.is_complete === true) {
    next();
  } else {
    sendErrorResponse(
      res,
      new Error("Please complete the Organization Info first"),
      501
    );
  }
};
