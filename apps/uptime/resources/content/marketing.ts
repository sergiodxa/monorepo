/**
 * Static content for the site's `/features`, `/for`, `/use-cases`, and `/vs`
 * pages, each family rendered by one shared template instead of bespoke views.
 *
 * Trust-indicator and competitor figures track Uptime's actual behavior and a
 * competitor's actual published pricing, hedged or omitted where the real
 * number isn't known.
 *
 * Pages state the check-interval floor for how fast a failure is caught, since
 * that figure is Uptime's own and enforced — the final delivery hop belongs to
 * an inbox, webhook, or chat provider outside this app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IconName } from "@pkg/lucide-remix";

import type { Usage } from "~/app/lib/pricing";

import {
	BASE_PRICE_USD,
	formatPings,
	formatUsd,
	FREE_TRIAL_DAYS,
	INCLUDED_PINGS,
	monthlyPings,
	PINGS_PER_BLOCK,
	PRICE_PER_BLOCK_USD,
} from "~/app/lib/pricing";

export namespace MarketingContent {
	/** One bullet in a feature grid. */
	export interface Feature {
		title: string;
		description: string;
		/**
		 * Lucide icon name (kebab-case, e.g. `"globe"`), rendered through
		 * `@pkg/lucide-remix`'s `<Icon name>` — a name keeps this file plain data
		 * with no JSX. A grid whose bullets have no icons renders without the tiles.
		 */
		icon?: IconName;
	}

	/**
	 * One headline figure in a page's trust-indicator strip — the four-up band of
	 * stats below the hero. `value` is the figure itself (`"9"`, `"1-60m"`,
	 * `"365d"`), `label` names it.
	 */
	export interface TrustIndicator {
		/** Lucide icon name, same convention as {@link Feature.icon}. */
		icon: IconName;
		value: string;
		/**
		 * What {@link TrustIndicator.value} says out loud, for the figures that are a symbol
		 * rather than something readable (`"∞"`). Passed straight through to the strip, which
		 * announces this instead of the glyph — see `resources/components/marketing/trust-indicators.tsx`.
		 */
		valueLabel?: string;
		label: string;
	}

	/** One "where the competitor is genuinely better" admission on a `/vs/:slug` page. */
	export interface HonestTake {
		title: string;
		description: string;
	}

	/**
	 * One cost scenario on a `/vs/:slug` page. `usage` prices our side through
	 * `app/lib/pricing.ts` so a price change can't leave a stale comparison
	 * figure; the competitor's side stays quoted copy, hedges and all.
	 */
	export interface PricingScenario {
		/** Row label, e.g. `"10 monitors at 30-min intervals"`. */
		scenario: string;
		/**
		 * The setup `scenario` describes, priced through the pricing model. Omitted
		 * only for a row that isn't a ping volume at all (seat pricing, tool sprawl),
		 * which supplies {@link PricingScenario.ourCost} as copy instead.
		 */
		usage?: Usage;
		/** Our cost as copy — only for the rows `usage` can't express. */
		ourCost?: string;
		/** The competitor's price, quoted as their own pricing page reads. */
		theirCost: string;
		/**
		 * The competitor's monthly price in USD when {@link PricingScenario.theirCost}
		 * quotes one unambiguous figure; a range or bundled quote can't be subtracted
		 * honestly, so it falls back to {@link PricingScenario.savingsNote} instead.
		 */
		theirCostUsd?: number;
		/** What the row wins on when that isn't a smaller number. */
		savingsNote?: string;
	}

	/** One numbered step in a "how it works" list. */
	export interface Step {
		title: string;
		description: string;
	}

	/** One question/answer pair in a page's FAQ accordion. */
	export interface Faq {
		question: string;
		answer: string;
	}

	/** One row of a `/vs/:slug` comparison table. */
	export interface ComparisonRow {
		label: string;
		us: string;
		them: string;
	}

	/** Shared shape for `/features/:slug`, `/for/:slug`, and `/use-cases/:slug` pages. */
	export interface Page {
		slug: string;
		metaTitle: string;
		metaDescription: string;
		badge: string;
		title: string;
		highlight: string;
		description: string;
		highlights: [string, string, string];
		features: Feature[];
		steps: Step[];
		faqs: Faq[];
		/**
		 * The four figures in this page's trust-indicator strip, page-specific by
		 * design — a feature page's stats describe that feature, not the product at
		 * large. The strip is skipped entirely for a page with nothing to put in it.
		 */
		trustIndicators?: [TrustIndicator, TrustIndicator, TrustIndicator, TrustIndicator];
	}

	/** `/vs/:slug` comparison page content, extending {@link Page} with a table. */
	export interface ComparisonPage extends Page {
		competitor: string;
		summary: string;
		rows: ComparisonRow[];
		/**
		 * Where the competitor genuinely wins. Deliberately part of the page: a
		 * comparison that only lists our advantages reads as marketing, and the
		 * concession is what makes the rest credible.
		 */
		honestTake?: HonestTake[];
		/** Who this product is the right call for, as a short banner: a claim plus its supporting bullets. */
		perfectFor?: { title: string; description: string; highlights: string[] };
		/** Same-setup cost comparisons, rendered as a table. */
		pricingScenarios?: PricingScenario[];
	}
}

const DEFAULT_STEPS: MarketingContent.Step[] = [
	{
		title: "Create your monitor",
		description: "Point Uptime at the URL, domain, port, or scheduled job you want to track.",
	},
	{
		title: "Choose how you're alerted",
		description:
			"Connect email, Slack, Discord, or a webhook. Set cooldowns to avoid alert fatigue.",
	},
	{
		title: "Watch the dashboard",
		description:
			"See uptime history, response times, and status update as checks run automatically.",
	},
];

