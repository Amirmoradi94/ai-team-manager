const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create reusable transporter
let transporter;

const initializeTransporter = () => {
  // Check if email is configured
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    logger.warn('Email service not configured. Emails will be logged only.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      logger.error('Email service connection failed:', error);
    } else {
      logger.info('✉️  Email service ready');
    }
  });

  return transporter;
};

// Initialize transporter on module load
initializeTransporter();

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    // If no transporter (email not configured), just log
    if (!transporter) {
      logger.info('Email (not sent - service not configured):', {
        to,
        subject,
        preview: text.substring(0, 100),
      });
      return { success: true, mode: 'logged' };
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Task Manager'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent:', { to, subject, messageId: info.messageId });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email:', { to, subject, error: error.message });
    throw error;
  }
};

/**
 * Send invitation email with login password
 */
const sendInvitationEmail = async ({ to, name, loginPassword, invitedBy }) => {
  const subject = 'You\'ve been invited to Task Manager';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .credentials { background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #667eea; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        code { background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 Welcome to Task Manager</h1>
        </div>
        <div class="content">
          <p>Hi ${name || 'there'},</p>
          <p><strong>${invitedBy}</strong> has invited you to join their team on Task Manager!</p>

          <div class="credentials">
            <h3>Your Login Credentials</h3>
            <p><strong>Email:</strong> ${to}</p>
            <p><strong>Password:</strong> <code>${loginPassword}</code></p>
          </div>

          <p><strong>🔐 Security:</strong> Keep this password secure. You can change it anytime in your account settings.</p>

          <div style="text-align: center;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}" class="button">
              Login to Task Manager
            </a>
          </div>

          <p>If you didn't expect this invitation, you can safely ignore this email.</p>

          <div class="footer">
            <p>This is an automated email from Task Manager.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Task Manager!

${invitedBy} has invited you to join their team.

Your login credentials:
Email: ${to}
Password: ${loginPassword}

🔐 Security: Keep this password secure. You can change it anytime in your account settings.

Login at: ${process.env.APP_URL || 'http://localhost:8081'}

If you didn't expect this invitation, you can safely ignore this email.
  `;

  return sendEmail({ to, subject, html, text });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async ({ to, name, resetToken }) => {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Password';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>

          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">
              Reset Password
            </a>
          </div>

          <p><strong>⏰ This link will expire in 1 hour.</strong></p>

          <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>

          <div class="footer">
            <p>This is an automated email from Task Manager.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Password Reset Request

Hi ${name},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

⏰ This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.
  `;

  return sendEmail({ to, subject, html, text });
};

module.exports = {
  sendEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
};
