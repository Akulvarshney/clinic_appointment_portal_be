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
