/**
 * Terms of Service view. Static prose covering accounts, acceptable use, billing,
 * data retention, service availability, liability, and termination, ported
 * verbatim in structure and meaning from the OLD APP's `_landing.terms` route,
 * rendered inside the shared `MarketingLayout` chrome.
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

export default function TermsView(_handle: Handle) {
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

			<h1>Terms of Service</h1>

			<h2>1. Introduction</h2>
			<p>
				Welcome to Uptime. These Terms of Service govern your use of our uptime monitoring service
				operated by Sergio Xalambrí. By accessing or using Uptime, you agree to be bound by these
				terms.
			</p>

			<h2>2. Service Description</h2>
			<p>
				Uptime provides uptime and scheduled task monitoring services, including HTTP endpoint
				monitoring, DNS monitoring, TCP port monitoring, SSL certificate monitoring, and cron job
				monitoring. These services help you track the health of your services and scheduled tasks.
				We monitor your endpoints from multiple global regions and notify you when issues are
				detected.
			</p>

			<h2>3. Account Terms</h2>
			<ul>
				<li>You must provide accurate and complete information when creating an account.</li>
				<li>
					You are responsible for maintaining the security of your account credentials and for all
					activities that occur under your account.
				</li>
				<li>
					You must be at least 18 years old or have the legal authority to enter into this agreement
					on behalf of an organization.
				</li>
				<li>You must notify us immediately of any unauthorized use of your account.</li>
			</ul>

			<h2>4. Acceptable Use</h2>
			<p>When using Uptime, you agree not to:</p>
			<ul>
				<li>
					Abuse, overload, or interfere with our service or attempt to circumvent any usage limits.
				</li>
				<li>Monitor URLs or endpoints that you do not own or have authorization to monitor.</li>
				<li>
					Monitor cron jobs or scheduled tasks that you do not own or have authorization to monitor.
				</li>
				<li>
					Use cron job ping endpoints for purposes other than legitimate scheduled task monitoring.
				</li>
				<li>Use the service for any illegal or unauthorized purpose.</li>
				<li>Attempt to gain unauthorized access to our systems or other users' accounts.</li>
				<li>Resell or redistribute the service without our written consent.</li>
			</ul>

			<h2>5. Payment Terms</h2>
			<ul>
				<li>
					Uptime operates on a usage-based billing model. You pay based on the number of monitors
					and check frequency you configure.
				</li>
				<li>Subscriptions are managed and processed through Polar.</li>
				<li>
					Refunds are provided on a prorated basis for the unused portion of your subscription if
					you cancel.
				</li>
				<li>
					We reserve the right to change pricing with 30 days notice. Continued use after price
					changes constitutes acceptance.
				</li>
			</ul>

			<h2>6. Data and Privacy</h2>
			<ul>
				<li>
					Your use of Uptime is also governed by our <a href="/privacy">Privacy Policy</a>, which
					describes how we collect, use, and protect your data.
				</li>
				<li>
					Monitoring data is retained for 365 days. After this period, historical data is
					automatically deleted.
				</li>
				<li>
					You may request deletion of your data at any time by contacting us. Upon account
					termination, your data will be deleted within 30 days.
				</li>
			</ul>

			<h2>7. Service Availability</h2>
			<ul>
				<li>
					We target 99.9% service availability, but this is a goal, not a guarantee. We do not offer
					service level agreements (SLAs) with financial remedies.
				</li>
				<li>
					We may perform scheduled maintenance with reasonable advance notice when possible.
					Emergency maintenance may occur without notice.
				</li>
				<li>
					We are not liable for any downtime, data loss, or damages resulting from service
					interruptions, whether planned or unplanned.
				</li>
			</ul>

			<h2>8. Limitation of Liability</h2>
			<ul>
				<li>
					Uptime is provided "as is" and "as available" without warranties of any kind, either
					express or implied.
				</li>
				<li>
					We do not guarantee that our service will detect all downtime events affecting your
					monitored endpoints. Monitoring is subject to network conditions and other factors outside
					our control.
				</li>
				<li>
					Our total liability to you for any claims arising from your use of the service is limited
					to the amount you paid us in the 12 months preceding the claim.
				</li>
				<li>
					We are not liable for any indirect, incidental, special, consequential, or punitive
					damages.
				</li>
			</ul>

			<h2>9. Termination</h2>
			<ul>
				<li>
					You may terminate your account at any time through your account settings or by contacting
					us.
				</li>
				<li>
					We may suspend or terminate your account if you violate these terms or for any other
					reason with reasonable notice.
				</li>
				<li>
					Upon termination, your access to the service will end and your data will be deleted within
					30 days.
				</li>
			</ul>

			<h2>10. Changes to Terms</h2>
			<p>
				We may update these Terms of Service from time to time. We will notify you of significant
				changes by email or through the service. Your continued use of Uptime after changes take
				effect constitutes acceptance of the revised terms.
			</p>

			<h2>11. Contact</h2>
			<p>
				If you have questions about these Terms of Service, please contact us at{" "}
				<a href="mailto:hello@sergiodxa.com">hello@sergiodxa.com</a>.
			</p>
		</article>
	);
}
