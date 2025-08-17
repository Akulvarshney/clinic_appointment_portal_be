import prisma from "../prisma.js";
import { loginUser } from "../services/authService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendOtpTemplate } from "../util/emailTemplates.js";
import { sendEmail } from "../util/sendMail.js";
import { sendErrorResponse, sendResponse } from "../util/response.js";

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

export const sendPasswordResetEmail = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return sendErrorResponse(res, "Email or username is required.", 400);
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { login_id: identifier }],
      },
    });

    if (!user) {
      return sendErrorResponse(res, "User not found.", 404);
    }

    if (user.is_valid === false) {
      return sendErrorResponse(res, "User is not valid.", 403);
    }

    if (!user.email) {
      return sendErrorResponse(res, "User has no email associated.", 400);
    }

    // Generate OTP
    const otp = "" + Math.floor(100000 + Math.random() * 900000);
    const otpHash = await bcrypt.hash(otp, 10);

    await prisma.user_otps.create({
      data: {
        user_id: user.id,
        otp_hash: otpHash,
        expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
      },
    });

    // Build email template
    const { subject, html, text } = sendOtpTemplate(user.login_id, otp);
    await sendEmail({ to: user.email, subject, html, text });

    return sendResponse(
      res,
      {
        message: "OTP generated successfully. Please check your email/phone.",
        otp: process.env.NODE_ENV === "development" ? otp : undefined, // expose OTP only in dev
      },
      200
    );
  } catch (error) {
    console.error("Error generating OTP:", error);
    return sendErrorResponse(res, error, 500);
  }
};

export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      return sendErrorResponse(res, "Identifier and OTP are required.", 400);
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { login_id: identifier }],
      },
    });

    console.log(user);

    if (!user) {
      return sendErrorResponse(res, "User not found.", 404);
    }

    const userOtp = await prisma.user_otps.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
    });

    if (!userOtp) {
      return sendErrorResponse(res, "No OTP found for this user.", 404);
    }

    if (new Date() > userOtp.expires_at) {
      return sendErrorResponse(res, "OTP has expired.", 400);
    }

    const isMatch = await bcrypt.compare(otp, userOtp.otp_hash);
    if (!isMatch) {
      return sendErrorResponse(res, "Invalid OTP.", 400);
    }

    await prisma.user_otps.deleteMany({
      where: { user_id: user.id },
    });

    return sendResponse(
      res,
      {
        message: "OTP verified successfully. You may now reset your password.",
      },
      200
    );
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return sendErrorResponse(res, error, 500);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { identifier, newPassword } = req.body;

    if (!identifier || !newPassword) {
      return sendErrorResponse(
        res,
        "Identifier and new password are required.",
        400
      );
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { login_id: identifier }],
      },
    });

    if (!user) {
      return sendErrorResponse(res, "User not found.", 404);
    }

    if (user.is_valid === false) {
      return sendErrorResponse(res, "User is not valid.", 403);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.users.update({
      where: { id: user.id },
      data: { password_hash: hashedPassword },
    });

    await prisma.user_otps.deleteMany({
      where: { user_id: user.id },
    });

    return sendResponse(
      res,
      {
        message:
          "Password reset successful. You can now log in with your new password.",
      },
      200
    );
  } catch (error) {
    console.error("Error resetting password:", error);
    return sendErrorResponse(res, error, 500);
  }
};
