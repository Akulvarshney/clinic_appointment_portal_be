import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};
