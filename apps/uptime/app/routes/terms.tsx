import { Link } from "react-router";

import { LandingFooter, LandingHeader } from "~/components/landing";
import { generateMeta } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";
import { getSession } from "~/middleware/session";

import type { Route } from "./+types/terms";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let session = getSession();
	let { t } = i18next(context);

	return {
		isSignedIn: session.has("id"),
		meta: generateMeta({
			title: t("legal.terms.meta.title"),
			description: t("legal.terms.meta.description"),
			url: request.url,
		}),
	};
}

export default function TermsPage({ loaderData }: Route.ComponentProps) {
	let { isSignedIn } = loaderData;

	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<LandingHeader isSignedIn={isSignedIn} />

			<main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
				<article className="prose max-w-none prose-neutral dark:prose-invert">
					<p className="text-sm text-neutral-500 dark:text-neutral-400">
						Last updated: February 11, 2026
					</p>

					<h1>Terms of Service</h1>

					<h2>1. Introduction</h2>
					<p>
						Welcome to Uptime. These Terms of Service govern your use of our uptime monitoring
						service operated by Sergio Xalambrí. By accessing or using Uptime, you agree to be bound
						by these terms.
					</p>

					<h2>2. Service Description</h2>
					<p>
						Uptime provides uptime and scheduled task monitoring services, including HTTP endpoint
						monitoring, DNS monitoring, TCP port monitoring, SSL certificate monitoring, and cron
						job monitoring. These services help you track the health of your services and scheduled
						tasks. We monitor your endpoints from multiple global regions and notify you when issues
						are detected.
					</p>

					<h2>3. Account Terms</h2>
					<ul>
						<li>You must provide accurate and complete information when creating an account.</li>
						<li>
							You are responsible for maintaining the security of your account credentials and for
							all activities that occur under your account.
						</li>
						<li>
							You must be at least 18 years old or have the legal authority to enter into this
							agreement on behalf of an organization.
						</li>
						<li>You must notify us immediately of any unauthorized use of your account.</li>
					</ul>

					<h2>4. Acceptable Use</h2>
					<p>When using Uptime, you agree not to:</p>
					<ul>
						<li>
							Abuse, overload, or interfere with our service or attempt to circumvent any usage
							limits.
						</li>
						<li>Monitor URLs or endpoints that you do not own or have authorization to monitor.</li>
						<li>
							Monitor cron jobs or scheduled tasks that you do not own or have authorization to
							monitor.
						</li>
						<li>
							Use cron job ping endpoints for purposes other than legitimate scheduled task
							monitoring.
						</li>
						<li>Use the service for any illegal or unauthorized purpose.</li>
						<li>
							Attempt to gain unauthorized access to our systems or other users&apos; accounts.
						</li>
						<li>Resell or redistribute the service without our written consent.</li>
					</ul>

					<h2>5. Payment Terms</h2>
					<ul>
						<li>
							Uptime operates on a usage-based billing model. You pay based on the number of
							monitors and check frequency you configure.
						</li>
						<li>Subscriptions are managed and processed through Polar.</li>
						<li>
							Refunds are provided on a prorated basis for the unused portion of your subscription
							if you cancel.
						</li>
						<li>
							We reserve the right to change pricing with 30 days notice. Continued use after price
							changes constitutes acceptance.
						</li>
					</ul>

					<h2>6. Data and Privacy</h2>
					<ul>
						<li>
							Your use of Uptime is also governed by our <Link to="/privacy">Privacy Policy</Link>,
							which describes how we collect, use, and protect your data.
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
							We target 99.9% service availability, but this is a goal, not a guarantee. We do not
							offer service level agreements (SLAs) with financial remedies.
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
							Uptime is provided &quot;as is&quot; and &quot;as available&quot; without warranties
							of any kind, either express or implied.
						</li>
						<li>
							We do not guarantee that our service will detect all downtime events affecting your
							monitored endpoints. Monitoring is subject to network conditions and other factors
							outside our control.
						</li>
						<li>
							Our total liability to you for any claims arising from your use of the service is
							limited to the amount you paid us in the 12 months preceding the claim.
						</li>
						<li>
							We are not liable for any indirect, incidental, special, consequential, or punitive
							damages.
						</li>
					</ul>

					<h2>9. Termination</h2>
					<ul>
						<li>
							You may terminate your account at any time through your account settings or by
							contacting us.
						</li>
						<li>
							We may suspend or terminate your account if you violate these terms or for any other
							reason with reasonable notice.
						</li>
						<li>
							Upon termination, your access to the service will end and your data will be deleted
							within 30 days.
						</li>
					</ul>

					<h2>10. Changes to Terms</h2>
					<p>
						We may update these Terms of Service from time to time. We will notify you of
						significant changes by email or through the service. Your continued use of Uptime after
						changes take effect constitutes acceptance of the revised terms.
					</p>

					<h2>11. Contact</h2>
					<p>
						If you have questions about these Terms of Service, please contact us at{" "}
						<a href="mailto:hello@sergiodxa.com">hello@sergiodxa.com</a>.
					</p>
				</article>
			</main>

			<LandingFooter />
		</div>
	);
}
