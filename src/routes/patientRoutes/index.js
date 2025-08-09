import { Router } from "express";
import clients from "./patients.js";
import { loginMiddleware } from "../../middleware/authMiddleware.js";

const router = Router();

router.use("/clients", loginMiddleware, clients);

export default router;
