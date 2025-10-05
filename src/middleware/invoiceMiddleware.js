import prisma from "../prisma.js";

import { sendErrorResponse } from "../util/response.js";
export const checkOrgInfoComplete = async (req, res, next) => {
  const { organization_id } = req.body;
  const response = await prisma.organization_billing_details.findFirst({
    where: {
      organization_id: organization_id,
    },
  });
  console.log(response);
  if (response.is_approved === "APPROVED") {
    next();
  } else {
    sendErrorResponse(
      res,
      new Error("The Bill Module is not yet approved or Rejected"),
      501
    );
  }
};
