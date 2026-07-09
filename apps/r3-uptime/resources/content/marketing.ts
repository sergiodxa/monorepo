/**
 * Static content for the public marketing site: the 12 `/features/:slug`, 6
 * `/for/:slug`, 7 `/use-cases/:slug`, and 10 `/vs/:slug` pages. Each record supplies
 * the copy a shared page template (`resources/views/marketing/*`) renders, so the 35
 * near-identical marketing routes are data plus one template per page family instead
 * of 35 bespoke view files. Meta titles/descriptions are carried over verbatim from
 * the OLD APP's `app/locales/en.ts` `landing.*.meta` keys; supporting copy (feature
 * bullets, steps, FAQs, comparison rows) is written fresh to the same structure and
 * intent as the OLD APP's per-page components.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export namespace MarketingContent {
	/** One bullet in a feature grid. */
	export interface Feature {
		title: string;
		description: string;
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
	}

	/** `/vs/:slug` comparison page content, extending {@link Page} with a table. */
	export interface ComparisonPage extends Page {
		competitor: string;
		summary: string;
		rows: ComparisonRow[];
	}
}

const DEFAULT_STEPS: MarketingContent.Step[] = [
	{
		title: "Create your monitor",
		description: "Point Uptime at the URL, DNS record, port, or scheduled job you want to track.",
	},
	{
		title: "Choose how you're alerted",
		description:
			"Connect email, Slack, Discord, or a webhook. Set cooldowns to avoid alert fatigue.",
	},
	{
		title: "Watch the dashboard",
		description:
			"See heatmaps, response times, and uptime history update as checks run automatically.",
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
		features: [
			{
				title: "Global coverage",
				description:
					"Monitor from Africa, APAC, Eastern/Western Europe, the Middle East, Oceania, and the Americas.",
			},
			{
				title: "Flexible intervals",
				description:
					"Check every minute for critical services, or every hour for less urgent endpoints.",
			},
			{
				title: "Status code validation",
				description:
					"Expect any HTTP status code — 200, 201, 301, 404 — whatever is correct for you.",
			},
			{
				title: "Instant results",
				description: "Run any monitor on demand to test immediately after changes.",
			},
			{
				title: "Heatmap visualization",
				description: "See service health at a glance with daily heatmaps showing success rates.",
			},
			{
				title: "365-day history",
				description:
					"Access a full year of monitoring data for trend analysis and incident review.",
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
			"Instant email and webhook alerts for downtime detection. Under 1 second delivery. Integrates with Slack, Discord, PagerDuty, and more.",
		badge: "Alerts",
		title: "Get notified the moment something",
		highlight: "breaks",
		description:
			"Instant email, Slack, Discord, and webhook alerts for downtime detection, with recovery notifications and configurable cooldowns.",
		highlights: ["Under 1s delivery", "4 alert channels", "Recovery notifications"],
		features: [
			{
				title: "Email alerts",
				description: "Send downtime and recovery notifications to any address.",
			},
			{
				title: "Slack & Discord",
				description:
					"Native webhook integrations post rich, readable alerts directly to your channels.",
			},
			{
				title: "Generic webhooks",
				description: "Send signed JSON payloads to any endpoint, with an HMAC signature header.",
			},
			{
				title: "Recovery alerts",
				description: "Get notified when a service comes back up, including downtime duration.",
			},
			{
				title: "Alert cooldowns",
				description:
					"Set a minimum time between repeat alerts so an ongoing outage doesn't flood your inbox.",
			},
			{
				title: "Team or monitor scoped",
				description: "Route some alerts to the whole team and others to a single critical monitor.",
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
		highlights: ["Custom branding", "365-day heatmaps", "Public or private"],
		features: [
			{
				title: "Overall status banner",
				description: "A single glance shows operational, degraded, or down.",
			},
			{
				title: "Any monitor type",
				description: "Attach HTTP, DNS, TCP, and cron-job monitors to the same page.",
			},
			{
				title: "Your branding",
				description: "Add a logo, title, and description that match your product.",
			},
			{
				title: "Uptime heatmaps",
				description:
					"Each service shows a 365-day heatmap so visitors can see historical reliability.",
			},
			{
				title: "Public or private",
				description: "Publish pages for customers, or keep them private for internal use only.",
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
				answer: "Yes, it reflects each attached monitor's latest status and historical heatmap.",
			},
		],
	},

	analytics: {
		slug: "analytics",
		metaTitle: "Uptime Analytics | Heatmaps & Trends",
		metaDescription:
			"Visual heatmaps, response time tracking, and 365-day data retention. Understand your service reliability at a glance.",
		badge: "Analytics",
		title: "Understand your reliability",
		highlight: "at a glance",
		description:
			"Visual heatmaps, response time tracking, and 365 days of retained data across every monitor type.",
		highlights: ["365-day retention", "Daily heatmaps", "P99 response time"],
		features: [
			{
				title: "Calendar heatmaps",
				description: "See a full year of daily uptime at a glance, per monitor.",
			},
			{
				title: "Response time tracking",
				description: "Track average and P99 latency to catch slow-but-not-down degradation.",
			},
			{
				title: "Dashboard stats",
				description:
					"Uptime percentage, ping usage, and slowest endpoint surfaced on your dashboard.",
			},
			{
				title: "Per-type breakdowns",
				description:
					"HTTP, DNS, TCP, and cron-job monitors each get their own aggregated daily stats.",
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
				answer: "Yes — daily heatmaps and stored history give you a full year of reliability data.",
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
		features: [
			{
				title: "Invite anyone",
				description: "Send an email invite; the recipient joins with one click.",
			},
			{
				title: "Role-based access",
				description:
					"Owners and Admins manage settings, billing, and members; Members focus on monitoring.",
			},
			{
				title: "Domain auto-provisioning",
				description: "Verify a company domain so anyone with a matching email joins automatically.",
			},
			{
				title: "Shared visibility",
				description: "Every team member sees the same monitors, alerts, and status pages.",
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
		features: [
			{
				title: "Scoped API keys",
				description: "Issue keys with only the permissions each integration needs.",
			},
			{
				title: "Full resource coverage",
				description:
					"Monitors, DNS/TCP monitors, alerts, maintenance windows, status pages, and more.",
			},
			{
				title: "Cron-job ping endpoint",
				description: "A dedicated public endpoint your scheduled jobs call to report a heartbeat.",
			},
			{
				title: "Predictable errors",
				description:
					"Consistent error codes and rate limits so client integrations are easy to write.",
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
		features: [
			{
				title: "Slack",
				description: "Native Incoming Webhook support with rich, readable alert formatting.",
			},
			{ title: "Discord", description: "Post alerts straight to a Discord channel via webhook." },
			{
				title: "Custom webhooks",
				description:
					"Send signed JSON payloads to any endpoint — PagerDuty, Opsgenie, or your own service.",
			},
			{
				title: "Email",
				description: "The simplest integration: alerts land straight in an inbox.",
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
		features: [
			{
				title: "Scheduled suppression",
				description: "Alerts are automatically suppressed for the window's duration.",
			},
			{
				title: "Recurring windows",
				description: "Set a weekly deploy window once instead of every time.",
			},
			{
				title: "End early",
				description:
					"Finished ahead of schedule? End the window and resume monitoring immediately.",
			},
			{
				title: "Scoped to what you need",
				description: "Suppress alerts for the whole team or a single monitor.",
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
			"Monitor DNS records for unexpected changes. Track A, AAAA, CNAME, MX, TXT, and NS records to catch hijacking attempts.",
		badge: "DNS Monitors",
		title: "Catch DNS changes",
		highlight: "before they cause an outage",
		description:
			"Monitor DNS records for unexpected changes. Track A, AAAA, CNAME, MX, TXT, and NS records to catch hijacking or misconfiguration.",
		highlights: ["A/AAAA/CNAME/MX/TXT/NS", "Change detection", "Global resolvers"],
		features: [
			{
				title: "Record change detection",
				description: "Get alerted the moment a monitored record's value changes.",
			},
			{
				title: "Multiple record types",
				description: "Track A, AAAA, CNAME, MX, TXT, and NS in one monitor.",
			},
			{
				title: "Hijack protection",
				description: "Unexpected DNS changes are often the first sign of an account compromise.",
			},
			{
				title: "Propagation-aware",
				description: "Checks account for normal DNS propagation delay before alerting.",
			},
		],
		steps: [
			{
				title: "Add a DNS monitor",
				description: "Enter the hostname and record type you want to track.",
			},
			{
				title: "Set the expected value",
				description: "Uptime baselines the current value automatically.",
			},
			{
				title: "Get alerted on change",
				description: "Any deviation from the expected value triggers an alert.",
			},
		],
		faqs: [
			{
				question: "Which record types can I monitor?",
				answer: "A, AAAA, CNAME, MX, TXT, and NS records.",
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
		features: [
			{
				title: "Expiry tracking",
				description: "Store your certificate's expiry date and issuer for quick reference.",
			},
			{
				title: "Warning thresholds",
				description: "Choose how many days before expiry you want to be alerted.",
			},
			{
				title: "Repeated reminders",
				description: "Alerts repeat at each threshold, gated by cooldown, until you renew.",
			},
			{
				title: "Per-monitor status",
				description:
					"See valid, expiring soon, or expired status right on the monitor detail page.",
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
		features: [
			{
				title: "Simple ping URL",
				description: "Your job calls one URL when it completes — no SDK required.",
			},
			{
				title: "Cron-aware scheduling",
				description: "Uptime parses your cron expression and knows exactly when to expect a ping.",
			},
			{
				title: "Grace periods",
				description: "Allow jobs a little slack before marking them late.",
			},
			{
				title: "Healthy → late → missed",
				description: "A clear state machine so you always know a job's current status.",
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
		features: [
			{
				title: "Contains checks",
				description: "Fail the monitor if expected text is missing from the response.",
			},
			{
				title: "Not-contains checks",
				description: "Fail the monitor if an error string or banned phrase appears.",
			},
			{
				title: "Regex patterns",
				description: "Match complex patterns beyond simple substring checks.",
			},
			{
				title: "Stacked on any HTTP monitor",
				description: "Add multiple content checks to the same monitor.",
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
		features: [
			{
				title: "Free manual monitoring",
				description: "Create monitors and trigger pings by hand, forever, at no cost.",
			},
			{
				title: "Usage-based pricing",
				description: "Automated checks are billed per-ping, so a small project stays cheap.",
			},
			{
				title: "One dashboard",
				description: "See every monitor's status and history in a single, simple view.",
			},
			{
				title: "Alerts that reach you",
				description: "Email, Slack, Discord, or webhook — wherever you already look.",
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
				answer: "$5/month includes 5,000 pings; additional pings are $0.001 each.",
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
		features: [
			{
				title: "Grow your team",
				description: "Invite engineers as you hire, with no per-seat pricing.",
			},
			{
				title: "Role-based access",
				description: "Owners and Admins manage settings; Members focus on monitoring.",
			},
			{
				title: "Status pages",
				description: "Give customers a public status page as trust becomes a selling point.",
			},
			{
				title: "API access",
				description: "Wire monitoring into your deploy pipeline as your infra matures.",
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
		metaTitle: "Uptime for Agencies | Client Monitoring",
		metaDescription:
			"Monitor all your client websites from one dashboard. Proactive uptime monitoring for digital agencies.",
		badge: "For Agencies",
		title: "One dashboard for",
		highlight: "every client site",
		description:
			"Monitor all your client websites from a single dashboard. Catch problems before a client notices — or calls.",
		highlights: ["One team, many sites", "Status pages per client", "Proactive alerts"],
		features: [
			{
				title: "Centralized monitoring",
				description: "Every client site, in one team, on one dashboard.",
			},
			{
				title: "Client-facing status pages",
				description: "Give each client their own branded status page.",
			},
			{
				title: "Fast incident response",
				description: "Instant alerts mean you're already investigating before the client calls.",
			},
			{
				title: "SSL & DNS coverage",
				description:
					"Catch expiring certificates and DNS misconfiguration across every domain you manage.",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Can I give each client their own status page?",
				answer: "Yes — create one status page per client and attach only that client's monitors.",
			},
			{
				question: "Can I monitor client domains I don't own?",
				answer:
					"You need authorization to monitor any endpoint you don't own — see the Terms of Service.",
			},
		],
	},

	enterprises: {
		slug: "enterprises",
		metaTitle: "Uptime for Enterprises | Domain Auto-Provisioning",
		metaDescription:
			"Enterprise uptime monitoring with domain verification, auto-provisioning, and role-based access. 99.9% SLA guaranteed.",
		badge: "For Enterprises",
		title: "Enterprise-ready",
		highlight: "monitoring",
		description:
			"Domain verification, auto-provisioning, and role-based access, with a 99.9% uptime target for the monitoring platform itself.",
		highlights: ["Domain auto-provisioning", "Role-based access", "99.9% uptime target"],
		features: [
			{
				title: "Domain verification",
				description: "Verify company domains via DNS TXT record for automatic onboarding.",
			},
			{
				title: "Auto-provisioning",
				description:
					"Anyone signing in with a verified domain's email joins the team automatically.",
			},
			{
				title: "Role-based access",
				description: "Owner, Admin, and Member roles control who can change settings and billing.",
			},
			{
				title: "Full audit trail",
				description: "Alert history and domain verification records for every action.",
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
		features: [
			{
				title: "REST API",
				description: "Manage monitors, alerts, and maintenance windows programmatically.",
			},
			{
				title: "Signed webhooks",
				description: "Every webhook alert carries an HMAC signature you can verify.",
			},
			{
				title: "TCP & cron monitoring",
				description: "Watch raw ports and scheduled jobs, not just HTTP endpoints.",
			},
			{
				title: "Maintenance windows",
				description: "Suppress alerts automatically during scheduled deploys.",
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
		metaDescription:
			"Uptime monitoring built for indie hackers. Start free, pay only for what you use. $5/mo includes 5,000 pings.",
		badge: "For Indie Hackers",
		title: "Simple monitoring for",
		highlight: "your next launch",
		description:
			"Start free, pay only for what you use. $5/month includes 5,000 pings — plenty for a lean, bootstrapped product.",
		highlights: ["$5/mo includes 5,000 pings", "No hidden fees", "Set up in minutes"],
		features: [
			{
				title: "Fast setup",
				description: "Create your first monitor and get a result in under a minute.",
			},
			{
				title: "Transparent pricing",
				description: "One flat base fee plus a clear per-ping rate — no surprise tiers.",
			},
			{
				title: "Status pages",
				description: "Add a status page the moment you have real users to reassure.",
			},
			{
				title: "Alerts you'll actually see",
				description: "Email, Slack, or Discord — wherever you already spend your day.",
			},
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "What happens if I exceed my plan's limits?",
				answer:
					"You're charged $1 for every 1,000 pings above the 5,000 included in your subscription. No surprise cutoffs.",
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
		features: [
			{
				title: "Global HTTP checks",
				description: "Confirm your site loads correctly from regions around the world.",
			},
			{
				title: "SSL monitoring",
				description: "Get warned before a certificate expires and breaks HTTPS.",
			},
			{
				title: "Content checks",
				description: "Verify the homepage actually renders, not just that it returns 200.",
			},
			{
				title: "Public status page",
				description: "Show visitors real-time status when something does go wrong.",
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
		features: [
			{
				title: "Authenticated checks",
				description: "Add Authorization headers to monitor endpoints behind auth.",
			},
			{
				title: "Status code validation",
				description: "Expect the exact status code your API should return.",
			},
			{
				title: "Latency tracking",
				description: "Watch P99 response time to catch slow-but-not-down degradation.",
			},
			{
				title: "Content checks",
				description: "Verify the response body contains an expected field or value.",
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
		features: [
			{
				title: "Cron-aware scheduling",
				description: "Uptime parses your cron expression to know exactly when to expect a ping.",
			},
			{
				title: "Public ping endpoint",
				description: "One line in your job reports completion — no API key needed.",
			},
			{
				title: "Grace periods",
				description: "Absorb normal timing variance before a job is marked late.",
			},
			{
				title: "Status pages",
				description: "Show scheduled job health alongside your other services.",
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
		features: [
			{
				title: "Dedicated health endpoints",
				description: "Point a monitor at any `/healthz`-style route.",
			},
			{
				title: "Flexible intervals",
				description: "Check as often as every minute, or as rarely as every hour.",
			},
			{
				title: "Manual trigger",
				description: "Run any health check instantly to verify after a deploy.",
			},
			{
				title: "Recovery alerts",
				description: "Know the moment a service comes back healthy, not just when it fails.",
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
		features: [
			{
				title: "Checkout flow monitoring",
				description: "Watch the pages that directly convert to revenue most closely.",
			},
			{
				title: "Content checks",
				description: "Verify a product page still shows an 'Add to cart' button, not an error.",
			},
			{
				title: "SSL monitoring",
				description: "An expired certificate on a checkout page is a lost-sale emergency.",
			},
			{
				title: "Public status page",
				description: "Reassure customers during a rare incident instead of losing their trust.",
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
		features: [
			{
				title: "Full-stack coverage",
				description: "Monitor your marketing site, app, API, and background jobs together.",
			},
			{
				title: "Team collaboration",
				description: "Invite your whole engineering team with role-based access.",
			},
			{
				title: "Customer-facing status page",
				description: "Turn reliability into a trust signal for your customers.",
			},
			{
				title: "Alert routing",
				description: "Route critical API alerts to on-call, and lower-priority ones elsewhere.",
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
		features: [
			{
				title: "One monitor per service",
				description: "Isolate failures to the exact service that's down.",
			},
			{
				title: "TCP port monitoring",
				description: "Watch raw ports for services that don't speak HTTP.",
			},
			{
				title: "DNS monitoring",
				description: "Catch service-discovery DNS changes before they misroute traffic.",
			},
			{
				title: "Independent alerting",
				description: "Scope alerts to a single service instead of the whole system.",
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
			},
			{
				title: "All monitor types included",
				description: "HTTP, DNS, TCP, cron jobs, and SSL — one plan, not a tier ladder.",
			},
			{
				title: "Signed webhooks",
				description: "HMAC-signed webhook alerts, not just a raw payload.",
			},
			{
				title: "Status pages included",
				description: "No separate status-page product or add-on fee.",
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
			},
			{
				title: "Focused scope",
				description:
					"Monitoring and alerting done well, without an incident-management platform bundled in.",
			},
			{
				title: "Status pages included",
				description: "No separate tier required to publish a status page.",
			},
			{
				title: "Signed webhooks",
				description: "HMAC-signed alerts for reliable webhook verification.",
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
			},
			{
				title: "All-in-one monitor types",
				description: "HTTP, DNS, TCP, SSL, and cron jobs in a single account.",
			},
			{
				title: "Simple setup",
				description: "Create a monitor and get your first result in under a minute.",
			},
			{ title: "Status pages included", description: "No separate purchase required." },
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
			},
			{
				title: "Modern, minimal UI",
				description: "A dashboard built around heatmaps and stat cards, not dense legacy tables.",
			},
			{
				title: "Usage-based pricing",
				description: "Pay for the pings you actually run, not a feature-bundle tier.",
			},
			{ title: "Signed webhooks", description: "HMAC-signed webhook alerts out of the box." },
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
				description: "Point a monitor at a URL, port, or DNS record — nothing to install.",
			},
			{
				title: "Predictable billing",
				description: "One base price plus a clear per-ping rate, not a complex usage matrix.",
			},
			{
				title: "Fast time-to-value",
				description: "See your first check result within a minute of creating a monitor.",
			},
			{
				title: "Status pages included",
				description: "No separate observability suite purchase required.",
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
			},
			{
				title: "Fast setup",
				description: "No agents or infrastructure discovery — just add a URL.",
			},
			{
				title: "All monitor types included",
				description: "HTTP, DNS, TCP, SSL, and cron jobs in every plan.",
			},
			{ title: "Status pages included", description: "No separate purchase required." },
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
			},
			{
				title: "DNS & cron job monitoring",
				description: "Covers monitor types outside Checkly's browser-test focus.",
			},
			{ title: "Fast to configure", description: "No test runner or scripting language to learn." },
			{ title: "Predictable pricing", description: "Pay per ping, not per script execution." },
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
			},
			{
				title: "Usage-based pricing",
				description: "Cost scales with ping volume, not the number of sites you monitor.",
			},
			{ title: "TCP monitoring", description: "Watch raw ports, not just HTTP endpoints." },
			{ title: "Signed webhooks", description: "HMAC-signed alerts for any webhook integration." },
		],
		steps: DEFAULT_STEPS,
		faqs: [
			{
				question: "Do I need a Laravel app to use Uptime?",
				answer:
					"No — Uptime is framework-agnostic and monitors any HTTP endpoint, DNS record, TCP port, or cron job.",
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
			},
			{ title: "Usage-based pricing", description: "Pay for pings, not a monitor-count tier." },
			{ title: "Status pages included", description: "No higher tier required to publish one." },
			{
				title: "Simple grace periods",
				description: "Absorb normal cron-timing variance before alerting.",
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
			},
			{
				title: "Same simple ping workflow",
				description: "A public ping URL for cron jobs, just like Healthchecks.io.",
			},
			{
				title: "Grace periods",
				description: "Absorb normal timing variance before marking a job late.",
			},
			{
				title: "Usage-based pricing",
				description: "One predictable pricing model across every monitor type.",
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
