export const welcomeTemplate = (name) => {
  return {
    subject: `Welcome to ${process.env.APP_NAME}, ${name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <h2>Welcome, ${name} 🎉</h2>
        <p>We’re excited to have you on board.</p>
        <p>Start exploring our platform and discover amazing features.</p>
        <a href="${process.env.APP_URL}" 
           style="display:inline-block;padding:10px 20px;
           background:#007bff;color:white;text-decoration:none;border-radius:5px;">
           Get Started
        </a>
        <p>Cheers,<br/>${process.env.APP_NAME} Team</p>
      </div>
    `,
    text: `Welcome ${name}, we're excited to have you at ${process.env.APP_NAME}. Visit ${process.env.APP_URL} to get started.`,
  };
};

export const sendOtpTemplate = (name, otp) => {
  return {
    subject: `Your OTP Code for ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <h2>Hello ${name},</h2>
        <p>Your OTP code is <strong>${otp}</strong>.</p>
        <p>Please enter this code to verify your account.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Cheers,<br/>${process.env.APP_NAME} Team</p>
      </div>
    `,
    text: `Hello ${name}, your OTP code is ${otp}. Please enter this code to verify your account.`,
  };
};

export const sendTrackingTemplate = (name, trackingId) => {
  return {
    subject: `Your Tracking ID for ${process.env.APP_NAME} for Application`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <h2>Hello ${name},</h2>
        <p>Your tracking ID is <strong>${trackingId}</strong>.</p>
        <p>You can use this ID to track your application on our platform.</p>
        <p>If you have any questions, feel free to reach out.</p>
        <p>Cheers,<br/>${process.env.APP_NAME} Team</p>
      </div>
    `,
    text: `Hello ${name}, your tracking ID is ${trackingId}. You can use this ID to track your order.`,
  };
};

export const sendApproveApplicationTemplate = (
  name,
  trackingId,
  loginId,
  password
) => {
  return {
    subject: `Your Application has been Approved on ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <h2>Congratulations ${name}!</h2>
        <p>We are pleased to inform you that your application with tracking ID <strong>${trackingId}</strong> has been approved.</p>
        <p>You can now proceed with the next steps on our platform.</p>
        <br/>
        <br/>

        <p>To access your account, please log in using the following link:</p>
        <a href="${process.env.APP_URL}/login" 
           style="display:inline-block;padding:10px 20px;
           background:#28a745;color:white;text-decoration:none;border-radius:5px;">
           Login to Your Account
        </a>
        <br/>
        <br/>
        <p>Credentials:</p>
        <p>Email: ${loginId}</p>
        <p>Password: ${password}.</p>

        <p>If you have any questions, feel free to reach out.</p>
        <p>Cheers,<br/>${process.env.APP_NAME} Team</p>
      </div>
    `,
    text: `Congratulations ${name}! Your application with tracking ID ${trackingId} has been approved. You can now proceed with the next steps on our platform.`,
  };
};

export const rejectApplicationTemplate = (name, trackingId) => {
  return {
    subject: `Your Application has been Rejected on ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <h2>Dear ${name},</h2>
        <p>We regret to inform you that your application with tracking ID <strong>${trackingId}</strong> has been rejected.</p>
        <p>If you have any questions or need further assistance, please do not hesitate to contact us.</p>
        <p>Thank you for your understanding.</p>
        <p>Best regards,<br/>${process.env.APP_NAME} Team</p>
      </div>
    `,
    text: `Dear ${name}, we regret to inform you that your application with tracking ID ${trackingId} has been rejected. If you have any questions or need further assistance, please do not hesitate to contact us.`,
  };
};
