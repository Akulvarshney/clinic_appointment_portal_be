import express from "express";
import cors from "cors";
// import { authMiddleware } from "./middlewares/authMiddleware.js";
// import userRoutes from "./routes/userRoutes.js";
//import authRoutes from "./routes/authRoutes.js";
import v1routes from "./src/routes/index.js";
import requestLogger from "./src/middleware/requestLog.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(requestLogger);

app.use("/api/v1/", v1routes);

// app.use("/api/v1/user", authMiddleware, userRoutes);

export default app;
