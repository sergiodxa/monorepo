/**
 * The real marketing homepage, replacing the placeholder `resources/views/home.tsx`.
 * Ports the OLD APP's landing page sections — hero, trust indicators, feature grid,
 * complete feature set, use cases with audience chips, a static pricing explanation,
 * and an FAQ accordion — using `remix/ui` JSX and the `MarketingLayout` chrome. The
 * OLD APP's interactive monitor-frequency pricing calculator (client-side React
 * state + a drag slider) is intentionally not ported: it is not one of this app's
 * approved client-side islands (see the ADR's `resources/components/copy-button.tsx`
 * precedent), so this renders the same pricing facts as static, server-rendered copy
 * instead of an interactive widget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import routes from "~/routes/web";

/** App-wide monospace font stack. */
const fontMono =
	'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	50: "oklch(0.98 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	600: "oklch(0.52 0.01 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
};

/** Primary (brand) scale shades used on this page, hue 142. */
const primary = {
	50: "oklch(0.98 0.02 142)",
	200: "oklch(0.92 0.08 142)",
	400: "oklch(0.78 0.16 142)",
	600: "oklch(0.6 0.16 142)",
	700: "oklch(0.5 0.14 142)",
	800: "oklch(0.42 0.12 142)",
	950: "oklch(0.24 0.06 142)",
};

namespace HomeView {
	export interface Props {
		isSignedIn: boolean;
	}
}

const TRUST_INDICATORS = [
	{ value: "99.9%", label: "Uptime SLA" },
	{ value: "9", label: "Global Regions" },
	{ value: "365", label: "Days Data Retention" },
	{ value: "<1s", label: "Alert Latency" },
] as const;

const FEATURE_LINKS = [
	{
		title: "Monitor your uptime",
		description: "Track your services 24/7 with 99.9% monitoring reliability.",
		slug: "monitors",
	},
	{
		title: "Receive alerts anywhere",
		description: "Instant notifications via email, Slack, Discord, or webhooks.",
		slug: "alerts",
	},
	{
		title: "Status pages",
		description: "Beautiful public status pages to keep your users informed.",
		slug: "status-pages",
	},
	{
		title: "SSL monitoring",
		description: "Track certificate expiry and get alerts before they expire.",
		slug: "ssl",
	},
	{
		title: "DNS monitoring",
		description: "Detect DNS record changes before they impact your users.",
		slug: "dns",
	},
	{
		title: "Native integrations",
		description: "Direct Slack and Discord integrations, not just webhooks.",
		slug: "integrations",
	},
] as const;

const COMPLETE_FEATURES = [
	{
		title: "Maintenance Windows",
		description: "Schedule downtime and suppress alerts during planned maintenance.",
	},
	{
		title: "Content Monitoring",
		description: "Verify specific keywords or content appear on your pages.",
	},
	{
		title: "Recovery Alerts",
		description: "Get notified when services come back up after an incident.",
	},
	{ title: "API Access", description: "Full REST API with key management for automation." },
	{
		title: "Alert Cooldowns",
		description: "Prevent alert fatigue with configurable cooldown periods.",
	},
	{
		title: "Custom Headers",
		description: "Add authentication headers and custom request parameters.",
	},
	{ title: "Cron Job Monitoring", description: "Monitor scheduled jobs with heartbeat checks." },
] as const;

const USE_CASE_LINKS = [
	{
		title: "Website Monitoring",
		description: "Track uptime and performance for websites and web apps.",
		slug: "website-monitoring",
	},
	{
		title: "API Monitoring",
		description: "Monitor REST APIs, GraphQL endpoints, and webhooks.",
		slug: "api-monitoring",
	},
	{
		title: "SaaS Applications",
		description: "Keep your SaaS product reliable with proactive monitoring.",
		slug: "saas",
	},
	{
		title: "Microservices",
		description: "Monitor distributed systems and catch cascading failures.",
		slug: "microservices",
	},
	{
		title: "Health Checks",
		description: "Verify service health with scheduled pings.",
		slug: "healthcheck",
	},
	{
		title: "E-commerce",
		description: "Monitor checkout flows and payment APIs to protect revenue.",
		slug: "ecommerce",
	},
] as const;

