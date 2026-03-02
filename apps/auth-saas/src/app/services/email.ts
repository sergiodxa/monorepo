import { env } from "cloudflare:workers";

interface SendEmailOptions {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

interface ResendResponse {
	id: string;
}

interface ResendError {
	statusCode: number;
	message: string;
	name: string;
}

/**
 * Email service using Resend API.
 * Requires RESEND_API_KEY environment variable.
 */
export default class EmailService {
	static SendError = class extends Error {
		override name = "EmailSendError";
		constructor(
			message: string,
			public statusCode?: number,
		) {
			super(message);
		}
	};

	/**
	 * Send an email using Resend API.
	 */
	static async send(options: SendEmailOptions): Promise<string> {
		let response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: env.EMAIL_FROM ?? "Auth SaaS <noreply@auth.sergiodxa.com>",
				to: options.to,
				subject: options.subject,
				html: options.html,
				text: options.text,
			}),
		});

		if (!response.ok) {
			let error = (await response.json()) as ResendError;
			throw new EmailService.SendError(error.message, response.status);
		}

		let result = (await response.json()) as ResendResponse;
		return result.id;
	}

	/**
	 * Send email verification email.
	 */
	static async sendVerificationEmail(
		to: string,
		verificationUrl: string,
		tenantName?: string,
	): Promise<string> {
		let appName = tenantName ?? "Auth SaaS";

		return await EmailService.send({
			to,
			subject: `Verify your email address - ${appName}`,
			html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #111; font-size: 24px; margin: 0;">${appName}</h1>
  </div>
  
  <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="color: #111; font-size: 20px; margin: 0 0 15px;">Verify your email address</h2>
    <p style="margin: 0 0 20px; color: #666;">
      Click the button below to verify your email address and complete your registration.
    </p>
    <a href="${verificationUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
      Verify Email
    </a>
  </div>
  
  <p style="color: #666; font-size: 14px; margin: 0 0 10px;">
    If you didn't create an account, you can safely ignore this email.
  </p>
  
  <p style="color: #999; font-size: 12px; margin: 20px 0 0;">
    This link will expire in 24 hours.
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #999; font-size: 12px; margin: 0;">
    If you're having trouble clicking the button, copy and paste this URL into your browser:<br>
    <a href="${verificationUrl}" style="color: #3b82f6;">${verificationUrl}</a>
  </p>
</body>
</html>
`,
			text: `
Verify your email address

Click the link below to verify your email address and complete your registration:

${verificationUrl}

If you didn't create an account, you can safely ignore this email.

This link will expire in 24 hours.
`,
		});
	}

	/**
	 * Send password reset email (for future use if password auth is added).
	 */
	static async sendPasswordResetEmail(
		to: string,
		resetUrl: string,
		tenantName?: string,
	): Promise<string> {
		let appName = tenantName ?? "Auth SaaS";

		return await EmailService.send({
			to,
			subject: `Reset your password - ${appName}`,
			html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #111; font-size: 24px; margin: 0;">${appName}</h1>
  </div>
  
  <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="color: #111; font-size: 20px; margin: 0 0 15px;">Reset your password</h2>
    <p style="margin: 0 0 20px; color: #666;">
      Click the button below to reset your password.
    </p>
    <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
      Reset Password
    </a>
  </div>
  
  <p style="color: #666; font-size: 14px; margin: 0 0 10px;">
    If you didn't request a password reset, you can safely ignore this email.
  </p>
  
  <p style="color: #999; font-size: 12px; margin: 20px 0 0;">
    This link will expire in 1 hour.
  </p>
</body>
</html>
`,
			text: `
Reset your password

Click the link below to reset your password:

${resetUrl}

If you didn't request a password reset, you can safely ignore this email.

This link will expire in 1 hour.
`,
		});
	}
}
