// import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { sendErrorResponse } from "../util/response.js";

export const aggregateValidationError = (errors) => {
  const errorMessages = errors.map((error) => error.msg).join(", ");

  return new Error(errorMessages);
};

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendErrorResponse(
      res,
      aggregateValidationError(errors.array()),
      400
    );
  }
  next();
};
