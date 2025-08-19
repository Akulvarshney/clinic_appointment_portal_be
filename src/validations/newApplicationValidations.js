import { handleValidationErrors } from "../middleware/handleValidationErrors.js";
import { check } from "express-validator";
export const validateNewApplication = [
  check("org_name").notEmpty().withMessage("Organization name is required"),
  check("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .isLength({ min: 10, max: 10 })
    .withMessage("Phone number must be exactly 10 digits")
    .isNumeric()
    .withMessage("Phone number must contain only digits"),

    check("org_short_name")
    .notEmpty()
    .withMessage("Organization short Name is required.")
    .isLength({ max: 4 })
    .withMessage("Organization short name must not be more than 4 characters")
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage("Organization short name must not contain special characters"),

  check("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail(),
  handleValidationErrors,
];

export const validateTrackApplication = [
  check("trackingId").notEmpty().withMessage("Tracking Id is required"),
  handleValidationErrors,
];

export const validateStatus = [
  check("status").notEmpty().withMessage("Status Id is required"),

  handleValidationErrors,
];

export const validateApplicationAction = [
  check("id").notEmpty().withMessage("Tracking Id is required"),

  check("Action").notEmpty().withMessage("Action is mandatory"),
  handleValidationErrors,
];

export const validateAcceptApplication = [
  check("uuid")
    .notEmpty()
    .withMessage("Tracking Id is required")
    .isNumeric()
    .withMessage("Tracking id should be of type Numeric"),
  handleValidationErrors,
];

export const validateShortName = [
  check("shortName").notEmpty().withMessage("ShortName is required"),
  handleValidationErrors,
];
