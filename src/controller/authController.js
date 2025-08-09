import prisma from "../prisma.js";
import { loginUser } from "../services/authService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
  try {
    const { loginId, password } = req.body;

    const data = await loginUser(loginId, password);

    res.status(200).json({ data });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(401).json({ message: error.message || "Invalid credentials" });
  }
};

export const superAdminlogin = async (req, res) => {
  const { login_id, password } = req.body;

  if (!login_id || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing credentials" });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { login_id },
      include: { super_admins: true },
    });

    if (!user || !user.super_admins || user.super_admins.is_valid === false) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Not a superadmin" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid password" });
    }

    const token = jwt.sign(
      { userId: user.id, role: "SUPERADMIN" },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        login_id: user.login_id,
        role: "SUPERADMIN",
      },
    });
  } catch (error) {
    console.error("Superadmin login error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
