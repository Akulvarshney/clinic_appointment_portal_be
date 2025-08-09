import jwt from "jsonwebtoken"; // Required for decoding JWTs
import Prisma from "../prisma.js";
//import { JWT_SECRET } from "../";

import { sendErrorResponse } from "../util/response.js";
export const loginMiddleware = async (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return sendErrorResponse(res, new Error("Unauthorized 1"), 401);
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const userId = decoded.userId;

    const isValid = await isTokenValid(token);

    if (!isValid) {
      throw new Error("Invalid token");
    }
    req.userId = userId;
    next();
  } catch (err) {
    console.log(err);
    sendErrorResponse(res, new Error("Unauthorized 2"), 401);
  }
};

export const isTokenValid = async (token) => {
  const record = await Prisma.token.findFirst({
    where: { token },
  });
  return record !== null;
};