const AUDIENCE_LINKS = [
	{ label: "Indie Hackers", slug: "indie-hackers" },
	{ label: "Solo Developers", slug: "solo-devs" },
	{ label: "Startups", slug: "startups" },
	{ label: "Agencies", slug: "agencies" },
	{ label: "Enterprises", slug: "enterprises" },
	{ label: "DevOps", slug: "devops" },
] as const;

const FAQS = [
	{
		question: "How does Uptime monitor my services?",
		answer:
			"Uptime sends regular HTTP or HTTPS requests to your endpoints. We check response codes and response times to determine if your service is available and responsive.",
	},
	{
		question: "What happens when an outage is detected?",
		answer:
			"When Uptime detects an outage, it immediately sends an alert through your configured channels.",
	},
	{
		question: "Can I monitor internal services?",
		answer:
			"Yes, as long as your internal services are accessible from the internet. You can also configure custom headers to authenticate requests.",
	},
	{
		question: "How do I get started?",
		answer:
			"Just sign up, create your first monitor, and configure your alert preferences. You'll be up and running in under a minute.",
	},
	{
		question: "Is there a free tier?",
		answer:
			"Yes! You can create unlimited monitors and trigger pings manually for free, forever. Scheduled automatic monitoring requires a subscription.",
	},
	{
		question: "How long is ping data stored?",
		answer: "We store your ping results for 365 days. After that, they are automatically deleted.",
	},
	{
		question: "Can I monitor services that require authentication?",
		answer:
			"Yes. You can set custom headers with tokens or credentials to authenticate your requests.",
	},
	{
		question: "Can I monitor multiple URLs?",
		answer:
			"Yes. Create a separate monitor for each URL. Each monitor can have its own check frequency, HTTP method, expected status code, and more.",
	},
	{
		question: "Can I monitor APIs?",
		answer:
			"Absolutely. Set the endpoint, method, headers, and expected responses to monitor your API effectively.",
	},
	{
		question: "Can I set a timeout for each ping?",
		answer:
			"Yes. Configure a timeout for each monitor. A response that takes longer than expected is considered a failure.",
	},
	{
		question: "Can I pause or disable a monitor temporarily?",
		answer: "Yes. You can pause any monitor at any time, individually.",
	},
	{
		question: "Do you support status pages?",
		answer:
			"Yes! Create customizable public status pages to share your service health with users, including your own branding.",
	},
	{
		question: "Which alert channels are supported?",
		answer: "Email, Slack, Discord, and webhooks — connect to any other service via webhook.",
	},
	{
		question: "Do you support teams or shared monitors?",
		answer:
			"Yes! Each user starts with a team. Invite team members with different roles, and use domain auto-provisioning to onboard automatically.",
	},
	{
		question: "What happens if I exceed my plan's limits?",
		answer:
			"You will be charged $1 for every 1,000 pings above the 5,000 included in your subscription.",
	},
	{
		question: "Do you store request or response bodies?",
		answer:
			"No. We never store body data. For extra privacy and efficiency, we recommend using the HEAD method.",
	},
	{
		question: "From which regions can I monitor my services?",
		answer:
			"Africa, Asia-Pacific, Eastern and Western Europe, Eastern and Western North America, Middle East, Oceania, and South America. You choose one region per monitor.",
	},
] as const;

