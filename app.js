import express from "express";
import cors from "cors";
// import { authMiddleware } from "./middlewares/authMiddleware.js";
// import userRoutes from "./routes/userRoutes.js";
//import authRoutes from "./routes/authRoutes.js";
import v1routes from "./src/routes/index.js";
import requestLogger from "./src/middleware/requestLog.js";

const app = express();

console.log("Hello World");

app.use(cors());
app.use(express.json());

app.use(requestLogger);

// Disable cache + etags
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

app.use("/api/v1/", v1routes);

// app.use("/api/v1/user", authMiddleware, userRoutes);

export default app;
