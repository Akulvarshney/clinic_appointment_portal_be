import { check } from "express-validator";
import { handleValidationErrors } from "../../middleware/handleValidationErrors.js";

export const validateDashboardQuery = [
  check("orgId").notEmpty().withMessage("orgId is required"),
  handleValidationErrors,
];

export const validateListCallsQuery = [
  check("orgId").notEmpty().withMessage("orgId is required"),
  handleValidationErrors,
];

export const validateCreateCall = [
  check("orgId").notEmpty().withMessage("orgId is required"),
  check("from_number").notEmpty().withMessage("from_number is required"),
  check().custom((_, { req }) => {
    if (!req.body.to_number && !req.body.client_id) {
      throw new Error("Either to_number or client_id is required");
    }
    if (req.body.to_number && req.body.client_id) {
      throw new Error("Provide either to_number or client_id, not both");
    }
    return true;
  }),
  handleValidationErrors,
];