export default function HomeView(handle: Handle<HomeView.Props>) {
	return () => {
		let { isSignedIn } = handle.props;

		return (
			<>
				<section
					mix={[
						css({
							padding: "64px 0",
							textAlign: "center",
							background: `linear-gradient(to bottom, ${primary[50]}, #ffffff)`,
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": {
								background: `linear-gradient(to bottom, oklch(0.24 0.06 142 / 0.2), ${neutral[950]})`,
							},
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<span
							mix={[
								css({
									display: "inline-flex",
									alignItems: "center",
									padding: "2px 10px",
									borderRadius: 999,
									fontSize: "0.75rem",
									fontWeight: 600,
									border: `1px solid ${primary[200]}`,
									background: primary[50],
									color: primary[600],
									marginBottom: 16,
									"@media (prefers-color-scheme: dark)": {
										borderColor: primary[800],
										background: primary[950],
										color: primary[400],
									},
								}),
							]}
						>
							Uptime Monitoring
						</span>
						<h1
							mix={[
								css({
									fontSize: "2.25rem",
									fontWeight: 700,
									lineHeight: 1,
									letterSpacing: "-0.025em",
									margin: "0 auto 16px",
									maxWidth: 760,
									color: neutral[900],
									"@media (min-width: 640px)": { fontSize: "3rem" },
									"@media (min-width: 1024px)": { fontSize: "3.75rem" },
									"@media (prefers-color-scheme: dark)": { color: neutral[50] },
								}),
							]}
						>
							Monitor your services{" "}
							<span
								mix={[
									css({
										color: primary[600],
										"@media (prefers-color-scheme: dark)": { color: primary[400] },
									}),
								]}
							>
								with confidence
							</span>
						</h1>
						<p
							mix={[
								css({
									fontSize: "1.125rem",
									color: neutral[600],
									margin: "0 auto 24px",
									maxWidth: 576,
									lineHeight: 1.625,
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							Get instant alerts when your websites and APIs go down. Monitor your websites and APIs
							with ease.
						</p>

						<div
							mix={[
								css({
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 16,
									marginTop: 32,
									"@media (min-width: 640px)": { flexDirection: "row", justifyContent: "center" },
								}),
							]}
						>
							<AuthCta isSignedIn={isSignedIn} dashboardLabel="Open Dashboard" />
							{/* Matches the OLD APP's "View Pricing" hero button (px-6 py-3 text-base font-semibold shadow-sm). */}
							<a
								href="#pricing"
								mix={[
									css({
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										padding: "12px 24px",
										borderRadius: 8,
										border: `1px solid ${neutral[300]}`,
										background: "#ffffff",
										color: neutral[700],
										fontFamily: "inherit",
										fontSize: "1rem",
										fontWeight: 600,
										cursor: "pointer",
										textDecoration: "none",
										boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
										"&:hover": {
											background: neutral[50],
											boxShadow:
												"0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
										},
										"@media (prefers-color-scheme: dark)": {
											borderColor: neutral[700],
											background: neutral[900],
											color: neutral[300],
											"&:hover": { background: neutral[800] },
										},
									}),
								]}
							>
								View Pricing
							</a>
						</div>

						<div
							mix={[
								css({
									display: "flex",
									flexWrap: "wrap",
									justifyContent: "center",
									gap: "8px 24px",
									marginTop: 32,
								}),
							]}
						>
							<span
								mix={[
									css({
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										fontSize: "0.875rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								✓ Free to start
							</span>
							<span
								mix={[
									css({
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										fontSize: "0.875rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								✓ Pay for automation
							</span>
							<span
								mix={[
									css({
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										fontSize: "0.875rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								✓ Cancel anytime
							</span>
						</div>
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "64px 0",
							background: neutral[50],
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": { background: "oklch(0.24 0.005 145 / 0.5)" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						{/* Trust indicators, matching the OLD APP's `grid grid-cols-2 gap-8 md:grid-cols-4`. */}
						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "repeat(2, 1fr)",
									textAlign: "center",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(4, 1fr)" },
								}),
							]}
						>
							{TRUST_INDICATORS.map((stat) => (
								<div key={stat.label}>
									<div
										mix={[
											css({
												fontSize: "1.875rem",
												fontWeight: 700,
												lineHeight: "2.25rem",
												fontFamily: fontMono,
												color: neutral[900],
												"@media (prefers-color-scheme: dark)": { color: neutral[50] },
											}),
										]}
									>
										{stat.value}
									</div>
									<div
										mix={[
											css({
												fontSize: "0.875rem",
												color: neutral[600],
												"@media (prefers-color-scheme: dark)": { color: neutral[400] },
											}),
										]}
									>
										{stat.label}
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				<section
					id="features"
					mix={[
						css({
							padding: "64px 0",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge="Features"
							title="Powerful Monitoring Made Simple"
							description="Everything you need to keep your services running smoothly, with no unnecessary complexity."
						/>

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							{FEATURE_LINKS.map((feature) => (
								<MarketingCard
									key={feature.slug}
									href={routes.marketing.feature.href({ slug: feature.slug })}
									title={feature.title}
									description={feature.description}
								/>
							))}
						</div>
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "64px 0",
							background: neutral[50],
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": { background: "oklch(0.24 0.005 145 / 0.5)" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge="Complete Feature Set"
							title="Everything you need for reliable monitoring"
							description="Advanced capabilities that make monitoring effortless and comprehensive."
						/>

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							{COMPLETE_FEATURES.map((feature) => (
								<MarketingCard
									key={feature.title}
									title={feature.title}
									description={feature.description}
								/>
							))}
						</div>
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "64px 0",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge="Use Cases"
							title="Built for every monitoring need"
							description="From simple health checks to complex distributed systems, we've got you covered."
						/>

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							{USE_CASE_LINKS.map((useCase) => (
								<MarketingCard
									key={useCase.slug}
									href={routes.marketing.useCase.href({ slug: useCase.slug })}
									title={useCase.title}
									description={useCase.description}
								/>
							))}
						</div>

						<div
							mix={[
								css({
									padding: 20,
									borderRadius: 12,
									border: `1px solid ${neutral[200]}`,
									background: "#ffffff",
									marginTop: 24,
									textAlign: "center",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[800],
										background: neutral[900],
									},
								}),
							]}
						>
							<p
								mix={[
									css({
										fontSize: "1.25rem",
										fontWeight: 600,
										lineHeight: "1.75rem",
										margin: "0 0 6px",
										color: neutral[900],
										"@media (prefers-color-scheme: dark)": { color: neutral[50] },
									}),
								]}
							>
								Tailored solutions for:
							</p>
							<div
								mix={[
									css({
										display: "flex",
										flexWrap: "wrap",
										justifyContent: "center",
										gap: "8px 24px",
										marginTop: 32,
									}),
								]}
							>
								{AUDIENCE_LINKS.map((audience) => (
									<a
										key={audience.slug}
										href={routes.marketing.audience.href({ slug: audience.slug })}
										mix={[
											css({
												fontSize: "0.875rem",
												color: neutral[600],
												textDecoration: "none",
												"&:hover": { color: primary[600] },
												"@media (prefers-color-scheme: dark)": {
													color: neutral[400],
													"&:hover": { color: primary[400] },
												},
											}),
										]}
									>
										{audience.label}
									</a>
								))}
							</div>
						</div>
					</div>
				</section>

				<section
					id="pricing"
					mix={[
						css({
							padding: "64px 0",
							background: neutral[50],
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": { background: "oklch(0.24 0.005 145 / 0.5)" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge="Pricing"
							title="Simple, Transparent Pricing"
							description="One subscription, no tiers. Pay only for what you use with our straightforward pricing model."
						/>

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							<MarketingCard
								title="Base subscription"
								description="$5/month includes your first 5,000 pings."
							/>
							<MarketingCard
								title="Additional pings"
								description="$0.001 per ping after the first 5,000."
							/>
							<MarketingCard
								title="No hidden fees"
								description="No extra charges for features or integrations. Pay for the pings you use."
							/>
						</div>
					</div>
				</section>

				<section
					id="faq"
					mix={[
						css({
							padding: "64px 0",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge="FAQ"
							title="Frequently Asked Questions"
							description="Find answers to common questions about Uptime."
						/>

						<FaqAccordion name="faq" items={FAQS.map((faq) => ({ ...faq }))} />
					</div>
				</section>
			</>
		);
	};
}
