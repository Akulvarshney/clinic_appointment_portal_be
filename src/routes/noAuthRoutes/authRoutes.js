import { Router } from "express";
import {
  login,
  resetPassword,
  sendPasswordResetEmail,
  superAdminlogin,
  verifyPasswordResetOtp,
} from "../../controller/authController.js";

const router = Router();

router.post("/login", login);
router.post("/superadmin/login", superAdminlogin);
router.post("/forgotPassword", sendPasswordResetEmail);
router.post("/verifyPasswordResetOtp", verifyPasswordResetOtp);
router.post("/resetPassword", resetPassword);

export default router;
