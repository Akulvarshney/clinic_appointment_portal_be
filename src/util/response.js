import express from "express";

export const sendResponse = (res, data, statusCode) => {
  res.status(statusCode).json({ success: true, ...data });
};

export const sendErrorResponse = (res, error, status = 500) => {
  let message = "Something went wrong";

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  } else if (typeof error === "object" && error?.message) {
    message = error.message;
  }

  return res.status(status).json({
    success: false,
    message,
  });
};
