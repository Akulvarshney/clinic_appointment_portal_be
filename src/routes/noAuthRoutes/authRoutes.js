import { Router } from "express";
import { login, superAdminlogin } from "../../controller/authController.js";

const router = Router();

router.post("/login", login);
router.post("/superadmin/login", superAdminlogin);

export default router;
