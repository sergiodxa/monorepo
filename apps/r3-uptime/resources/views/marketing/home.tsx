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

import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace HomeView {
	export interface Props {
		isSignedIn: boolean;
	}
}

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
				<section mix={[s.marketingHero]}>
					<div mix={[s.marketingContainer]}>
						<span mix={[s.marketingBadge]}>Uptime Monitoring</span>
						<h1 mix={[s.marketingHeroTitle]}>
							Monitor your services <span mix={[s.marketingHeroHighlight]}>with confidence</span>
						</h1>
						<p mix={[s.marketingLead]}>
							Get instant alerts when your websites and APIs go down. Monitor your websites and APIs
							with ease.
						</p>

						<div mix={[s.marketingActions]}>
							<AuthCta isSignedIn={isSignedIn} dashboardLabel="Open Dashboard" />
							<a href="#pricing" mix={[s.buttonSecondary]}>
								View Pricing
							</a>
						</div>

						<div mix={[s.marketingHighlightRow]}>
							<span mix={[s.marketingHighlightChip]}>✓ Free to start</span>
							<span mix={[s.marketingHighlightChip]}>✓ Pay for automation</span>
							<span mix={[s.marketingHighlightChip]}>✓ Cancel anytime</span>
						</div>
					</div>
				</section>

				<section mix={[s.marketingSectionAlt]}>
					<div mix={[s.marketingContainer]}>
						<div mix={[s.marketingStatRow]}>
							<div>
								<div mix={[s.marketingStatValue]}>99.9%</div>
								<div mix={[s.marketingStatLabel]}>Uptime SLA</div>
							</div>
							<div>
								<div mix={[s.marketingStatValue]}>9</div>
								<div mix={[s.marketingStatLabel]}>Global Regions</div>
							</div>
							<div>
								<div mix={[s.marketingStatValue]}>365</div>
								<div mix={[s.marketingStatLabel]}>Days Data Retention</div>
							</div>
							<div>
								<div mix={[s.marketingStatValue]}>&lt;1s</div>
								<div mix={[s.marketingStatLabel]}>Alert Latency</div>
							</div>
						</div>
					</div>
				</section>

				<section id="features" mix={[s.marketingSection]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader
							badge="Features"
							title="Powerful Monitoring Made Simple"
							description="Everything you need to keep your services running smoothly, with no unnecessary complexity."
						/>

						<div mix={[s.marketingGrid]}>
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

				<section mix={[s.marketingSectionAlt]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader
							badge="Complete Feature Set"
							title="Everything you need for reliable monitoring"
							description="Advanced capabilities that make monitoring effortless and comprehensive."
						/>

						<div mix={[s.marketingGrid]}>
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

				<section mix={[s.marketingSection]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader
							badge="Use Cases"
							title="Built for every monitoring need"
							description="From simple health checks to complex distributed systems, we've got you covered."
						/>

						<div mix={[s.marketingGrid]}>
							{USE_CASE_LINKS.map((useCase) => (
								<MarketingCard
									key={useCase.slug}
									href={routes.marketing.useCase.href({ slug: useCase.slug })}
									title={useCase.title}
									description={useCase.description}
								/>
							))}
						</div>

						<div mix={[s.marketingAudienceCard]}>
							<p mix={[s.marketingCardTitle]}>Tailored solutions for:</p>
							<div mix={[s.marketingHighlightRow]}>
								{AUDIENCE_LINKS.map((audience) => (
									<a
										key={audience.slug}
										href={routes.marketing.audience.href({ slug: audience.slug })}
										mix={[s.marketingNavLink]}
									>
										{audience.label}
									</a>
								))}
							</div>
						</div>
					</div>
				</section>

				<section id="pricing" mix={[s.marketingSectionAlt]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader
							badge="Pricing"
							title="Simple, Transparent Pricing"
							description="One subscription, no tiers. Pay only for what you use with our straightforward pricing model."
						/>

						<div mix={[s.marketingGrid]}>
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

				<section id="faq" mix={[s.marketingSection]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader
							badge="FAQ"
							title="Frequently Asked Questions"
							description="Find answers to common questions about Uptime."
						/>

						<FaqAccordion items={FAQS.map((faq) => ({ ...faq }))} />
					</div>
				</section>
			</>
		);
	};
}