/** `/features/:slug` content, keyed by slug. */
export const features: Record<string, MarketingContent.Page> = {
	monitors: {
		slug: "monitors",
		metaTitle: "HTTP Monitoring | Uptime Monitors",
		metaDescription:
			"HTTP health checks from 9 global regions. Monitor any URL with 1-60 minute intervals and 365-day data retention.",
		badge: "HTTP Monitors",
		title: "Know when your service goes down",
		highlight: "before your users do",
		description:
			"HTTP health checks from 9 global regions. Monitor any URL with customizable intervals from 1 to 60 minutes.",
		highlights: ["9 global regions", "1-60 min intervals", "Any HTTP status code"],
		trustIndicators: [
			{ icon: "globe", value: "9", label: "Global Regions" },
			{ icon: "clock", value: "1-60m", label: "Check Intervals" },
			{ icon: "activity", value: "HTTP", label: "Health Checks" },
			{ icon: "database", value: "365d", label: "Data Retention" },
		],
		features: [
			{
				title: "Global coverage",
				description:
					"Monitor from Africa, APAC, Eastern/Western Europe, the Middle East, Oceania, and the Americas.",
				icon: "globe",
			},
			{
				title: "Flexible intervals",
				description:
					"Check every minute for critical services, or every hour for less urgent endpoints.",
				icon: "timer",
			},
			{
				title: "Status code validation",
				description:
					"Expect any HTTP status code — 200, 201, 301, 404 — whatever is correct for you.",
				icon: "shield-check",
			},
			{
				title: "Instant results",
				description: "Run any monitor on demand to test immediately after changes.",
				icon: "play",
			},
			{
				title: "Uptime history",
				description:
					"See service health at a glance: the last 90 days of daily uptime, colored by each day's success rate.",
				icon: "chart-column",
			},
			{
				title: "365-day retention",
				description:
					"Daily results are kept for a full year, with the most recent 90 days charted per monitor.",
				icon: "calendar",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "What types of URLs can I monitor?",
				answer:
					"Any publicly accessible HTTP or HTTPS URL: websites, APIs, webhooks, health check endpoints.",
			},
			{
				question: "How do I choose a monitoring region?",
				answer:
					"Select the region closest to your users or where you want to measure performance from.",
			},
			{
				question: "Can I monitor authenticated endpoints?",
				answer: "Yes, you can add custom headers including Authorization tokens.",
			},
			{
				question: "How quickly am I notified of failures?",
				answer:
					"Within seconds of a failed check. Configure email, Slack, Discord, or webhook alerts.",
			},
		],
	},

	alerts: {
		slug: "alerts",
		metaTitle: "Uptime Alerts | Email & Webhook Notifications",
		metaDescription:
			"Email and webhook alerts on every failed check, from intervals as short as one minute. Integrates with Slack, Discord, PagerDuty, and more.",
		badge: "Alerts",
		title: "Get notified the moment something",
		highlight: "breaks",
		description:
			"Email, Slack, Discord, and webhook alerts for downtime detection, with recovery notifications and configurable cooldowns.",
		highlights: ["Alerts on every failed check", "4 alert channels", "Recovery notifications"],
		trustIndicators: [
			{ icon: "clock", value: "1min", label: "Min Interval" },
			{ icon: "mail", value: "Email", label: "Notifications" },
			{ icon: "webhook", value: "Webhooks", label: "Integrations" },
			{ icon: "bell", value: "4", label: "Alert Channels" },
		],
		features: [
			{
				title: "Email alerts",
				description: "Send downtime and recovery notifications to any address.",
				icon: "mail",
			},
			{
				title: "Slack & Discord",
				description:
					"Native webhook integrations post rich, readable alerts directly to your channels.",
				icon: "message-square",
			},
			{
				title: "Generic webhooks",
				description: "Send signed JSON payloads to any endpoint, with an HMAC signature header.",
				icon: "webhook",
			},
			{
				title: "Recovery alerts",
				description: "Get notified when a service comes back up, including downtime duration.",
				icon: "bell-ring",
			},
			{
				title: "Alert cooldowns",
				description:
					"Set a minimum time between repeat alerts so an ongoing outage doesn't flood your inbox.",
				icon: "bell-off",
			},
			{
				title: "Team or monitor scoped",
				description: "Route some alerts to the whole team and others to a single critical monitor.",
				icon: "route",
			},
		],
		steps: [
			{
				title: "Create an alert",
				description: "Choose a channel and, optionally, a specific monitor.",
			},
			{
				title: "Configure delivery",
				description: "Add the destination — email address, webhook URL, Slack or Discord webhook.",
			},
			{
				title: "Get notified automatically",
				description: "Alerts fire on state changes, with cooldowns preventing repeat noise.",
			},
		],
		faqs: [
			{
				question: "Which alert channels are supported?",
				answer:
					"Email, Slack, Discord, and generic webhooks — connect to any other service via webhook.",
			},
			{
				question: "What happens when an outage is detected?",
				answer:
					"Uptime immediately sends an alert through every configured channel for that monitor.",
			},
			{
				question: "Can I avoid getting alerted repeatedly during a long outage?",
				answer:
					"Yes — set a cooldown so the same alert only re-fires after a minimum time has passed.",
			},
			{
				question: "Do webhook payloads carry a signature?",
				answer:
					"Yes. Set a secret and every webhook request includes an HMAC SHA-256 `Webhook-Signature` header.",
			},
		],
	},

	"status-pages": {
		slug: "status-pages",
		metaTitle: "Status Pages | Uptime Monitors",
		metaDescription:
			"Beautiful, customizable status pages to keep your users informed. Public or private pages with real-time updates and uptime history.",
		badge: "Status Pages",
		title: "Keep your users informed",
		highlight: "without the support tickets",
		description:
			"Beautiful, customizable public status pages with real-time status, uptime history, and your own branding.",
		highlights: ["Custom branding", "90-day uptime history", "Public or private"],
		trustIndicators: [
			{ icon: "globe", value: "Public", label: "Status Pages" },
			{ icon: "palette", value: "Custom", label: "Branding" },
			{ icon: "trending-up", value: "Real-time", label: "Updates" },
			{ icon: "eye", value: "24/7", label: "Visibility" },
		],
		features: [
			{
				title: "Overall status banner",
				description: "A single glance shows operational, degraded, or down.",
				icon: "circle-check",
			},
			{
				title: "Any monitor type",
				description: "Attach HTTP, DNS, TCP, and cron-job monitors to the same page.",
				icon: "layers",
			},
			{
				title: "Your branding",
				description: "Add a logo, title, and description that match your product.",
				icon: "palette",
			},
			{
				title: "Uptime history",
				description:
					"Each service shows its last 90 days of daily uptime so visitors can see recent reliability.",
				icon: "chart-column",
			},
			{
				title: "Public or private",
				description: "Publish pages for customers, or keep them private for internal use only.",
				icon: "eye",
			},
		],
		steps: [
			{ title: "Create a status page", description: "Pick a URL slug, title, and optional logo." },
			{
				title: "Attach your services",
				description: "Select which monitors and cron jobs to display.",
			},
			{ title: "Share the link", description: "Publish the page and share it with your users." },
		],
		faqs: [
			{
				question: "Do you support status pages?",
				answer:
					"Yes — create customizable public status pages to share your service health, with your own branding.",
			},
			{
				question: "Can I include cron job monitors on a status page?",
				answer:
					"Yes, alongside HTTP, DNS, and TCP monitors, each shown with its own status and history.",
			},
			{
				question: "Can I keep a status page private?",
				answer: "Yes — private pages have no public URL and are for internal visibility only.",
			},
			{
				question: "Does the status page update automatically?",
				answer: "Yes, it reflects each attached monitor's latest status and recent uptime history.",
			},
		],
	},

	analytics: {
		slug: "analytics",
		metaTitle: "Uptime Analytics | History & Trends",
		metaDescription:
			"Visual uptime history, response time tracking, and 365-day data retention. Understand your service reliability at a glance.",
		badge: "Analytics",
		title: "Understand your reliability",
		highlight: "at a glance",
		description:
			"Visual uptime history, response time tracking, and 365 days of retained data across every monitor type.",
		highlights: ["365-day retention", "90-day uptime history", "P99 response time"],
		trustIndicators: [
			{ icon: "calendar", value: "365", label: "Days Retention" },
			{ icon: "chart-column", value: "90d", label: "Uptime History" },
			{ icon: "clock", value: "P99", label: "Response Time" },
			{ icon: "trending-up", value: "Trends", label: "Analysis" },
		],
		features: [
			{
				title: "Daily uptime history",
				description: "See the last 90 days of daily uptime at a glance, per monitor.",
				icon: "chart-column",
			},
			{
				title: "Response time tracking",
				description: "Track average and P99 latency to catch slow-but-not-down degradation.",
				icon: "timer",
			},
			{
				title: "Dashboard stats",
				description:
					"Uptime percentage, ping usage, and slowest endpoint surfaced on your dashboard.",
				icon: "layout-dashboard",
			},
			{
				title: "Per-type breakdowns",
				description:
					"HTTP, DNS, TCP, and cron-job monitors each get their own aggregated daily stats.",
				icon: "chart-column",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "How long is ping data stored?",
				answer: "365 days. After that, results are automatically deleted.",
			},
			{
				question: "Can I view historical performance trends?",
				answer:
					"Yes — the last 90 days of daily uptime are charted per monitor, and daily results are retained for a full year.",
			},
			{
				question: "What is P99 response time?",
				answer:
					"The response time under which 99% of your checks complete — a good signal of worst-case latency.",
			},
		],
	},

	teams: {
		slug: "teams",
		metaTitle: "Team Collaboration | Uptime Teams",
		metaDescription:
			"Collaborate on uptime monitoring with unlimited team members. Role-based access and domain auto-provisioning included.",
		badge: "Teams",
		title: "Monitor together",
		highlight: "not alone",
		description:
			"Collaborate on uptime monitoring with unlimited team members, role-based access, and domain auto-provisioning.",
		highlights: ["Unlimited members", "Owner/Admin/Member roles", "Domain auto-provisioning"],
		trustIndicators: [
			{ icon: "users", value: "∞", valueLabel: "Unlimited", label: "Team Members" },
			{ icon: "shield", value: "3", label: "Role Levels" },
			{ icon: "globe", value: "Domain", label: "Verification" },
			{ icon: "user-plus", value: "Auto", label: "Provisioning" },
		],
		features: [
			{
				title: "Invite anyone",
				description: "Send an email invite; the recipient joins with one click.",
				icon: "user-plus",
			},
			{
				title: "Role-based access",
				description:
					"Owners and Admins manage settings, billing, and members; Members focus on monitoring.",
				icon: "shield",
			},
			{
				title: "Domain auto-provisioning",
				description: "Verify a company domain so anyone with a matching email joins automatically.",
				icon: "globe",
			},
			{
				title: "Shared visibility",
				description: "Every team member sees the same monitors, alerts, and status pages.",
				icon: "users",
			},
		],
		steps: [
			{ title: "Create or join a team", description: "Every account starts with a team you own." },
			{
				title: "Invite your team",
				description: "Add members by email, or verify a domain to auto-provision.",
			},
			{
				title: "Assign roles",
				description: "Promote trusted teammates to Admin as your team grows.",
			},
		],
		faqs: [
			{
				question: "Do you support teams or shared monitors?",
				answer:
					"Yes — every user starts with a team. Invite members with Owner, Admin, or Member roles.",
			},
			{
				question: "What does domain auto-provisioning do?",
				answer:
					"Verify a company domain via a DNS TXT record, and anyone signing in with a matching email joins automatically.",
			},
		],
	},

	api: {
		slug: "api",
		metaTitle: "Public API | Uptime Monitors",
		metaDescription:
			"Integrate monitoring into your workflow with our REST API. Create monitors, manage alerts, and access metrics programmatically.",
		badge: "API",
		title: "Automate your monitoring",
		highlight: "with a REST API",
		description:
			"Integrate monitoring into your workflow with a REST API. Create monitors, manage alerts, and read metrics programmatically.",
		highlights: ["API key scopes", "REST resources", "Cron-job ping endpoint"],
		trustIndicators: [
			{ icon: "code", value: "REST", label: "API" },
			{ icon: "book-open", value: "Full", label: "Documentation" },
			{ icon: "key", value: "Scoped", label: "API Keys" },
			{ icon: "zap", value: "Fast", label: "Responses" },
		],
		features: [
			{
				title: "Scoped API keys",
				description: "Issue keys with only the permissions each integration needs.",
				icon: "key",
			},
			{
				title: "Full resource coverage",
				description:
					"Monitors, DNS/TCP monitors, alerts, maintenance windows, status pages, and more.",
				icon: "layers",
			},
			{
				title: "Cron-job ping endpoint",
				description: "A dedicated public endpoint your scheduled jobs call to report a heartbeat.",
				icon: "radio-tower",
			},
			{
				title: "Predictable errors",
				description:
					"Consistent error codes and rate limits so client integrations are easy to write.",
				icon: "shield-check",
			},
		],
		steps: [
			{
				title: "Create an API key",
				description: "Generate a key with the scopes your integration needs.",
			},
			{
				title: "Call the API",
				description: "Create and manage monitors, alerts, and more programmatically.",
			},
			{
				title: "Automate your workflow",
				description: "Wire monitoring into deploy scripts or infrastructure tooling.",
			},
		],
		faqs: [
			{
				question: "Is there a public API?",
				answer: "Yes — a full REST API with scoped API keys covers monitors, alerts, and more.",
			},
			{
				question: "How do scheduled jobs report in?",
				answer:
					"Each cron-job monitor gets a dedicated public ping URL your job calls on completion.",
			},
		],
	},

	integrations: {
		slug: "integrations",
		metaTitle: "Integrations | Uptime",
		metaDescription:
			"Connect monitoring to your workflow with Slack, Discord, PagerDuty, and custom webhooks. Native integrations for instant notifications.",
		badge: "Integrations",
		title: "Fits into the tools",
		highlight: "you already use",
		description:
			"Connect monitoring to your workflow with native Slack and Discord integrations, plus custom webhooks for everything else.",
		highlights: ["Slack", "Discord", "Custom webhooks"],
		trustIndicators: [
			{ icon: "hash", value: "Slack", label: "Integration" },
			{ icon: "message-square", value: "Discord", label: "Integration" },
			{ icon: "zap", value: "Instant", label: "Delivery" },
			{ icon: "bell", value: "Rich", label: "Notifications" },
		],
		features: [
			{
				title: "Slack",
				description: "Native Incoming Webhook support with rich, readable alert formatting.",
				icon: "hash",
			},
			{
				title: "Discord",
				description: "Post alerts straight to a Discord channel via webhook.",
				icon: "message-square",
			},
			{
				title: "Custom webhooks",
				description:
					"Send signed JSON payloads to any endpoint — PagerDuty, Opsgenie, or your own service.",
				icon: "webhook",
			},
			{
				title: "Email",
				description: "The simplest integration: alerts land straight in an inbox.",
				icon: "mail",
			},
		],
		steps: [
			{ title: "Pick a channel", description: "Slack, Discord, email, or a generic webhook." },
			{
				title: "Paste the webhook URL",
				description: "Grab it from Slack or Discord's integration settings.",
			},
			{ title: "Test it", description: "Trigger a manual check to confirm the alert arrives." },
		],
		faqs: [
			{
				question: "Do you support Slack and Discord natively?",
				answer: "Yes — direct integrations with rich notifications, not just basic webhooks.",
			},
			{
				question: "Can I integrate with PagerDuty or Opsgenie?",
				answer: "Yes, via a generic signed webhook that most incident-management tools can ingest.",
			},
		],
	},

	maintenance: {
		slug: "maintenance",
		metaTitle: "Maintenance Windows | Uptime",
		metaDescription:
			"Schedule planned downtime, suppress alerts during maintenance, and keep your team informed with maintenance windows.",
		badge: "Maintenance Windows",
		title: "Planned downtime",
		highlight: "shouldn't trigger alerts",
		description:
			"Schedule planned downtime, suppress alerts automatically, and end a maintenance window early when work finishes ahead of schedule.",
		highlights: ["One-time or recurring", "Team or monitor scoped", "End early anytime"],
		trustIndicators: [
			{ icon: "calendar", value: "Scheduled", label: "Maintenance" },
			{ icon: "bell-off", value: "Alert", label: "Suppression" },
			{ icon: "repeat", value: "Recurring", label: "Windows" },
			{ icon: "shield", value: "Clean", label: "Metrics" },
		],
		features: [
			{
				title: "Scheduled suppression",
				description: "Alerts are automatically suppressed for the window's duration.",
				icon: "bell-off",
			},
			{
				title: "Recurring windows",
				description: "Set a weekly deploy window once instead of every time.",
				icon: "repeat",
			},
			{
				title: "End early",
				description:
					"Finished ahead of schedule? End the window and resume monitoring immediately.",
				icon: "circle-play",
			},
			{
				title: "Scoped to what you need",
				description: "Suppress alerts for the whole team or a single monitor.",
				icon: "layers",
			},
		],
		steps: [
			{
				title: "Schedule a window",
				description: "Pick a start and end time, one-time or recurring.",
			},
			{
				title: "Deploy or maintain",
				description: "Alerts stay suppressed for every affected monitor.",
			},
			{
				title: "Resume automatically",
				description: "Monitoring and alerting resume the moment the window ends.",
			},
		],
		faqs: [
			{
				question: "Do maintenance windows stop monitoring, or just alerts?",
				answer: "Checks keep running; only alert delivery is suppressed for the window's duration.",
			},
			{
				question: "Can I end a maintenance window early?",
				answer: "Yes, end it at any time and alerting resumes immediately.",
			},
		],
	},

	dns: {
		slug: "dns",
		metaTitle: "DNS Monitoring | Uptime",
		metaDescription:
			"Monitor a domain for unexpected DNS changes. One monitor covers six record types — A, AAAA, CNAME, MX, TXT and NS — to catch hijacking attempts.",
		badge: "DNS Monitors",
		title: "Catch DNS changes",
		highlight: "before they cause an outage",
		description:
			"One monitor watches a whole domain, across every record type it checks — A, AAAA, CNAME, MX, TXT and NS — so hijacking and misconfiguration surface as findings rather than outages.",
		highlights: ["A/AAAA/CNAME/MX/TXT/NS", "Change detection", "One monitor per domain"],
		trustIndicators: [
			{ icon: "layers", value: "6", label: "Record types" },
			{ icon: "globe", value: "1", label: "Monitor per domain" },
			{ icon: "refresh-cw", value: "15m", label: "Minimum interval" },
			{ icon: "shield-check", value: "Hijack", label: "Detection" },
		],
		features: [
			{
				title: "Record change detection",
				description:
					"A watched record that changes or stops resolving is reported on the next check.",
				icon: "refresh-cw",
			},
			{
				title: "Every record type in one monitor",
				description:
					"One monitor checks A, AAAA, CNAME, MX, TXT and NS records at every name it tracks.",
				icon: "database",
			},
			{
				title: "Hijack detection",
				description: "Unexpected DNS changes are often the first sign of an account compromise.",
				icon: "shield-check",
			},
			{
				title: "New records are reported",
				description:
					"A record that appears beside the ones you imported is reported as an addition, not hidden inside a changed value.",
				icon: "globe",
			},
		],
		steps: [
			{
				title: "Add a DNS monitor",
				description:
					"Enter the domain you want to watch, and paste your zone file to cover its other names.",
			},
			{
				title: "Review what we found",
				description:
					"Uptime checks every record type at every name it knows about, and you pick which records to watch.",
			},
			{
				title: "Get alerted on change",
				description:
					"A watched record that changes or disappears, or a record that appears unannounced, triggers an alert.",
			},
		],
		faqs: [
			{
				question: "Which record types can I monitor?",
				answer:
					"Six: A, AAAA, CNAME, MX, TXT and NS. CAA, SOA, SRV and the rest aren't checked yet.",
			},
			{
				question: "Does one monitor cover my subdomains?",
				answer:
					"Only the names it knows about. DNS can't be listed from outside a zone, so a monitor covers your domain itself unless you paste a zone file naming the rest.",
			},
			{
				question: "Why would my DNS records change unexpectedly?",
				answer:
					"Account compromise, registrar misconfiguration, or an expired domain are the most common causes.",
			},
		],
	},

	ssl: {
		slug: "ssl",
		metaTitle: "SSL Certificate Monitoring | Uptime",
		metaDescription:
			"Track SSL certificate expiry and get alerts before they expire. Automatic daily checks with configurable warning thresholds.",
		badge: "SSL Monitoring",
		title: "Never let a certificate",
		highlight: "expire unnoticed",
		description:
			"Track SSL certificate expiry and get alerts before they expire, with daily checks and a configurable warning threshold.",
		highlights: ["Daily checks", "Configurable warning window", "Per-monitor thresholds"],
		/**
		 * These figures describe expiry-date tracking only. SSL monitoring compares
		 * a manually-entered expiry date against today's date, so the copy stays
		 * scoped to what the check actually verifies.
		 */
		trustIndicators: [
			{ icon: "calendar-clock", value: "Daily", label: "Expiry Checks" },
			{ icon: "bell-ring", value: "Custom", label: "Warning Days" },
			{ icon: "repeat", value: "Repeat", label: "Reminders" },
			{ icon: "shield-check", value: "Valid", label: "Cert Status" },
		],
		features: [
			{
				title: "Expiry tracking",
				description: "Store your certificate's expiry date and issuer for quick reference.",
				icon: "calendar-clock",
			},
			{
				title: "Warning thresholds",
				description: "Choose how many days before expiry you want to be alerted.",
				icon: "bell-ring",
			},
			{
				title: "Repeated reminders",
				description: "Alerts repeat at each threshold, gated by cooldown, until you renew.",
				icon: "repeat",
			},
			{
				title: "Per-monitor status",
				description:
					"See valid, expiring soon, or expired status right on the monitor detail page.",
				icon: "shield-check",
			},
		],
		steps: [
			{
				title: "Enable SSL monitoring",
				description: "Turn it on for any HTTP monitor and enter the certificate's expiry date.",
			},
			{
				title: "Set a warning window",
				description: "Choose how many days of advance notice you want.",
			},
			{
				title: "Renew before it expires",
				description: "Get alerted well before your certificate lapses.",
			},
		],
		faqs: [
			{
				question: "Does Uptime read my certificate automatically?",
				answer:
					"No — enter the expiry date and issuer manually; Uptime checks it against today's date daily.",
			},
			{
				question: "Will I get alerted more than once?",
				answer: "Yes, at each configured threshold, subject to your alert cooldown.",
			},
		],
	},

	"cron-jobs": {
		slug: "cron-jobs",
		metaTitle: "Cron Job Monitoring | Uptime",
		metaDescription:
			"Monitor scheduled tasks and background jobs. Get alerted when cron jobs are late or miss their execution window.",
		badge: "Cron Job Monitoring",
		title: "Know when a scheduled job",
		highlight: "doesn't run",
		description:
			"Monitor scheduled tasks and background jobs with heartbeat pings. Get alerted when a job is late or misses its window entirely.",
		highlights: ["Heartbeat pings", "Cron expressions", "Late/missed detection"],
		trustIndicators: [
			{ icon: "shield-check", value: "99.9%", label: "Uptime Target" },
			{ icon: "activity", value: "5", label: "Monitor Types" },
			{ icon: "clock", value: "24/7", label: "Monitoring" },
			{ icon: "calendar", value: "365d", label: "Retention" },
		],
		features: [
			{
				title: "Simple ping URL",
				description: "Your job calls one URL when it completes — no SDK required.",
				icon: "radio-tower",
			},
			{
				title: "Cron-aware scheduling",
				description: "Uptime parses your cron expression and knows exactly when to expect a ping.",
				icon: "calendar-clock",
			},
			{
				title: "Grace periods",
				description: "Allow jobs a little slack before marking them late.",
				icon: "timer",
			},
			{
				title: "Healthy → late → missed",
				description: "A clear state machine so you always know a job's current status.",
				icon: "activity",
			},
		],
		steps: [
			{
				title: "Create a cron job monitor",
				description: "Enter the schedule as a standard cron expression.",
			},
			{
				title: "Call the ping URL",
				description: "Add one line to your job that pings the URL on completion.",
			},
			{
				title: "Get alerted if it's late",
				description: "Uptime tracks expected run times and alerts on missed pings.",
			},
		],
		faqs: [
			{
				question: "Do I need an API key to ping in?",
				answer:
					"No — the cron-job ping endpoint is public and rate-limited, so a single line in your job is enough.",
			},
			{
				question: "What happens if my job runs a bit late?",
				answer:
					"A grace period absorbs normal variance before the job is marked late, then missed.",
			},
		],
	},

	"content-monitoring": {
		slug: "content-monitoring",
		metaTitle: "Content Monitoring | Uptime",
		metaDescription:
			"Verify specific content appears on your pages. Check for keywords, patterns, or specific text to ensure page integrity.",
		badge: "Content Monitoring",
		title: "Make sure the page",
		highlight: "actually says the right thing",
		description:
			"Verify specific content appears — or doesn't appear — on your pages. Check for keywords, patterns, or specific text to catch broken deploys and defacement.",
		highlights: ["Contains / not-contains", "Regex patterns", "Case-sensitive option"],
		trustIndicators: [
			{ icon: "search", value: "Keyword", label: "Detection" },
			{ icon: "circle-check", value: "Content", label: "Validation" },
			{ icon: "regex", value: "Regex", label: "Patterns" },
			{ icon: "shield-alert", value: "Defacement", label: "Detection" },
		],
		features: [
			{
				title: "Contains checks",
				description: "Fail the monitor if expected text is missing from the response.",
				icon: "search",
			},
			{
				title: "Not-contains checks",
				description: "Fail the monitor if an error string or banned phrase appears.",
				icon: "circle-x",
			},
			{
				title: "Regex patterns",
				description: "Match complex patterns beyond simple substring checks.",
				icon: "regex",
			},
			{
				title: "Stacked on any HTTP monitor",
				description: "Add multiple content checks to the same monitor.",
				icon: "layers",
			},
		],
		steps: [
			{ title: "Add a content check", description: "Attach it to an existing HTTP monitor." },
			{ title: "Choose a check type", description: "Contains, not-contains, or a regex pattern." },
			{
				title: "Get alerted on mismatch",
				description: "A failing content check fails the whole monitor.",
			},
		],
		faqs: [
			{
				question: "What happens on an empty response body?",
				answer:
					"`not_contains` passes on an empty body; `contains` and regex checks fail, since there's nothing to match.",
			},
			{
				question: "Can I check for multiple things at once?",
				answer: "Yes — add as many content checks as you need to a single monitor.",
			},
		],
	},
};

