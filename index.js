import app from "./app.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { initSocket } from "./src/services/socketService.js";
import dotenv from "dotenv";
import pkg from "pg";
import {
  ensureSuperAdminExists,
  syncTabsAndFeatures,
} from "./src/util/superAdminAutoCreation.js";
import prisma from "./src/prisma.js";
const { Pool } = pkg;

dotenv.config();

const PORT = process.env.PORT || 8080;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

(async () => {
  try {
    // Only test pg connection here (optional)
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connected via pg:", result.rows[0].now);

    // Then connect Prisma safely
    await prisma.$connect();
    console.log("✅ Prisma connected");

    // await ensureSuperAdminExists();
    //await syncTabsAndFeatures();

    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    initSocket(io);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} with Socket.IO`);
    });
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
})();
