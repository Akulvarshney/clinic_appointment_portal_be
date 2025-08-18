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

export const welcomeDoctoreTemplate = (name, orgName, doctorId, password) => {
  return {
    subject: `Welcome to ${orgName}, Dr. ${name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2>Welcome Onboard, Dr. ${name} 🎉</h2>
        <p>We’re delighted to have you onboarded with <strong>${orgName}</strong>.</p>
        
        <p>Your login credentials are as follows:</p>
        <ul style="background:#f8f9fa;padding:15px;border:1px solid #ddd;border-radius:5px;list-style:none;">
          <li><strong>User ID:</strong> ${doctorId}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
        
        <p>
          Please use the button below to log in and start managing your appointments:
        </p>
        
        <a href="${process.env.APP_URL}/login" 
           style="display:inline-block;padding:12px 24px;background:#007bff;color:white;
                  text-decoration:none;border-radius:5px;font-weight:bold;">
          Access Your Dashboard
        </a>
        
        <p style="margin-top:20px;">
          From your dashboard, you can <strong>track and manage all appointments</strong> seamlessly.
        </p>
        
        <p>Best regards,<br/>The ${orgName} Team</p>
      </div>
    `,
    text: `Welcome Dr. ${name},\n\nYou have been successfully onboarded with ${orgName}.\n\nYour credentials:\nUser ID: ${doctorId}\nPassword: ${password}\n\nPlease log in at ${process.env.APP_URL}/login to manage your appointments.\n\nBest regards,\nThe ${orgName} Team`,
  };
};

export const welcomeClientTemplate = (
  clientName,
  orgName,
  clientId,
  password
) => {
  return {
    subject: `Welcome to ${orgName}, ${clientName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2>Welcome, ${clientName} 🎉</h2>
        <p>We’re excited to onboard you with <strong>${orgName}</strong>.</p>

        <p>Your login credentials have been created as follows:</p>
        <ul style="background:#f8f9fa;padding:15px;border:1px solid #ddd;border-radius:5px;list-style:none;">
          <li><strong>User ID:</strong> ${clientId}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>

        <p>
          Please use the button below to log in and start managing your services and appointments:
        </p>

        <a href="${process.env.APP_URL}/login" 
           style="display:inline-block;padding:12px 24px;background:#28a745;color:white;
                  text-decoration:none;border-radius:5px;font-weight:bold;">
          Go to Client Portal
        </a>

        <p style="margin-top:20px;">
          From your portal, you can <strong>track appointments, review invoices, and stay updated</strong> on all activities related to your account.
        </p>

        <p style="margin-top:25px;">Best regards,<br/>The ${orgName} Team</p>
      </div>
    `,
    text: `Welcome ${clientName},\n\nYou have been successfully onboarded with ${orgName}.\n\nYour credentials:\nUser ID: ${clientId}\nPassword: ${password}\n\nPlease log in at ${process.env.APP_URL}/login to manage your appointments and services.\n\nBest regards,\nThe ${orgName} Team`,
  };
};

export const welcomeEmployeeTemplate = (
  employeeName,
  orgName,
  roleName,
  employeeId,
  password
) => {
  return {
    subject: `Welcome to ${orgName}, ${employeeName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        <h2>Welcome Aboard, ${employeeName} 🎉</h2>
        <p>We are pleased to have you join <strong>${orgName}</strong> as a <strong>${roleName}</strong>.</p>

        <p>Your employee account has been successfully created with the following credentials:</p>
        <ul style="background:#f8f9fa;padding:15px;border:1px solid #ddd;border-radius:5px;list-style:none;">
          <li><strong>Employee ID:</strong> ${employeeId}</li>
          <li><strong>Password:</strong> ${password}</li>
          <li><strong>Role:</strong> ${roleName}</li>
        </ul>

        <p>
          Please use the button below to log in and access your employee dashboard:
        </p>

        <a href="${process.env.APP_URL}/login" 
           style="display:inline-block;padding:12px 24px;background:#0069d9;color:white;
                  text-decoration:none;border-radius:5px;font-weight:bold;">
          Access Employee Portal
        </a>

        <p style="margin-top:20px;">
          From your portal, you can <strong>track tasks, manage appointments, and fulfill your role responsibilities</strong> seamlessly.
        </p>

        <p style="margin-top:25px;">Best regards,<br/>The ${orgName} Team</p>
      </div>
    `,
    text: `Welcome ${employeeName},\n\nYou have been successfully onboarded with ${orgName} as a ${roleName}.\n\nYour credentials:\nEmployee ID: ${employeeId}\nPassword: ${password}\nRole: ${roleName}\n\nPlease log in at ${process.env.APP_URL}/login to access your employee portal.\n\nBest regards,\nThe ${orgName} Team`,
  };
};
