import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

/**
 * Single shared client. Reuse via globalThis in dev so nodemon reloads do not open
 * new connection pools (common cause of "too many database connections" / P2037).
 */
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prismaClient ??
  new PrismaClient({
    log: ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    errorFormat: "pretty",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prismaClient = prisma;
}

export default prisma;