/** `/for/:slug` content, keyed by audience slug. */
export const audiences: Record<string, MarketingContent.Page> = {
	"solo-devs": {
		slug: "solo-devs",
		metaTitle: "Uptime for Solo Developers | Free Monitoring",
		metaDescription:
			"Professional uptime monitoring for solo developers. Start free, upgrade when ready. Perfect for portfolios and side projects.",
		badge: "For Solo Developers",
		title: "Professional monitoring",
		highlight: "on a solo budget",
		description:
			"Start free, upgrade when ready. Perfect for portfolios, side projects, and the first real users of your next idea.",
		highlights: ["Free to start", "No credit card required", "Pay only for automation"],
		trustIndicators: [
			{ icon: "code", value: "Free", label: "To Start" },
			{ icon: "clock", value: "1min", label: "Min Interval" },
			{ icon: "database", value: "365", label: "Days Retention" },
			{ icon: "globe", value: "9", label: "Regions" },
		],
		features: [
			{
				title: "Free manual monitoring",
				description: "Create monitors and trigger pings by hand, forever, at no cost.",
				icon: "mouse-pointer-click",
			},
			{
				title: "Usage-based pricing",
				description: "Automated checks are billed per-ping, so a small project stays cheap.",
				icon: "dollar-sign",
			},
			{
				title: "One dashboard",
				description: "See every monitor's status and history in a single, simple view.",
				icon: "layout-dashboard",
			},
			{
				title: "Alerts that reach you",
				description: "Email, Slack, Discord, or webhook — wherever you already look.",
				icon: "bell",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Is there a free tier?",
				answer:
					"Yes — unlimited monitors and manual pings are free forever. Automatic scheduled checks require a subscription.",
			},
			{
				question: "How much does automated monitoring cost?",
				answer: `${formatUsd(BASE_PRICE_USD)}/month includes ${formatPings(INCLUDED_PINGS)} pings; additional pings are ${formatUsd(PRICE_PER_BLOCK_USD)} per ${formatPings(PINGS_PER_BLOCK)}.`,
			},
		],
	},

	startups: {
		slug: "startups",
		metaTitle: "Uptime for Startups | Team Monitoring",
		metaDescription:
			"Uptime monitoring for startups. Team collaboration, instant alerts, and usage-based pricing that scales with you.",
		badge: "For Startups",
		title: "Monitoring that scales",
		highlight: "with your team",
		description:
			"Team collaboration, instant alerts, and usage-based pricing that scales with you as your product — and your on-call rotation — grows.",
		highlights: ["Unlimited team members", "Role-based access", "Usage-based pricing"],
		trustIndicators: [
			{ icon: "users", value: "∞", valueLabel: "Unlimited", label: "Team Members" },
			{ icon: "clock", value: "1min", label: "Min Interval" },
			{ icon: "shield-check", value: "99.9%", label: "Uptime Target" },
			{ icon: "globe", value: "9", label: "Regions" },
		],
		features: [
			{
				title: "Grow your team",
				description: "Invite engineers as you hire, with no per-seat pricing.",
				icon: "users",
			},
			{
				title: "Role-based access",
				description: "Owners and Admins manage settings; Members focus on monitoring.",
				icon: "shield",
			},
			{
				title: "Status pages",
				description: "Give customers a public status page as trust becomes a selling point.",
				icon: "layout-template",
			},
			{
				title: "API access",
				description: "Wire monitoring into your deploy pipeline as your infra matures.",
				icon: "terminal",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Does pricing scale with team size?",
				answer:
					"No — pricing is based on monitoring usage (pings), not the number of team members.",
			},
			{
				question: "Can we add a public status page later?",
				answer: "Yes, at any time, with any subset of your monitors attached.",
			},
		],
	},

	agencies: {
		slug: "agencies",
		metaTitle: "Uptime for Agencies | Know Before the Client Calls",
		metaDescription: `Monitor every client site, API, certificate and cron job from one dashboard. Unlimited monitors and team members from ${formatUsd(BASE_PRICE_USD)}/month. Watch one client site free for ${FREE_TRIAL_DAYS} days.`,
		badge: "For Agencies & Freelancers",
		title: "Know a client site is down",
		highlight: "before they call you",
		description: `Monitor client websites, APIs, SSL certificates, DNS records, ports and scheduled jobs from one dashboard. Unlimited monitors and unlimited team members, from ${formatUsd(BASE_PRICE_USD)}/month.`,
		highlights: [
			"Unlimited sites, no per-site pricing",
			"A status page per client",
			`Free for ${FREE_TRIAL_DAYS} days, no card`,
		],
		/**
		 * These figures name product facts, not a reliability claim. "Multi-site" fits
		 * how client sites live side by side in one team, naming the workflow an
		 * agency actually runs.
		 */
		trustIndicators: [
			{ icon: "monitor", value: "∞", valueLabel: "Unlimited", label: "Monitors & Members" },
			{ icon: "layers", value: "5", label: "Monitor Types" },
			{ icon: "globe", value: "9", label: "Regions" },
			{ icon: "dollar-sign", value: formatUsd(BASE_PRICE_USD), label: "Base Price" },
		],
		features: [
			{
				title: "Find out before the client does",
				description:
					"The call you don't want is the client telling you their site is down. Checks run as often as every minute and the alert goes to you first.",
				icon: "siren",
			},
			{
				title: "No monitor math",
				description:
					"Unlimited monitors and unlimited team members. Add a client, add their staging site, add the whole team — the price doesn't move because you added rows.",
				icon: "infinity",
			},
			{
				title: "Certificates you'd otherwise forget",
				description:
					"An expired certificate takes a client's site down as effectively as an outage, on a date nobody has in a calendar. SSL expiry is watched per site and warned on ahead of time.",
				icon: "shield-check",
			},
			{
				title: "DNS you didn't change",
				description:
					"Records get edited at the registrar by someone who isn't you. DNS monitors tell you what changed and when.",
				icon: "globe",
			},
			{
				title: "The jobs nobody watches",
				description:
					"Backups, imports, and nightly syncs fail silently. A cron monitor expects a ping on a schedule and tells you when one doesn't arrive.",
				icon: "timer",
			},
			{
				title: "A status page per client",
				description:
					"Point a client at their own status page instead of answering the same question by email. Each one shows only that client's monitors.",
				icon: "layout-template",
			},
		],
		steps: [
			{
				title: `Watch one client site free for ${FREE_TRIAL_DAYS} days`,
				description:
					"Give us a URL and an email. We check it hourly for a week and send you a health report at the end — no account and no card.",
			},
			{
				title: "Bring the rest of the roster over",
				description:
					"Sign up and the site you were already watching becomes a real monitor, with the week it has behind it. Add the others at whatever interval each one deserves.",
			},
			{
				title: "Point alerts where you already work",
				description:
					"Email, Slack, Discord, or a webhook, with cooldowns so a flapping site doesn't bury the rest of the roster.",
			},
		],
		faqs: [
			{
				question: "How does pricing work if I have thirty client sites?",
				answer: `You're billed for checks, not for sites. ${formatUsd(BASE_PRICE_USD)}/month includes ${formatPings(INCLUDED_PINGS)} checks, and usage past that is ${formatUsd(PRICE_PER_BLOCK_USD)} per ${formatPings(PINGS_PER_BLOCK)} checks in whole blocks. Thirty sites checked every fifteen minutes is about ${formatPings(monthlyPings({ monitors: 30, intervalMinutes: 15 }))} checks a month, so what you pay depends on how often you check rather than on how many clients you have.`,
			},
			{
				question: "Do I pay per team member?",
				answer:
					"No. Invite everyone who might pick up an incident — members are unlimited and don't affect the price.",
			},
			{
				question: "Can I give each client their own status page?",
				answer: "Yes — create one status page per client and attach only that client's monitors.",
			},
			{
				question: "Can I monitor client domains I don't own?",
				answer:
					"You need authorization to monitor any endpoint you don't own — see the Terms of Service.",
			},
			{
				question: "What happens to the free week if I sign up partway through?",
				answer:
					"It carries over. The site becomes a monitor on your account with the checks it has already run behind it, so you don't set it up twice or start the graph from zero.",
			},
		],
	},

	enterprises: {
		slug: "enterprises",
		metaTitle: "Uptime for Enterprises | Domain Auto-Provisioning",
		metaDescription:
			"Enterprise uptime monitoring with domain verification, auto-provisioning, and role-based access. 99.9% uptime target.",
		badge: "For Enterprises",
		title: "Enterprise-ready",
		highlight: "monitoring",
		description:
			"Domain verification, auto-provisioning, and role-based access, with a 99.9% uptime target for the monitoring platform itself.",
		highlights: ["Domain auto-provisioning", "Role-based access", "99.9% uptime target"],
		/**
		 * "Uptime Target" names the 99.9% figure as a goal held for the platform
		 * itself, matching the "Do you offer an SLA?" answer in the FAQ below.
		 */
		trustIndicators: [
			{ icon: "shield", value: "99.9%", label: "Uptime Target" },
			{ icon: "users", value: "Auto", label: "Provisioning" },
			{ icon: "lock", value: "Verified", label: "Domains" },
			{ icon: "globe", value: "9", label: "Regions" },
		],
		features: [
			{
				title: "Domain verification",
				description: "Verify company domains via DNS TXT record for automatic onboarding.",
				icon: "badge-check",
			},
			{
				title: "Auto-provisioning",
				description:
					"Anyone signing in with a verified domain's email joins the team automatically.",
				icon: "user-plus",
			},
			{
				title: "Role-based access",
				description: "Owner, Admin, and Member roles control who can change settings and billing.",
				icon: "shield",
			},
			{
				title: "Full audit trail",
				description: "Alert history and domain verification records for every action.",
				icon: "history",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Do you offer an SLA?",
				answer:
					"We target 99.9% availability as a goal, though we don't offer a financial-remedy SLA today.",
			},
			{
				question: "How does domain auto-provisioning work?",
				answer:
					"Add a domain, verify it with a DNS TXT record, and anyone with a matching email joins automatically.",
			},
		],
	},

	devops: {
		slug: "devops",
		metaTitle: "Uptime for DevOps | API-First Monitoring",
		metaDescription:
			"Uptime monitoring built for DevOps workflows. API-first design, webhook integrations, and fits into your existing toolchain.",
		badge: "For DevOps",
		title: "Built for your",
		highlight: "existing toolchain",
		description:
			"API-first design and webhook integrations mean Uptime fits into your deploy pipeline instead of asking you to change it.",
		highlights: ["Full REST API", "Signed webhooks", "Cron & TCP monitoring"],
		/**
		 * "Signed Webhooks" leads this strip because the HMAC contract is a concrete
		 * claim a DevOps reader can verify directly.
		 */
		trustIndicators: [
			{ icon: "code", value: "REST", label: "API First" },
			{ icon: "webhook", value: "HMAC", label: "Signed Webhooks" },
			{ icon: "layers", value: "No", label: "Lock-in" },
			{ icon: "terminal", value: "TCP", label: "& Cron Checks" },
		],
		features: [
			{
				title: "REST API",
				description: "Manage monitors, alerts, and maintenance windows programmatically.",
				icon: "code",
			},
			{
				title: "Signed webhooks",
				description: "Every webhook alert carries an HMAC signature you can verify.",
				icon: "webhook",
			},
			{
				title: "TCP & cron monitoring",
				description: "Watch raw ports and scheduled jobs, not just HTTP endpoints.",
				icon: "terminal",
			},
			{
				title: "Maintenance windows",
				description: "Suppress alerts automatically during scheduled deploys.",
				icon: "calendar-clock",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Can I manage monitors as code?",
				answer:
					"Yes — every action available in the dashboard is also available through the REST API.",
			},
			{
				question: "Does a deploy trigger false alerts?",
				answer:
					"Not if you schedule a maintenance window first — alerts are suppressed for its duration.",
			},
		],
	},

	"indie-hackers": {
		slug: "indie-hackers",
		metaTitle: "Uptime for Indie Hackers | Simple Monitoring",
		metaDescription: `Uptime monitoring built for indie hackers. Start free, pay only for what you use. ${formatUsd(BASE_PRICE_USD)}/mo includes ${formatPings(INCLUDED_PINGS)} pings.`,
		badge: "For Indie Hackers",
		title: "Simple monitoring for",
		highlight: "your next launch",
		description: `Start free, pay only for what you use. ${formatUsd(BASE_PRICE_USD)}/month includes ${formatPings(INCLUDED_PINGS)} pings — plenty for a lean, bootstrapped product.`,
		highlights: [
			`${formatUsd(BASE_PRICE_USD)}/mo includes ${formatPings(INCLUDED_PINGS)} pings`,
			"No hidden fees",
			"Set up in minutes",
		],
		trustIndicators: [
			{ icon: "shield-check", value: "99.9%", label: "Uptime Target" },
			{ icon: "rocket", value: "<2min", label: "Setup Time" },
			{ icon: "dollar-sign", value: formatUsd(BASE_PRICE_USD), label: "Base Price" },
			{ icon: "globe", value: "9", label: "Global Regions" },
		],
		features: [
			{
				title: "Fast setup",
				description: "Create your first monitor and get a result in under a minute.",
				icon: "rocket",
			},
			{
				title: "Transparent pricing",
				description: "One flat base fee plus a clear per-ping rate — no surprise tiers.",
				icon: "dollar-sign",
			},
			{
				title: "Status pages",
				description: "Add a status page the moment you have real users to reassure.",
				icon: "layout-template",
			},
			{
				title: "Alerts you'll actually see",
				description: "Email, Slack, or Discord — wherever you already spend your day.",
				icon: "bell",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "What happens if I exceed my plan's limits?",
				answer: `You're charged ${formatUsd(PRICE_PER_BLOCK_USD)} for every ${formatPings(PINGS_PER_BLOCK)} pings above the ${formatPings(INCLUDED_PINGS)} included in your subscription. No surprise cutoffs.`,
			},
			{
				question: "Can I cancel anytime?",
				answer:
					"Yes, cancel anytime — refunds are prorated for the unused portion of your subscription.",
			},
		],
	},
};

