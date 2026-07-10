/**
 * Privacy Policy view. Static GDPR-oriented prose covering data collected, usage,
 * sharing, retention, rights, security, and cookies, ported verbatim in structure
 * and meaning from the OLD APP's `_landing.privacy` route, rendered inside the
 * shared `MarketingLayout` chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	50: "oklch(0.98 0.005 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

export default function PrivacyView(_handle: Handle) {
	return () => (
		<article
			mix={[
				css({
					maxWidth: 720,
					margin: "0 auto",
					padding: "48px 24px 80px",
					lineHeight: 1.75,
					color: neutral[800],
					"& h1": {
						fontSize: "2.25rem",
						fontWeight: 800,
						letterSpacing: "-0.025em",
						marginTop: 0,
						marginBottom: 32,
						color: neutral[900],
					},
					"& h2": {
						fontSize: "1.5rem",
						fontWeight: 700,
						marginTop: 48,
						marginBottom: 24,
						color: neutral[900],
					},
					"& h3": {
						fontSize: "1.25rem",
						fontWeight: 600,
						marginTop: 24,
						marginBottom: 12,
						color: neutral[900],
					},
					"& p": { margin: "20px 0" },
					"& ul": { margin: "20px 0", paddingLeft: "1.25rem" },
					"& li": { marginBottom: 8 },
					"@media (prefers-color-scheme: dark)": {
						color: neutral[300],
						"& h1, & h2, & h3": { color: neutral[50] },
					},
				}),
			]}
		>
			<p
				mix={[
					css({
						fontSize: "0.8125rem",
						color: neutral[500],
						"@media (prefers-color-scheme: dark)": {
							color: neutral[400],
						},
					}),
				]}
			>
				Last updated: February 11, 2026
			</p>

			<h1>Privacy Policy</h1>

			<h2>1. Introduction</h2>
			<p>
				This Privacy Policy describes how Uptime, operated by Sergio Xalambrí ("we", "us", or
				"our"), collects, uses, and protects your personal information when you use our uptime
				monitoring service.
			</p>
			<p>
				This policy applies to all users of our service and covers data collected through our
				website and monitoring platform.
			</p>

			<h2>2. Data We Collect</h2>

			<h3>Account Data</h3>
			<p>
				When you sign up using GitHub authentication, we collect your email address and display name
				from your GitHub profile.
			</p>

			<h3>Monitoring Data</h3>
			<p>
				We collect data related to the monitors you create, including URLs you choose to monitor,
				response times, HTTP status codes, and uptime/downtime events.
			</p>

			<h3>Cron Job Monitoring Data</h3>
			<p>For cron job (scheduled task) monitoring, we collect:</p>
			<ul>
				<li>Ping timestamps (when your scheduled tasks report completion)</li>
				<li>Source IP addresses of ping requests</li>
				<li>User agent strings from ping requests</li>
				<li>Schedule configuration (cron expressions, timezones, grace periods)</li>
			</ul>
			<p>
				This data helps you track whether your scheduled tasks are running on time and enables us to
				alert you when expected pings are missed.
			</p>

			<h3>Usage Data</h3>
			<p>
				We collect analytics and log data about how you interact with our service, including page
				views, feature usage, and error logs.
			</p>

			<h3>Payment Data</h3>
			<p>
				Payment processing is handled by Polar. We do not store your credit card information. We
				only receive confirmation of your subscription status and billing history from Polar.
			</p>

			<h2>3. How We Use Your Data</h2>
			<ul>
				<li>
					<strong>To provide the monitoring service:</strong> We use your data to monitor your
					specified URLs and track their availability.
				</li>
				<li>
					<strong>To send alerts and notifications:</strong> We use your email to send you downtime
					alerts and status notifications.
				</li>
				<li>
					<strong>To improve the service:</strong> We analyze usage patterns to enhance features and
					fix issues.
				</li>
				<li>
					<strong>To communicate with you:</strong> We may send you service updates, security
					notices, and support messages.
				</li>
			</ul>

			<h2>4. Data Sharing</h2>
			<p>
				<strong>We do not sell your personal data.</strong>
			</p>
			<p>We share data with the following third-party services that help us operate Uptime:</p>
			<ul>
				<li>
					<strong>Cloudflare:</strong> Infrastructure, hosting, and content delivery
				</li>
				<li>
					<strong>Polar:</strong> Payment processing and subscription management
				</li>
				<li>
					<strong>Resend:</strong> Email delivery for alerts and notifications
				</li>
				<li>
					<strong>GitHub:</strong> Authentication services
				</li>
			</ul>
			<p>
				We may also disclose your data if required by law or to protect our rights and the safety of
				our users.
			</p>

			<h2>5. Data Retention</h2>
			<ul>
				<li>
					<strong>Monitoring data:</strong> Retained for 365 days from collection
				</li>
				<li>
					<strong>Account data:</strong> Retained until you delete your account
				</li>
				<li>
					<strong>Logs:</strong> Retained for 30 days
				</li>
			</ul>

			<h2>6. Your Rights (GDPR)</h2>
			<p>Under the General Data Protection Regulation (GDPR), you have the right to:</p>
			<ul>
				<li>
					<strong>Access your data:</strong> Request a copy of the personal data we hold about you
				</li>
				<li>
					<strong>Correct your data:</strong> Request correction of inaccurate personal data
				</li>
				<li>
					<strong>Delete your data:</strong> Request deletion of your personal data
				</li>
				<li>
					<strong>Export your data:</strong> Receive your data in a portable format
				</li>
				<li>
					<strong>Object to processing:</strong> Object to certain types of data processing
				</li>
			</ul>
			<p>To exercise any of these rights, please contact us at the email address provided below.</p>

			<h2>7. Security</h2>
			<p>We implement appropriate security measures to protect your data:</p>
			<ul>
				<li>
					<strong>Encryption in transit:</strong> All data is transmitted over HTTPS/TLS
				</li>
				<li>
					<strong>Encryption at rest:</strong> Stored data is encrypted
				</li>
				<li>
					<strong>Access controls:</strong> Strict access controls limit who can access your data
				</li>
				<li>
					<strong>Regular security reviews:</strong> We regularly review our security practices
				</li>
			</ul>

			<h2>8. Cookies</h2>
			<p>We use minimal cookies necessary for the service to function:</p>
			<ul>
				<li>
					<strong>Session cookies:</strong> Used for authentication and maintaining your logged-in
					state
				</li>
			</ul>
			<p>
				We do not use tracking cookies, third-party advertising cookies, or any cookies for
				marketing purposes.
			</p>

			<h2>9. Children's Privacy</h2>
			<p>
				Uptime is not intended for use by individuals under 18 years of age. We do not knowingly
				collect personal information from children under 18.
			</p>

			<h2>10. International Data Transfers</h2>
			<p>
				Your data may be processed via Cloudflare's global network. If you are located in the
				European Union, your data may be transferred to and processed in the United States.
			</p>
			<p>
				We rely on Cloudflare's Standard Contractual Clauses and other appropriate safeguards to
				ensure your data is protected in accordance with GDPR requirements.
			</p>

			<h2>11. Changes to This Policy</h2>
			<p>
				We may update this Privacy Policy from time to time. We will notify you of any material
				changes by posting the new policy on this page and updating the "Last updated" date.
			</p>
			<p>
				For significant changes, we will also send you an email notification if you have an account
				with us.
			</p>

			<h2>12. Contact Us</h2>
			<p>
				If you have any questions about this Privacy Policy or wish to exercise your data rights,
				please contact us at:
			</p>
			<p>
				<a href="mailto:privacy@sergiodxa.com">privacy@sergiodxa.com</a>
			</p>
		</article>
	);
}
