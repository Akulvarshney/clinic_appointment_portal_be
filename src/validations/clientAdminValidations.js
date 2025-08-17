import { handleValidationErrors } from "../middleware/handleValidationErrors.js";
import { check } from "express-validator";

export const validateCreateRole = [
  check("roleName").notEmpty().withMessage("Role Name is Required"),
  check("roleDesc").notEmpty().withMessage("Role Description cannot be empty"),
  handleValidationErrors,
];
export const validateGetDetials = [
  check("orgId").notEmpty().withMessage("Please Select one Organization"),
  handleValidationErrors,
];

export const validateCreateUser = [
  check("emailId")
    .notEmpty()
    .withMessage("Email is Required")
    .isEmail()
    .withMessage("Enter a valid email address"),
  check("phone")
    .notEmpty()
    .withMessage("Mobile Number is required")
    .isLength({ min: 10, max: 10 })
    .withMessage("Mobile number must be exactly 10 digits")
    .isNumeric()
    .withMessage("Phone number must contain only digits"),
  check("firstName").notEmpty().withMessage("Please Enter Full Name"),

  handleValidationErrors,
];

export const validateCreateDoctor = [
  check("emailId")
    .notEmpty()
    .withMessage("Email is Required")
    .isEmail()
    .withMessage("Enter a valid email address"),
  check("phone")
    .notEmpty()
    .withMessage("Mobile Number is required")
    .isLength({ min: 10, max: 10 })
    .withMessage("Mobile number must be exactly 10 digits")
    .isNumeric()
    .withMessage("Phone number must contain only digits"),
  check("firstName").notEmpty().withMessage("Please Enter Full Name"),
  
  check("license_number")
    .notEmpty()
    .withMessage("Please Enter the Liscence Number"),

  handleValidationErrors,
];