/** `/use-cases/:slug` content, keyed by use-case slug. */
export const useCases: Record<string, MarketingContent.Page> = {
	"website-monitoring": {
		slug: "website-monitoring",
		metaTitle: "Website Monitoring | Uptime",
		metaDescription:
			"Monitor website uptime and performance from 9 global regions. Track response times, SSL certificates, and get instant downtime alerts.",
		badge: "Website Monitoring",
		title: "Know your website is up",
		highlight: "everywhere your users are",
		description:
			"Monitor website uptime and performance from 9 global regions. Track response times, SSL certificates, and get instant downtime alerts.",
		highlights: ["9 global regions", "SSL expiry tracking", "Instant alerts"],
		trustIndicators: [
			{ icon: "globe", value: "Any", label: "Website" },
			{ icon: "calendar", value: "365d", label: "Retention" },
			{ icon: "map", value: "9", label: "Regions" },
			{ icon: "clock", value: "1min", label: "Min Interval" },
		],
		features: [
			{
				title: "Global HTTP checks",
				description: "Confirm your site loads correctly from regions around the world.",
				icon: "globe",
			},
			{
				title: "SSL monitoring",
				description: "Get warned before a certificate expires and breaks HTTPS.",
				icon: "shield-check",
			},
			{
				title: "Content checks",
				description: "Verify the homepage actually renders, not just that it returns 200.",
				icon: "search",
			},
			{
				title: "Public status page",
				description: "Show visitors real-time status when something does go wrong.",
				icon: "layout-template",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Can I monitor multiple pages on my site?",
				answer: "Yes — create a separate monitor for each URL you care about.",
			},
			{
				question: "Will I know about a broken deploy, not just downtime?",
				answer:
					"Yes — content checks fail a monitor if expected text is missing, catching broken deploys HTTP status alone would miss.",
			},
		],
	},

	"api-monitoring": {
		slug: "api-monitoring",
		metaTitle: "API Monitoring | Uptime",
		metaDescription:
			"Monitor REST APIs and endpoints with detailed status checks. Track response codes, measure latency, and verify API health.",
		badge: "API Monitoring",
		title: "Verify your API",
		highlight: "actually works",
		description:
			"Monitor REST APIs and endpoints with detailed status checks. Track response codes, measure latency, and verify API health.",
		highlights: ["Custom headers", "Any status code", "Latency tracking"],
		trustIndicators: [
			{ icon: "code", value: "REST", label: "& GraphQL" },
			{ icon: "globe", value: "9", label: "Regions" },
			{ icon: "clock", value: "P99", label: "Latency" },
			{ icon: "shield", value: "Auth", label: "Headers" },
		],
		features: [
			{
				title: "Authenticated checks",
				description: "Add Authorization headers to monitor endpoints behind auth.",
				icon: "key",
			},
			{
				title: "Status code validation",
				description: "Expect the exact status code your API should return.",
				icon: "shield-check",
			},
			{
				title: "Latency tracking",
				description: "Watch P99 response time to catch slow-but-not-down degradation.",
				icon: "gauge",
			},
			{
				title: "Content checks",
				description: "Verify the response body contains an expected field or value.",
				icon: "search",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Can I monitor authenticated API endpoints?",
				answer: "Yes — add custom headers, including Authorization tokens, to any monitor.",
			},
			{
				question: "Can I check the response body, not just the status code?",
				answer: "Yes, with content checks for a keyword, phrase, or regex pattern.",
			},
		],
	},

	"cron-jobs": {
		slug: "cron-jobs",
		metaTitle: "Cron Job Monitoring | Uptime",
		metaDescription:
			"Monitor scheduled tasks and cron jobs. Get alerts when jobs are late, miss their window, or fail to complete.",
		badge: "Cron Job Monitoring",
		title: "Know your scheduled jobs",
		highlight: "actually ran",
		description:
			"Monitor scheduled tasks and cron jobs. Get alerts when jobs are late, miss their window, or fail to complete.",
		highlights: ["Heartbeat pings", "Grace periods", "Healthy/late/missed states"],
		trustIndicators: [
			{ icon: "clock", value: "<1min", label: "Detection Time" },
			{ icon: "eye", value: "24/7", label: "Monitoring" },
			{ icon: "shield", value: "365", label: "Days Retention" },
			{ icon: "circle-check", value: "99.9%", label: "Uptime Target" },
		],
		features: [
			{
				title: "Cron-aware scheduling",
				description: "Uptime parses your cron expression to know exactly when to expect a ping.",
				icon: "calendar-clock",
			},
			{
				title: "Public ping endpoint",
				description: "One line in your job reports completion — no API key needed.",
				icon: "radio-tower",
			},
			{
				title: "Grace periods",
				description: "Absorb normal timing variance before a job is marked late.",
				icon: "timer",
			},
			{
				title: "Status pages",
				description: "Show scheduled job health alongside your other services.",
				icon: "layout-template",
			},
		],
		steps: [
			{
				title: "Create a cron job monitor",
				description: "Enter its schedule as a standard cron expression.",
			},
			{
				title: "Add the ping call",
				description: "One line in your job pings the monitor's URL on completion.",
			},
			{
				title: "Get alerted when it's late",
				description: "Missed or late pings trigger an alert automatically.",
			},
		],
		faqs: [
			{
				question: "What counts as 'late' vs 'missed'?",
				answer:
					"A grace period after the expected run time marks the job late; missing that window too marks it missed.",
			},
			{
				question: "Do I need to authenticate the ping request?",
				answer:
					"No — the ping endpoint is public and rate-limited by design, so any job can report in with one line.",
			},
		],
	},

	healthcheck: {
		slug: "healthcheck",
		metaTitle: "Health Check Monitoring | Uptime",
		metaDescription:
			"Automated health checks for your services. Monitor endpoints, databases, and internal services with customizable intervals.",
		badge: "Health Checks",
		title: "Automate your",
		highlight: "health checks",
		description:
			"Automated health checks for your services. Monitor endpoints, databases, and internal services with customizable intervals.",
		highlights: ["1-60 min intervals", "Custom headers", "Any expected status"],
		/**
		 * These figures describe the check itself: a health endpoint reached over
		 * HTTP like any other monitor, not a Kubernetes or Docker orchestrator hook.
		 */
		trustIndicators: [
			{ icon: "heart-pulse", value: "/healthz", label: "Endpoints" },
			{ icon: "timer", value: "1-60m", label: "Intervals" },
			{ icon: "play", value: "Manual", label: "Trigger" },
			{ icon: "bell-ring", value: "Recovery", label: "Alerts" },
		],
		features: [
			{
				title: "Dedicated health endpoints",
				description: "Point a monitor at any `/healthz`-style route.",
				icon: "heart-pulse",
			},
			{
				title: "Flexible intervals",
				description: "Check as often as every minute, or as rarely as every hour.",
				icon: "timer",
			},
			{
				title: "Manual trigger",
				description: "Run any health check instantly to verify after a deploy.",
				icon: "play",
			},
			{
				title: "Recovery alerts",
				description: "Know the moment a service comes back healthy, not just when it fails.",
				icon: "bell-ring",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Can I monitor internal services?",
				answer:
					"Yes, as long as the service is reachable from the internet; add custom headers to authenticate requests.",
			},
			{
				question: "Can I test a monitor right after creating it?",
				answer: "Yes — a check runs automatically right after you create a monitor.",
			},
		],
	},

	ecommerce: {
		slug: "ecommerce",
		metaTitle: "E-commerce Monitoring | Uptime",
		metaDescription:
			"Protect your online store with uptime monitoring. Track checkout, payments, and product pages to prevent lost sales.",
		badge: "E-commerce",
		title: "Protect every sale",
		highlight: "from a silent outage",
		description:
			"Protect your online store with uptime monitoring. Track checkout, payments, and product pages to prevent lost sales.",
		highlights: ["Checkout monitoring", "Content checks", "Instant alerts"],
		trustIndicators: [
			{ icon: "shopping-cart", value: "Checkout", label: "Monitoring" },
			{ icon: "credit-card", value: "Payment", label: "APIs" },
			{ icon: "clock", value: "1min", label: "Min Interval" },
			{ icon: "dollar-sign", value: "Revenue", label: "Protected" },
		],
		features: [
			{
				title: "Checkout flow monitoring",
				description: "Watch the pages that directly convert to revenue most closely.",
				icon: "shopping-cart",
			},
			{
				title: "Content checks",
				description: "Verify a product page still shows an 'Add to cart' button, not an error.",
				icon: "search",
			},
			{
				title: "SSL monitoring",
				description: "An expired certificate on a checkout page is a lost-sale emergency.",
				icon: "shield-check",
			},
			{
				title: "Public status page",
				description: "Reassure customers during a rare incident instead of losing their trust.",
				icon: "layout-template",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Can I prioritize monitoring my checkout page?",
				answer:
					"Yes — set a shorter check interval and dedicated alerts for your highest-revenue pages.",
			},
			{
				question: "Will I know if checkout is broken but the homepage is fine?",
				answer:
					"Yes — each page gets its own monitor, so a checkout-specific failure alerts independently.",
			},
		],
	},

	saas: {
		slug: "saas",
		metaTitle: "SaaS Application Monitoring | Uptime",
		metaDescription:
			"Keep your SaaS product reliable with comprehensive monitoring. Track APIs, dashboards, and background jobs in one platform.",
		badge: "SaaS Monitoring",
		title: "Keep your SaaS product",
		highlight: "reliable",
		description:
			"Comprehensive monitoring for SaaS products: track APIs, dashboards, and background jobs in one platform.",
		highlights: ["API + web + cron", "Team collaboration", "Status pages for customers"],
		trustIndicators: [
			{ icon: "layers", value: "Multi", label: "Endpoint" },
			{ icon: "users", value: "Customer", label: "Facing" },
			{ icon: "shield-check", value: "99.9%", label: "Uptime Target" },
			{ icon: "trending-up", value: "Scales", label: "With You" },
		],
		features: [
			{
				title: "Full-stack coverage",
				description: "Monitor your marketing site, app, API, and background jobs together.",
				icon: "layers",
			},
			{
				title: "Team collaboration",
				description: "Invite your whole engineering team with role-based access.",
				icon: "users",
			},
			{
				title: "Customer-facing status page",
				description: "Turn reliability into a trust signal for your customers.",
				icon: "layout-template",
			},
			{
				title: "Alert routing",
				description: "Route critical API alerts to on-call, and lower-priority ones elsewhere.",
				icon: "route",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Can I monitor my background workers, not just the web app?",
				answer:
					"Yes — cron-job monitoring covers scheduled workers and background jobs alongside HTTP checks.",
			},
			{
				question: "Can customers see our uptime history?",
				answer: "Only if you choose to — status pages can be public or kept private.",
			},
		],
	},

	microservices: {
		slug: "microservices",
		metaTitle: "Microservices Monitoring | Uptime",
		metaDescription:
			"Monitor distributed systems and microservices architecture. Catch failures before they cascade across your infrastructure.",
		badge: "Microservices",
		title: "Catch failures",
		highlight: "before they cascade",
		description:
			"Monitor distributed systems and microservices architecture. Catch failures before they cascade across your infrastructure.",
		highlights: ["Per-service monitors", "TCP port checks", "DNS change detection"],
		trustIndicators: [
			{ icon: "boxes", value: "∞", valueLabel: "Unlimited", label: "Services" },
			{ icon: "network", value: "Distributed", label: "Architecture" },
			{ icon: "activity", value: "Per-service", label: "Health" },
			{ icon: "zap", value: "Fast", label: "Detection" },
		],
		features: [
			{
				title: "One monitor per service",
				description: "Isolate failures to the exact service that's down.",
				icon: "boxes",
			},
			{
				title: "TCP port monitoring",
				description: "Watch raw ports for services that don't speak HTTP.",
				icon: "network",
			},
			{
				title: "DNS monitoring",
				description: "Catch service-discovery DNS changes before they misroute traffic.",
				icon: "globe",
			},
			{
				title: "Independent alerting",
				description: "Scope alerts to a single service instead of the whole system.",
				icon: "route",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Can I monitor internal services that aren't public HTTP?",
				answer: "Yes — TCP monitors watch raw ports for internal or non-HTTP services.",
			},
			{
				question: "Will one failing service spam alerts for everything downstream?",
				answer: "No — each service has its own monitor and alert, so you see exactly what broke.",
			},
		],
	},
};

