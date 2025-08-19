import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  log: ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  errorFormat: "pretty",
});

export default prisma;
