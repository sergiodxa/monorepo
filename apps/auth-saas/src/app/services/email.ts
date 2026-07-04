import { EmailMessage } from "cloudflare:email";
import { env } from "cloudflare:workers";

/** Options accepted by the low-level {@link EmailService.send}. */
interface SendOptions {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

/**
 * Transactional email service backed by Cloudflare Email Sending.
 *
 * Sends through the `SEND_EMAIL` binding using a hand-built multipart/alternative
 * MIME message.
 */
export default class EmailService {
	/** Error thrown when email sending fails. */
	static SendError = class extends Error {
		override name = "EmailSendError";
		/**
		 * Creates an email send error.
		 * @param message - Error message describing the failure.
		 * @param statusCode - Optional HTTP status code from the email provider.
		 */
		constructor(
			message: string,
			public statusCode?: number,
		) {
			super(message);
		}
	};

	/**
	 * Sends an email via the Cloudflare `SEND_EMAIL` binding.
	 * @param options - Recipient, subject, and HTML/plain-text bodies.
	 */
	static async send(options: SendOptions): Promise<void> {
		let from = env.EMAIL_FROM ?? "Auth SaaS <noreply@auth.sergiodxa.com>";
		let fromAddress = parseAddress(from);
		let raw = buildMimeMessage({
			from,
			fromAddress,
			to: options.to,
			subject: options.subject,
			html: options.html,
			text: options.text ?? htmlToText(options.html),
		});

		try {
			await env.SEND_EMAIL.send(new EmailMessage(fromAddress, options.to, raw));
		} catch (error) {
			throw new EmailService.SendError(
				error instanceof Error ? error.message : "Failed to send email",
			);
		}
	}

	/**
	 * Sends the email-verification message shown after passkey registration.
	 * @param to - Recipient email address.
	 * @param verificationUrl - Link that verifies the address when visited.
	 * @param tenantName - Optional tenant name used in the subject/branding.
	 */
	static async sendVerificationEmail(
		to: string,
		verificationUrl: string,
		tenantName?: string,
	): Promise<void> {
		let appName = tenantName ?? "Auth SaaS";
		await EmailService.send({
			to,
			subject: `Verify your email address - ${appName}`,
			html: actionEmailHtml({
				appName,
				heading: "Verify your email address",
				body: "Click the button below to verify your email address and complete your registration.",
				buttonLabel: "Verify Email",
				url: verificationUrl,
				footer:
					"If you didn't create an account, you can safely ignore this email. This link expires in 24 hours.",
			}),
			text: `Verify your email address\n\n${verificationUrl}\n\nIf you didn't create an account, you can safely ignore this email. This link expires in 24 hours.`,
		});
	}

	/**
	 * Sends a magic-link sign-in email (login and passkey-recovery entry point).
	 * @param to - Recipient email address.
	 * @param loginUrl - Single-use link that signs the user in when visited.
	 * @param tenantName - Optional tenant name used in the subject/branding.
	 */
	static async sendMagicLinkEmail(
		to: string,
		loginUrl: string,
		tenantName?: string,
	): Promise<void> {
		let appName = tenantName ?? "Auth SaaS";
		await EmailService.send({
			to,
			subject: `Sign in to ${appName}`,
			html: actionEmailHtml({
				appName,
				heading: "Sign in",
				body: "Click the button below to sign in. You can add a passkey afterwards for faster access next time.",
				buttonLabel: "Sign in",
				url: loginUrl,
				footer:
					"If you didn't request this email, you can safely ignore it. This link expires in 15 minutes and can only be used once.",
			}),
			text: `Sign in to ${appName}\n\n${loginUrl}\n\nIf you didn't request this email, you can safely ignore it. This link expires in 15 minutes and can only be used once.`,
		});
	}
}

/** Renders the shared "button + link" transactional email HTML. */
function actionEmailHtml(options: {
	appName: string;
	heading: string;
	body: string;
	buttonLabel: string;
	url: string;
	footer: string;
}): string {
	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #111; font-size: 24px; margin: 0;">${options.appName}</h1>
  </div>
  <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="color: #111; font-size: 20px; margin: 0 0 15px;">${options.heading}</h2>
    <p style="margin: 0 0 20px; color: #666;">${options.body}</p>
    <a href="${options.url}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">${options.buttonLabel}</a>
  </div>
  <p style="color: #999; font-size: 12px; margin: 0;">${options.footer}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; margin: 0;">
    If the button doesn't work, copy and paste this URL into your browser:<br>
    <a href="${options.url}" style="color: #3b82f6;">${options.url}</a>
  </p>
</body>
</html>`;
}

/** Extracts the bare email address from a `Name <addr>` or `addr` string. */
function parseAddress(from: string): string {
	let match = from.match(/<([^>]+)>/);
	return (match?.[1] ?? from).trim();
}

/** Best-effort plain-text fallback derived from an HTML body. */
function htmlToText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Builds a multipart/alternative RFC 5322 message for Cloudflare Email Sending. */
function buildMimeMessage(options: {
	from: string;
	fromAddress: string;
	to: string;
	subject: string;
	html: string;
	text: string;
}): string {
	let boundary = `----=_Part_${crypto.randomUUID()}`;
	let domain = options.fromAddress.split("@")[1] ?? "auth.sergiodxa.com";
	let messageId = `<${crypto.randomUUID()}@${domain}>`;
	let date = new Date().toUTCString();

	return [
		`From: ${options.from}`,
		`To: ${options.to}`,
		`Message-ID: ${messageId}`,
		`Date: ${date}`,
		`Subject: ${encodeHeader(options.subject)}`,
		"MIME-Version: 1.0",
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
		"",
		`--${boundary}`,
		"Content-Type: text/plain; charset=utf-8",
		"Content-Transfer-Encoding: base64",
		"",
		base64Utf8(options.text),
		`--${boundary}`,
		"Content-Type: text/html; charset=utf-8",
		"Content-Transfer-Encoding: base64",
		"",
		base64Utf8(options.html),
		`--${boundary}--`,
		"",
	].join("\r\n");
}

/** RFC 2047 encodes a header value when it contains non-ASCII characters. */
function encodeHeader(value: string): string {
	// eslint-disable-next-line no-control-regex
	if (/^[\x00-\x7F]*$/.test(value)) return value;
	return `=?utf-8?B?${base64Utf8(value).replace(/\r\n/g, "")}?=`;
}

/** Base64-encodes a UTF-8 string, wrapped to 76-character lines per MIME. */
function base64Utf8(value: string): string {
	let bytes = new TextEncoder().encode(value);
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	let base64 = btoa(binary);
	return base64.replace(/.{76}/g, "$&\r\n");
}