/** `/vs/:slug` comparison content, keyed by competitor slug. */
export const comparisons: Record<string, MarketingContent.ComparisonPage> = {
	uptimerobot: {
		slug: "uptimerobot",
		metaTitle: "Uptime vs UptimeRobot | Modern Usage-Based Monitoring",
		metaDescription:
			"Compare Uptime and UptimeRobot. See why teams choose transparent usage-based pricing over tiered plans with hidden limits.",
		badge: "Uptime vs UptimeRobot",
		title: "Uptime vs",
		highlight: "UptimeRobot",
		description:
			"Transparent usage-based pricing instead of tiered plans with hidden monitor and interval limits.",
		highlights: ["Usage-based pricing", "DNS + TCP + cron monitoring", "365-day retention"],
		competitor: "UptimeRobot",
		summary:
			"UptimeRobot's free and low tiers cap monitor count and check interval; Uptime charges for what you actually use and includes DNS, TCP, and cron-job monitoring in the same plan.",
		rows: [
			{
				label: "Pricing model",
				us: "Usage-based (pay per ping)",
				them: "Tiered plans with monitor caps",
			},
			{
				label: "Check interval",
				us: "1–60 minutes, any plan",
				them: "As low as 5 min on paid tiers only",
			},
			{ label: "DNS monitoring", us: "Included", them: "Not available" },
			{ label: "TCP monitoring", us: "Included", them: "Add-on on higher tiers" },
			{ label: "Cron job monitoring", us: "Included", them: "Not available" },
			{ label: "Data retention", us: "365 days", them: "Varies by plan" },
		],
		features: [
			{
				title: "No monitor caps",
				description: "Create as many monitors as you need; you pay for pings, not monitor slots.",
				icon: "dollar-sign",
			},
			{
				title: "All monitor types included",
				description: "HTTP, DNS, TCP, cron jobs, and SSL — one plan, not a tier ladder.",
				icon: "layers",
			},
			{
				title: "Signed webhooks",
				description: "HMAC-signed webhook alerts, not just a raw payload.",
				icon: "webhook",
			},
			{
				title: "Status pages included",
				description: "No separate status-page product or add-on fee.",
				icon: "layout-template",
			},
		],
		honestTake: [
			{
				title: "Their free tier is genuinely more generous",
				description:
					"UptimeRobot gives you 50 monitors at 5-minute intervals for free. Uptime's free tier only covers manual pings — automated checks need a subscription.",
			},
			{
				title: "Switching costs are real",
				description:
					"If your team has built runbooks and integrations around UptimeRobot, the savings on a small setup probably won't cover the migration work.",
			},
		],
		perfectFor: {
			title: "Perfect for teams tired of monitor-slot math",
			description:
				"If you keep bumping into monitor counts and interval limits rather than actual monitoring volume, usage-based pricing removes the tier decision entirely.",
			highlights: [
				"No monitor or interval caps",
				"DNS, TCP, and cron jobs included",
				"Unlimited team members included",
			],
		},
		pricingScenarios: [
			{
				scenario: "10 monitors at 30-min intervals",
				usage: { monitors: 10, intervalMinutes: 30 },
				theirCost: "$7/mo (Solo plan)",
				theirCostUsd: 7,
			},
			{
				scenario: "25 monitors at 60-min intervals",
				usage: { monitors: 25, intervalMinutes: 60 },
				theirCost: "$21/mo (Team plan)",
				theirCostUsd: 21,
			},
			{
				scenario: "50 monitors at 60-min intervals",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "$54/mo (Enterprise plan)",
				theirCostUsd: 54,
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Is Uptime cheaper than UptimeRobot?",
				answer:
					"It depends on usage — light users often pay less since there's no forced upgrade for monitor count or interval.",
			},
			{
				question: "Can I monitor DNS and TCP with Uptime?",
				answer:
					"Yes, both are included alongside HTTP and cron-job monitoring in the same account.",
			},
		],
	},

	"better-uptime": {
		slug: "better-uptime",
		metaTitle: "Uptime vs Better Uptime | Simpler Monitoring Alternative",
		metaDescription:
			"Compare Uptime and Better Uptime. Discover simpler pricing, powerful features, and why developers are switching.",
		badge: "Uptime vs Better Uptime",
		title: "Uptime vs",
		highlight: "Better Uptime",
		description:
			"Simpler, usage-based pricing without an incident-management upsell you may not need.",
		highlights: ["Usage-based pricing", "No incident-management upsell", "Focused feature set"],
		competitor: "Better Uptime",
		summary:
			"Better Uptime bundles on-call/incident management into its pricing; Uptime stays focused on monitoring, alerting, and status pages at a lower usage-based cost.",
		rows: [
			{ label: "Pricing model", us: "Usage-based (pay per ping)", them: "Per-seat + tiered plans" },
			{
				label: "Incident management / on-call",
				us: "Not included (use your own tool)",
				them: "Built in, priced accordingly",
			},
			{ label: "DNS monitoring", us: "Included", them: "Included on higher tiers" },
			{ label: "Cron job monitoring", us: "Included", them: "Included" },
			{ label: "Status pages", us: "Included", them: "Included on higher tiers" },
			{ label: "Data retention", us: "365 days", them: "Varies by plan" },
		],
		features: [
			{
				title: "Pay for what you use",
				description: "No per-seat pricing — cost scales with monitoring volume, not headcount.",
				icon: "dollar-sign",
			},
			{
				title: "Focused scope",
				description:
					"Monitoring and alerting done well, without an incident-management platform bundled in.",
				icon: "target",
			},
			{
				title: "Status pages included",
				description: "No separate tier required to publish a status page.",
				icon: "layout-template",
			},
			{
				title: "Signed webhooks",
				description: "HMAC-signed alerts for reliable webhook verification.",
				icon: "webhook",
			},
		],
		honestTake: [
			{
				title: "Their on-call scheduling is a real product; ours doesn't exist",
				description:
					"Better Uptime ships rotation schedules, escalation policies, and phone/SMS escalation. Uptime detects and notifies, and stops there.",
			},
			{
				title: "BetterStack is a platform, not just monitoring",
				description:
					"Logs, traces, and APM sit alongside monitoring in the same product. If you want one vendor for all of it, that consolidation has real value.",
			},
			{
				title: "Incident workflow is built in",
				description:
					"Acknowledging, assigning, and postmortem-ing an incident happens where the alert fires. With Uptime you'd wire that up in a separate tool.",
			},
		],
		perfectFor: {
			title: "Perfect for teams that already have their stack",
			description:
				"If you just need monitoring — not a full observability and incident-management platform — Uptime is the focused, affordable choice. Great for teams already running their own on-call tooling.",
			highlights: [
				"Works alongside your existing tools",
				"No per-seat pricing",
				"API-first design",
			],
		},
		pricingScenarios: [
			{
				scenario: "10 monitors at 30-min intervals",
				usage: { monitors: 10, intervalMinutes: 30 },
				theirCost: "$29/mo",
				theirCostUsd: 29,
			},
			{
				scenario: "25 monitors at 60-min intervals",
				usage: { monitors: 25, intervalMinutes: 60 },
				theirCost: "$29/mo",
				theirCostUsd: 29,
			},
			{
				scenario: "50 monitors at 60-min intervals",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "$29/mo",
				theirCostUsd: 29,
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Does Uptime include on-call scheduling?",
				answer:
					"No — Uptime focuses on detection and alerting; pair it with a dedicated on-call tool if you need escalation policies.",
			},
			{
				question: "Is Uptime priced per seat?",
				answer: "No — team members are unlimited; pricing is based on monitoring usage only.",
			},
		],
	},

	pingdom: {
		slug: "pingdom",
		metaTitle: "Uptime vs Pingdom | Affordable Monitoring Alternative",
		metaDescription:
			"Compare Uptime and Pingdom. Get powerful uptime monitoring without enterprise pricing. See features, pricing, and differences.",
		badge: "Uptime vs Pingdom",
		title: "Uptime vs",
		highlight: "Pingdom",
		description: "Powerful monitoring without enterprise-grade pricing for a small team's needs.",
		highlights: ["Usage-based pricing", "No enterprise contracts", "All monitor types included"],
		competitor: "Pingdom",
		summary:
			"Pingdom's pricing targets larger teams with real-user-monitoring add-ons; Uptime keeps a focused feature set at a price a small team can justify.",
		rows: [
			{
				label: "Pricing model",
				us: "Usage-based (pay per ping)",
				them: "Tiered, enterprise-oriented plans",
			},
			{ label: "DNS monitoring", us: "Included", them: "Not a core feature" },
			{ label: "TCP monitoring", us: "Included", them: "Included" },
			{ label: "Cron job monitoring", us: "Included", them: "Not available" },
			{ label: "Real user monitoring", us: "Not included", them: "Available as an add-on" },
			{ label: "Data retention", us: "365 days", them: "Varies by plan" },
		],
		features: [
			{
				title: "Right-sized pricing",
				description: "Pay for your actual ping volume instead of an enterprise-tier minimum.",
				icon: "dollar-sign",
			},
			{
				title: "All-in-one monitor types",
				description: "HTTP, DNS, TCP, SSL, and cron jobs in a single account.",
				icon: "layers",
			},
			{
				title: "Simple setup",
				description: "Create a monitor and get your first result in under a minute.",
				icon: "rocket",
			},
			{
				title: "Status pages included",
				description: "No separate purchase required.",
				icon: "layout-template",
			},
		],
		honestTake: [
			{
				title: "Real user monitoring is something we simply don't do",
				description:
					"Pingdom measures what your actual visitors experience in their own browsers. Uptime only runs synthetic checks from its own regions.",
			},
			{
				title: "100+ probe locations versus our 9",
				description:
					"If you need per-country latency data or genuinely global coverage, Pingdom's probe network is far denser than ours.",
			},
			{
				title: "Transaction monitoring covers flows we can't",
				description:
					"Multi-step scripted checks — log in, add to cart, complete checkout — are a Pingdom feature. Uptime checks one request at a time.",
			},
		],
		perfectFor: {
			title: "Perfect for small teams priced out of enterprise monitoring",
			description:
				"If you need dependable uptime checks but can't justify an enterprise monitoring contract, usage-based pricing scales down as far as your actual volume goes.",
			highlights: [
				"No enterprise tier minimum",
				"Status pages at no extra cost",
				"Unlimited team members included",
			],
		},
		pricingScenarios: [
			{
				scenario: "10 monitors at 30-min intervals",
				usage: { monitors: 10, intervalMinutes: 30 },
				theirCost: "$15/mo",
				theirCostUsd: 15,
			},
			{
				scenario: "25 monitors at 60-min intervals",
				usage: { monitors: 25, intervalMinutes: 60 },
				theirCost: "$29/mo",
				theirCostUsd: 29,
			},
			{
				scenario: "50 monitors at 60-min intervals",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "$89/mo",
				theirCostUsd: 89,
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Does Uptime include real-user monitoring (RUM)?",
				answer:
					"No — Uptime focuses on synthetic uptime and health checks, not in-browser real-user analytics.",
			},
			{
				question: "Is Uptime a good fit for a small team?",
				answer:
					"Yes — usage-based pricing scales down as well as up, unlike enterprise-minimum plans.",
			},
		],
	},

	statuscake: {
		slug: "statuscake",
		metaTitle: "Uptime vs StatusCake | Modern Monitoring Comparison",
		metaDescription:
			"Compare Uptime and StatusCake. Modern interface, transparent pricing, and all the features you need without the complexity.",
		badge: "Uptime vs StatusCake",
		title: "Uptime vs",
		highlight: "StatusCake",
		description:
			"A modern interface and transparent pricing without the older, complexity-heavy plan structure.",
		highlights: ["Usage-based pricing", "Modern dashboard", "Cron job monitoring"],
		competitor: "StatusCake",
		summary:
			"StatusCake's plans separate features (SSL, page speed, domain monitoring) across tiers; Uptime keeps the core monitoring feature set together in one usage-based plan.",
		rows: [
			{
				label: "Pricing model",
				us: "Usage-based (pay per ping)",
				them: "Tiered plans by feature bundle",
			},
			{ label: "SSL monitoring", us: "Included", them: "Included on paid tiers" },
			{ label: "DNS monitoring", us: "Included", them: "Not a core feature" },
			{ label: "Cron job monitoring", us: "Included", them: "Not available" },
			{ label: "Status pages", us: "Included", them: "Included on paid tiers" },
			{ label: "Data retention", us: "365 days", them: "Varies by plan" },
		],
		features: [
			{
				title: "One plan, every feature",
				description: "SSL, DNS, TCP, and cron-job monitoring aren't gated behind a higher tier.",
				icon: "layers",
			},
			{
				title: "Modern, minimal UI",
				description:
					"A dashboard built around uptime history and stat cards, not dense legacy tables.",
				icon: "sparkles",
			},
			{
				title: "Usage-based pricing",
				description: "Pay for the pings you actually run, not a feature-bundle tier.",
				icon: "dollar-sign",
			},
			{
				title: "Signed webhooks",
				description: "HMAC-signed webhook alerts out of the box.",
				icon: "webhook",
			},
		],
		honestTake: [
			{
				title: "Page speed monitoring is theirs, not ours",
				description:
					"StatusCake tracks load times and performance metrics over time. Uptime records response time for a check and nothing more.",
			},
			{
				title: "They monitor servers, we monitor endpoints",
				description:
					"CPU, memory, and disk monitoring on your own boxes is a StatusCake feature. Uptime never runs an agent, so it can't see inside a host.",
			},
			{
				title: "A denser interface suits some teams better",
				description:
					"StatusCake's feature-rich, traditional UI puts more on screen at once. If you'd rather have density than minimalism, that's a genuine preference, not a flaw.",
			},
		],
		perfectFor: {
			title: "Perfect for teams that want a modern monitoring dashboard",
			description:
				"If you'd rather read an uptime bar than a table of rows, and you don't want to work out which feature bundle you need, Uptime keeps the whole monitoring feature set on one plan.",
			highlights: [
				"Every monitor type on one plan",
				"365-day retention included",
				"Unlimited team members included",
			],
		},
		pricingScenarios: [
			{
				scenario: "10 monitors at 30-min intervals",
				usage: { monitors: 10, intervalMinutes: 30 },
				theirCost: "$20/mo",
				theirCostUsd: 20,
			},
			{
				scenario: "25 monitors at 60-min intervals",
				usage: { monitors: 25, intervalMinutes: 60 },
				theirCost: "$20/mo",
				theirCostUsd: 20,
			},
			{
				scenario: "50 monitors at 60-min intervals",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "$66/mo",
				theirCostUsd: 66,
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Do I need a higher tier for SSL or DNS monitoring?",
				answer: "No — every monitor type is available on the same usage-based plan.",
			},
		],
	},

	datadog: {
		slug: "datadog",
		metaTitle: "Uptime vs Datadog | Simple Uptime Monitoring Alternative",
		metaDescription:
			"Compare Uptime and Datadog for uptime monitoring. Get focused monitoring without the complexity of a full observability platform.",
		badge: "Uptime vs Datadog",
		title: "Uptime vs",
		highlight: "Datadog",
		description:
			"Focused uptime and synthetic monitoring, without adopting a full observability platform just to watch a few endpoints.",
		highlights: ["Focused scope", "Simple pricing", "Minutes to set up"],
		competitor: "Datadog",
		summary:
			"Datadog is a full observability platform (metrics, logs, traces, APM) with synthetic monitoring as one module among many; Uptime does one thing — uptime and health monitoring — simply and cheaply.",
		rows: [
			{
				label: "Product scope",
				us: "Focused uptime & health monitoring",
				them: "Full observability platform",
			},
			{
				label: "Pricing model",
				us: "Usage-based (pay per ping)",
				them: "Per-host + per-check, complex billing",
			},
			{ label: "Setup time", us: "Minutes", them: "Often requires an agent + configuration" },
			{ label: "Cron job monitoring", us: "Included", them: "Available via a separate product" },
			{ label: "Status pages", us: "Included", them: "Not a core feature" },
			{ label: "Learning curve", us: "Minimal", them: "Significant for full platform" },
		],
		features: [
			{
				title: "No agent required",
				description: "Point a monitor at a URL, port, or domain — nothing to install.",
				icon: "plug",
			},
			{
				title: "Predictable billing",
				description: "One base price plus a clear per-ping rate, not a complex usage matrix.",
				icon: "dollar-sign",
			},
			{
				title: "Fast time-to-value",
				description: "See your first check result within a minute of creating a monitor.",
				icon: "rocket",
			},
			{
				title: "Status pages included",
				description: "No separate observability suite purchase required.",
				icon: "layout-template",
			},
		],
		honestTake: [
			{
				title: "APM, logs, and traces are a different product class",
				description:
					"Datadog correlates a slow request with the trace and log lines behind it. Uptime does no tracing, no log ingestion, and no code-level instrumentation.",
			},
			{
				title: "Their synthetics do browser and multi-step API tests",
				description:
					"Datadog Synthetic Monitoring scripts real browser sessions and chains API calls together. Uptime checks a single HTTP request per monitor.",
			},
			{
				title: "If you're already paying for Datadog, adding synthetics is simpler",
				description:
					"One vendor, one bill, one alerting pipeline is worth something. Bolting a second tool on for uptime checks may not be worth the savings.",
			},
		],
		perfectFor: {
			title: "Perfect for teams that already have their observability stack",
			description:
				"If you already use Datadog, Grafana, or similar tools for APM and logs, Uptime is the focused, affordable choice for uptime monitoring. No need to pay for features you won't use.",
			highlights: [
				"Works alongside existing tools",
				"No vendor lock-in",
				"Unlimited team members included",
			],
		},
		pricingScenarios: [
			{
				scenario: "10 monitors at 30-min intervals",
				usage: { monitors: 10, intervalMinutes: 30 },
				theirCost: "~$50/mo",
				theirCostUsd: 50,
			},
			{
				scenario: "25 monitors at 60-min intervals",
				usage: { monitors: 25, intervalMinutes: 60 },
				theirCost: "~$60/mo",
				theirCostUsd: 60,
			},
			{
				scenario: "50 monitors at 60-min intervals",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "~$100/mo",
				theirCostUsd: 100,
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Is Uptime a Datadog replacement?",
				answer:
					"Not for full observability — Uptime is a focused alternative if you only need uptime and health monitoring.",
			},
			{
				question: "Does Uptime need an agent installed?",
				answer:
					"No — checks run entirely from Uptime's own infrastructure against your public endpoints.",
			},
		],
	},

	site24x7: {
		slug: "site24x7",
		metaTitle: "Uptime vs Site24x7 | Simple Uptime Monitoring Alternative",
		metaDescription:
			"Compare Uptime and Site24x7 for uptime monitoring. Get transparent, usage-based pricing instead of complex tiered plans. See features, pricing, and find out which is right for you.",
		badge: "Uptime vs Site24x7",
		title: "Uptime vs",
		highlight: "Site24x7",
		description: "Transparent, usage-based pricing instead of a complex tiered-plan matrix.",
		highlights: ["Usage-based pricing", "Simple setup", "All monitor types included"],
		competitor: "Site24x7",
		summary:
			"Site24x7 bundles infrastructure, network, and application monitoring into tiered plans built for larger IT teams; Uptime stays a focused, simply-priced monitoring tool.",
		rows: [
			{
				label: "Pricing model",
				us: "Usage-based (pay per ping)",
				them: "Tiered plans by monitor/resource count",
			},
			{
				label: "Product scope",
				us: "Focused uptime monitoring",
				them: "Broad IT infrastructure monitoring suite",
			},
			{ label: "Setup complexity", us: "Minutes", them: "Higher, suited to IT teams" },
			{ label: "Cron job monitoring", us: "Included", them: "Not a core feature" },
			{ label: "Status pages", us: "Included", them: "Included on higher tiers" },
			{ label: "Data retention", us: "365 days", them: "Varies by plan" },
		],
		features: [
			{
				title: "Simple pricing",
				description: "One base fee plus per-ping cost, not a resource-count tier matrix.",
				icon: "dollar-sign",
			},
			{
				title: "Fast setup",
				description: "No agents or infrastructure discovery — just add a URL.",
				icon: "rocket",
			},
			{
				title: "All monitor types included",
				description: "HTTP, DNS, TCP, SSL, and cron jobs in every plan.",
				icon: "layers",
			},
			{
				title: "Status pages included",
				description: "No separate purchase required.",
				icon: "layout-template",
			},
		],
		honestTake: [
			{
				title: "Server, cloud, and network monitoring are theirs alone",
				description:
					"Site24x7 watches hosts, VMs, containers, routers, and switches from the inside. Uptime has no agent and sees only what a public endpoint returns.",
			},
			{
				title: "APM and log management come in the same suite",
				description:
					"If you want application traces and log search next to your uptime checks, Site24x7's all-in-one approach genuinely saves you a vendor.",
			},
			{
				title: "120+ monitoring locations versus our 9",
				description:
					"For a heavily geo-distributed application that needs per-region latency detail, their location count is a real advantage.",
			},
		],
		perfectFor: {
			title: "Perfect for teams that want focused uptime monitoring",
			description:
				"If you don't need server monitoring, APM, or log management, why pay for them? Uptime gives you everything for uptime monitoring without the bloat.",
			highlights: ["All features included", "Unlimited team members", "No complex tier decisions"],
		},
		pricingScenarios: [
			{
				scenario: "10 monitors at 30-min intervals",
				usage: { monitors: 10, intervalMinutes: 30 },
				theirCost: "$9/mo",
				theirCostUsd: 9,
			},
			{
				scenario: "25 monitors at 60-min intervals",
				usage: { monitors: 25, intervalMinutes: 60 },
				theirCost: "$42/mo",
				theirCostUsd: 42,
			},
			{
				scenario: "50 monitors at 60-min intervals",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "$89/mo",
				theirCostUsd: 89,
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Is Uptime meant for enterprise IT infrastructure monitoring?",
				answer:
					"No — Uptime focuses on external uptime and health checks, not full IT infrastructure monitoring.",
			},
		],
	},

	checkly: {
		slug: "checkly",
		metaTitle: "Uptime vs Checkly | Simple Uptime Monitoring Without the Code",
		metaDescription:
			"Compare Uptime and Checkly side by side. Simple uptime monitoring without the code. See features, pricing, and find out which is right for you.",
		badge: "Uptime vs Checkly",
		title: "Uptime vs",
		highlight: "Checkly",
		description:
			"No-code monitor setup for teams who want uptime checks without writing and maintaining test scripts.",
		highlights: ["No code required", "DNS + TCP monitoring", "Usage-based pricing"],
		competitor: "Checkly",
		summary:
			"Checkly is built around code-based synthetic tests (Playwright scripts) for deep browser checks; Uptime is a no-code alternative for teams who just need reliable HTTP/DNS/TCP/cron monitoring.",
		rows: [
			{ label: "Setup style", us: "No-code form", them: "Code-based (Playwright scripts)" },
			{ label: "Pricing model", us: "Usage-based (pay per ping)", them: "Per-check-run pricing" },
			{ label: "DNS monitoring", us: "Included", them: "Not a core feature" },
			{ label: "Cron job monitoring", us: "Included", them: "Not available" },
			{ label: "Browser-based checks", us: "Not included", them: "Included" },
			{ label: "Status pages", us: "Included", them: "Included" },
		],
		features: [
			{
				title: "No-code setup",
				description: "Create a monitor by filling in a form, not writing and maintaining a script.",
				icon: "mouse-pointer-click",
			},
			{
				title: "DNS & cron job monitoring",
				description: "Covers monitor types outside Checkly's browser-test focus.",
				icon: "globe",
			},
			{
				title: "Fast to configure",
				description: "No test runner or scripting language to learn.",
				icon: "zap",
			},
			{
				title: "Predictable pricing",
				description: "Pay per ping, not per script execution.",
				icon: "dollar-sign",
			},
		],
		honestTake: [
			{
				title: "Playwright browser testing is what Checkly is for",
				description:
					"Testing a login, a form submission, or a checkout as a real browser session is their core product. Uptime cannot do it at all.",
			},
			{
				title: "Monitoring-as-code is a genuinely better model for some teams",
				description:
					"Checkly monitors live in your repo, get reviewed in pull requests, and deploy with your app. Uptime's monitors are configured in a dashboard and through its API.",
			},
			{
				title: "Multi-step API checks chain requests together",
				description:
					"Checkly can call an endpoint, extract a token, and use it in the next request. Uptime checks one request per monitor.",
			},
			{
				title: "First-class Terraform and Pulumi providers",
				description:
					"If your infrastructure is already declared as code, Checkly drops straight into that workflow. Uptime offers a REST API and nothing more.",
			},
		],
		perfectFor: {
			title: "Perfect for teams that don't want to maintain test scripts",
			description:
				"If nobody on the team wants to own a Playwright suite just to know whether the site is up, a form-configured monitor gets you the same alert with nothing to maintain.",
			highlights: [
				"No DSL or test runner to learn",
				"DNS, TCP, and cron jobs included",
				"Unlimited team members included",
			],
		},
		pricingScenarios: [
			{
				scenario: "10 monitors at 30-min intervals",
				usage: { monitors: 10, intervalMinutes: 30 },
				theirCost: "$24/mo",
				theirCostUsd: 24,
			},
			{
				scenario: "25 monitors at 60-min intervals",
				usage: { monitors: 25, intervalMinutes: 60 },
				theirCost: "$24/mo",
				theirCostUsd: 24,
			},
			{
				scenario: "50 monitors at 60-min intervals",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "$45/mo",
				theirCostUsd: 45,
			},
			{
				scenario: "Team of 5 people",
				ourCost: "$0 extra",
				theirCost: "+$60/mo seats",
				savingsNote: "No seat pricing",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Does Uptime support full browser-based synthetic tests?",
				answer:
					"No — Uptime focuses on HTTP/DNS/TCP/cron-job health checks rather than scripted browser flows.",
			},
			{
				question: "Do I need to write any code to use Uptime?",
				answer: "No — every monitor is configured through a simple form.",
			},
		],
	},

	ohdear: {
		slug: "ohdear",
		metaTitle: "Uptime vs Oh Dear | Developer-Focused Monitoring Comparison",
		metaDescription:
			"Compare Uptime and Oh Dear for uptime monitoring. Both are developer-focused tools - see how usage-based pricing compares to per-site pricing, and find which is right for you.",
		badge: "Uptime vs Oh Dear",
		title: "Uptime vs",
		highlight: "Oh Dear",
		description:
			"Usage-based pricing and framework-agnostic monitoring, compared to per-site pricing tuned for PHP/Laravel apps.",
		highlights: ["Usage-based pricing", "Framework-agnostic", "Cron job monitoring"],
		competitor: "Oh Dear",
		summary:
			"Oh Dear is well-loved in the PHP/Laravel ecosystem with per-site pricing; Uptime is framework-agnostic and priced by usage instead of site count.",
		rows: [
			{ label: "Pricing model", us: "Usage-based (pay per ping)", them: "Per-site pricing" },
			{
				label: "Framework focus",
				us: "Framework-agnostic",
				them: "Strong PHP/Laravel integration",
			},
			{ label: "DNS monitoring", us: "Included", them: "Included" },
			{ label: "Cron job monitoring", us: "Included", them: "Included (via scheduler pings)" },
			{ label: "TCP monitoring", us: "Included", them: "Not a core feature" },
			{ label: "Status pages", us: "Included", them: "Included" },
		],
		features: [
			{
				title: "Framework-agnostic",
				description: "Works the same for any stack — no PHP/Laravel-specific integration needed.",
				icon: "blocks",
			},
			{
				title: "Usage-based pricing",
				description: "Cost scales with ping volume, not the number of sites you monitor.",
				icon: "dollar-sign",
			},
			{
				title: "TCP monitoring",
				description: "Watch raw ports, not just HTTP endpoints.",
				icon: "network",
			},
			{
				title: "Signed webhooks",
				description: "HMAC-signed alerts for any webhook integration.",
				icon: "webhook",
			},
		],
		/**
		 * Cron-job monitoring is a first-class Uptime feature, so it's absent from
		 * this list of where Oh Dear genuinely wins.
		 */
		honestTake: [
			{
				title: "They crawl your whole site for broken links",
				description:
					"Oh Dear walks every page looking for dead links and mixed content. Uptime checks the endpoints you point it at and never crawls.",
			},
			{
				title: "Automated Lighthouse performance audits",
				description:
					"Oh Dear scores your pages on a schedule and tracks the trend. Uptime records response time and nothing else about page quality.",
			},
			{
				title: "The Laravel ecosystem fit is real",
				description:
					"Oh Dear is built by Spatie, and if your team already lives in their packages, that integration and shared idiom is worth something Uptime can't match.",
			},
		],
		perfectFor: {
			title: "Perfect for teams that want flexible pricing",
			description:
				"If you'd rather pay for actual usage than for site slots, Uptime's model scales better. Ideal for teams with many monitors at longer intervals or variable monitoring needs.",
			highlights: [
				"365 days data retention",
				"9 global monitoring regions",
				"Native Discord integration",
			],
		},
		pricingScenarios: [
			{
				scenario: "5 monitors at 30-min intervals",
				usage: { monitors: 5, intervalMinutes: 30 },
				theirCost: "€15/mo (~$16)",
				theirCostUsd: 16,
			},
			{
				scenario: "20 monitors at 60-min intervals",
				usage: { monitors: 20, intervalMinutes: 60 },
				theirCost: "€29/mo (~$31)",
				theirCostUsd: 31,
			},
			{
				scenario: "50 monitors at 60-min intervals",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "€79/mo (~$85)",
				theirCostUsd: 85,
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Do I need a Laravel app to use Uptime?",
				answer:
					"No — Uptime is framework-agnostic and monitors any HTTP endpoint, domain, TCP port, or cron job.",
			},
		],
	},

	cronitor: {
		slug: "cronitor",
		metaTitle: "Uptime vs Cronitor | Simpler Monitoring, Better Pricing",
		metaDescription:
			"Compare Uptime and Cronitor. Discover why teams choose Uptime for simpler pricing, DNS/TCP monitoring, and a focused approach without feature bloat.",
		badge: "Uptime vs Cronitor",
		title: "Uptime vs",
		highlight: "Cronitor",
		description: "Simpler pricing and broader monitor-type coverage in one focused product.",
		highlights: ["Usage-based pricing", "DNS + TCP monitoring", "Status pages included"],
		competitor: "Cronitor",
		summary:
			"Cronitor's strength is heartbeat/cron monitoring with add-on HTTP checks; Uptime treats HTTP, DNS, TCP, SSL, and cron monitoring as equal first-class citizens under one usage-based price.",
		rows: [
			{
				label: "Pricing model",
				us: "Usage-based (pay per ping)",
				them: "Tiered plans by monitor count",
			},
			{ label: "Cron job monitoring", us: "Included", them: "Included (core strength)" },
			{ label: "DNS monitoring", us: "Included", them: "Not a core feature" },
			{ label: "TCP monitoring", us: "Included", them: "Not a core feature" },
			{ label: "SSL monitoring", us: "Included", them: "Included" },
			{ label: "Status pages", us: "Included", them: "Included on higher tiers" },
		],
		features: [
			{
				title: "Broader monitor coverage",
				description: "DNS and TCP monitoring alongside cron jobs and HTTP checks.",
				icon: "network",
			},
			{
				title: "Usage-based pricing",
				description: "Pay for pings, not a monitor-count tier.",
				icon: "dollar-sign",
			},
			{
				title: "Status pages included",
				description: "No higher tier required to publish one.",
				icon: "layout-template",
			},
			{
				title: "Simple grace periods",
				description: "Absorb normal cron-timing variance before alerting.",
				icon: "timer",
			},
		],
		honestTake: [
			{
				title: "They offer real user monitoring; we don't",
				description:
					"Cronitor can report what your actual visitors experienced. Uptime only knows what its own synthetic checks saw.",
			},
			{
				title: "Their browser checks execute JavaScript",
				description:
					"Cronitor can load a page in a real browser and assert on the rendered result. Uptime reads the raw HTTP response, so a client-rendered failure can slip past a status-code check.",
			},
			{
				title: "Error tracking lives in the same product",
				description:
					"If you want exceptions and uptime in one place, Cronitor bundles them. Uptime has no error tracking at all.",
			},
		],
		perfectFor: {
			title: "Perfect for teams that want monitoring without the bloat",
			description:
				"If you already have observability tools and just need reliable, focused monitoring, Uptime delivers exactly that. No upsells to features you don't need.",
			highlights: [
				"DNS and TCP monitoring included",
				"Simple usage-based pricing",
				"Works alongside your existing stack",
			],
		},
		pricingScenarios: [
			{
				scenario: "Basic monitoring (20 monitors)",
				usage: { monitors: 20, intervalMinutes: 60 },
				theirCost: "$20/mo (Starter)",
				theirCostUsd: 20,
			},
			{
				scenario: "Growing team (50 monitors)",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "$49/mo+ (Pro)",
				theirCostUsd: 49,
			},
			{
				scenario: "Full monitoring suite",
				usage: { monitors: 100, intervalMinutes: 30 },
				theirCost: "$99/mo+ (Business)",
				theirCostUsd: 99,
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Is Uptime as good as Cronitor for cron monitoring specifically?",
				answer:
					"Yes — cron-aware scheduling, grace periods, and a public ping endpoint cover the same core workflow.",
			},
		],
	},

	healthchecks: {
		slug: "healthchecks",
		metaTitle: "Uptime vs Healthchecks.io | Complete Monitoring Solution",
		metaDescription:
			"Compare Uptime and Healthchecks.io. See why teams choose Uptime for complete monitoring with HTTP, DNS, TCP, SSL, and cron job monitoring in one platform.",
		badge: "Uptime vs Healthchecks.io",
		title: "Uptime vs",
		highlight: "Healthchecks.io",
		description:
			"One platform for cron jobs and everything else — HTTP, DNS, TCP, and SSL monitoring included.",
		highlights: ["Cron + HTTP + DNS + TCP + SSL", "Usage-based pricing", "Status pages included"],
		competitor: "Healthchecks.io",
		summary:
			"Healthchecks.io is purpose-built for cron/heartbeat monitoring only; Uptime covers the same cron-job workflow plus HTTP, DNS, TCP, and SSL monitoring in one account.",
		rows: [
			{ label: "Cron job monitoring", us: "Included", them: "Included (core focus)" },
			{ label: "HTTP monitoring", us: "Included", them: "Not available" },
			{ label: "DNS monitoring", us: "Included", them: "Not available" },
			{ label: "TCP monitoring", us: "Included", them: "Not available" },
			{ label: "SSL monitoring", us: "Included", them: "Not available" },
			{ label: "Status pages", us: "Included", them: "Included" },
		],
		features: [
			{
				title: "One platform, every monitor type",
				description: "Don't run a separate tool for website and API monitoring.",
				icon: "layers",
			},
			{
				title: "Same simple ping workflow",
				description: "A public ping URL for cron jobs, just like Healthchecks.io.",
				icon: "radio-tower",
			},
			{
				title: "Grace periods",
				description: "Absorb normal timing variance before marking a job late.",
				icon: "timer",
			},
			{
				title: "Usage-based pricing",
				description: "One predictable pricing model across every monitor type.",
				icon: "dollar-sign",
			},
		],
		honestTake: [
			{
				title: "Their free tier beats ours outright",
				description:
					"Healthchecks.io monitors 20 checks free with no credit card. Uptime's free tier only covers manual pings, so automated cron monitoring needs a subscription.",
			},
			{
				title: "If cron is all you'll ever need, their focus is the point",
				description:
					"Healthchecks.io does one job extremely well and nothing else gets in the way. Paying for monitor types you won't use is a bad trade.",
			},
			{
				title: "Status badges come out of the box",
				description:
					"If a badge in a README or an internal doc is all the status reporting you need, Healthchecks.io gives you that without configuring a status page.",
			},
		],
		perfectFor: {
			title: "Perfect for teams that need more than cron monitoring",
			description:
				"If your infrastructure includes APIs, websites, and background jobs, why use separate tools? Uptime brings everything together with native integrations and status pages.",
			highlights: [
				"Single dashboard for all monitor types",
				"Native Slack and Discord integrations",
				"Status pages included",
			],
		},
		pricingScenarios: [
			{
				scenario: "50 cron monitors",
				usage: { monitors: 50, intervalMinutes: 60 },
				theirCost: "Free (under 20) / $20/mo",
				savingsNote: "Full monitoring suite included",
			},
			{
				scenario: "100 monitors total",
				usage: { monitors: 100, intervalMinutes: 60 },
				theirCost: "$20/mo (cron only)",
				theirCostUsd: 20,
				savingsNote: "HTTP + DNS + SSL included",
			},
			{
				scenario: "Mixed monitoring needs",
				usage: { monitors: 100, intervalMinutes: 60 },
				theirCost: "$20/mo + separate tool",
				savingsNote: "Single platform, no tool sprawl",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "If I only need cron monitoring today, is Uptime still worth it?",
				answer:
					"Yes if you expect to add website or API monitoring later — it's the same account and pricing model.",
			},
		],
	},
};
