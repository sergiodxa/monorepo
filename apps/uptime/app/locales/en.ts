/**
 * English translation dictionary for the Uptime app, and the canonical source of truth
 * for every translatable string: landing page, marketing/comparison and SEO meta, the
 * dashboard, monitors, alerts, teams, domains, status pages, and toast/error copy. Other
 * locale files mirror this shape so the UI can render in the user's chosen language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ApiKeyScope } from "~/database/schema";

export default {
	landing: {
		meta: {
			title: "Uptime by Sergio Xalambrí",
			description: "Simple & reliable uptime monitoring for developers",
		},

		vs: {
			site24x7: {
				meta: {
					title: "Uptime vs Site24x7 | Simple Uptime Monitoring Alternative",
					description:
						"Compare Uptime and Site24x7 for uptime monitoring. Get transparent, usage-based pricing instead of complex tiered plans. See features, pricing, and find out which is right for you.",
				},
			},
			checkly: {
				meta: {
					title: "Uptime vs Checkly | Simple Uptime Monitoring Without the Code",
					description:
						"Compare Uptime and Checkly side by side. Simple uptime monitoring without the code. See features, pricing, and find out which is right for you.",
				},
			},
			ohdear: {
				meta: {
					title: "Uptime vs Oh Dear | Developer-Focused Monitoring Comparison",
					description:
						"Compare Uptime and Oh Dear for uptime monitoring. Both are developer-focused tools - see how usage-based pricing compares to per-site pricing, and find which is right for you.",
				},
			},
			cronitor: {
				meta: {
					title: "Uptime vs Cronitor | Simpler Monitoring, Better Pricing",
					description:
						"Compare Uptime and Cronitor. Discover why teams choose Uptime for simpler pricing, DNS/TCP monitoring, and a focused approach without feature bloat.",
				},
			},
			healthchecks: {
				meta: {
					title: "Uptime vs Healthchecks.io | Complete Monitoring Solution",
					description:
						"Compare Uptime and Healthchecks.io. See why teams choose Uptime for complete monitoring with HTTP, DNS, TCP, SSL, and cron job monitoring in one platform.",
				},
			},
			uptimerobot: {
				meta: {
					title: "Uptime vs UptimeRobot | Modern Usage-Based Monitoring",
					description:
						"Compare Uptime and UptimeRobot. See why teams choose transparent usage-based pricing over tiered plans with hidden limits.",
				},
			},
			betterUptime: {
				meta: {
					title: "Uptime vs Better Uptime | Simpler Monitoring Alternative",
					description:
						"Compare Uptime and Better Uptime. Discover simpler pricing, powerful features, and why developers are switching.",
				},
			},
			pingdom: {
				meta: {
					title: "Uptime vs Pingdom | Affordable Monitoring Alternative",
					description:
						"Compare Uptime and Pingdom. Get powerful uptime monitoring without enterprise pricing. See features, pricing, and differences.",
				},
			},
			statuscake: {
				meta: {
					title: "Uptime vs StatusCake | Modern Monitoring Comparison",
					description:
						"Compare Uptime and StatusCake. Modern interface, transparent pricing, and all the features you need without the complexity.",
				},
			},
			datadog: {
				meta: {
					title: "Uptime vs Datadog | Simple Uptime Monitoring Alternative",
					description:
						"Compare Uptime and Datadog for uptime monitoring. Get focused monitoring without the complexity of a full observability platform.",
				},
			},
		},

		header: {
			title: "Uptime",

			nav: {
				features: "Features",
				compare: "Compare",
				pricing: "Pricing",
				docs: "Docs",

				cta: {
					in: "Open Dashboard",
					out: "Start Monitoring",
				},
			},
		},

		try: {
			title: "Check any URL, free",
			description:
				"No account needed. We'll run one check and show you exactly what a monitor would report.",
			label: "Check a URL",
			placeholder: "https://example.com",
			submit: "Run a check",
		},

		hero: {
			pill: "Uptime Monitoring",
			title: "Monitor your services <strong>with confidence</strong>",
			description:
				"Get instant alerts when your websites and APIs go down. Monitor your websites and APIs with ease.",

			cta: {
				in: "Open Dashboard",
				out: "Start Monitoring",
				pricing: "View Pricing",
			},

			try: {
				label: "Check a URL",
				placeholder: "https://example.com",
				submit: "Run a check",
			},
			screenshot: {
				alt: "Screenshot of the Uptime dashboard: a sidebar listing HTTP, DNS, and TCP monitors, cron jobs, alerts, maintenance, and status pages; summary cards for monthly ping usage, overall uptime percentage, and the slowest endpoint; per-type counts of monitors up and down; and a table of HTTP monitors with latency trend sparklines and status badges",
			},

			trustIndicators: {
				freeToStart: "Free to start",
				payForAutomation: "Pay for automation",
				cancelAnytime: "Cancel anytime",
			},
		},

		trustIndicators: {
			uptimeSla: "Uptime SLA",
			globalRegions: "Global Regions",
			daysDataRetention: "Days Data Retention",
			alertLatency: "Alert Latency",
		},

		features: {
			title: "Powerful Monitoring Made Simple",
			description:
				"Everything you need to keep your services running smoothly, with no unnecessary complexity.",
			badge: "Features",
			learnMore: "Learn more",

			monitors: {
				meta: {
					title: "HTTP Monitoring | Uptime Monitors",
					description:
						"HTTP health checks from 9 global regions. Monitor any URL with 1-60 minute intervals and 365-day data retention.",
				},
			},

			alerts: {
				meta: {
					title: "Uptime Alerts | Email & Webhook Notifications",
					description:
						"Instant email and webhook alerts for downtime detection. Under 1 second delivery. Integrates with Slack, Discord, PagerDuty, and more.",
				},
			},

			"status-pages": {
				meta: {
					title: "Status Pages | Uptime Monitors",
					description:
						"Beautiful, customizable status pages to keep your users informed. Public or private pages with real-time updates and uptime history.",
				},
			},

			analytics: {
				meta: {
					title: "Uptime Analytics | Heatmaps & Trends",
					description:
						"Visual heatmaps, response time tracking, and 365-day data retention. Understand your service reliability at a glance.",
				},
			},

			teams: {
				meta: {
					title: "Team Collaboration | Uptime Teams",
					description:
						"Collaborate on uptime monitoring with unlimited team members. Role-based access and domain auto-provisioning included.",
				},
			},

			api: {
				meta: {
					title: "Public API | Uptime Monitors",
					description:
						"Integrate monitoring into your workflow with our REST API. Create monitors, manage alerts, and access metrics programmatically.",
				},
			},

			integrations: {
				meta: {
					title: "Integrations | Uptime",
					description:
						"Connect monitoring to your workflow with Slack, Discord, PagerDuty, and custom webhooks. Native integrations for instant notifications.",
				},
			},

			maintenance: {
				meta: {
					title: "Maintenance Windows | Uptime",
					description:
						"Schedule planned downtime, suppress alerts during maintenance, and keep your team informed with maintenance windows.",
				},
			},

			dns: {
				meta: {
					title: "DNS Monitoring | Uptime",
					description:
						"Monitor DNS records for unexpected changes. Track A, AAAA, CNAME, MX, TXT, and NS records to catch hijacking attempts.",
				},
			},

			ssl: {
				meta: {
					title: "SSL Certificate Monitoring | Uptime",
					description:
						"Track SSL certificate expiry and get alerts before they expire. Automatic daily checks with configurable warning thresholds.",
				},
			},

			"cron-jobs": {
				meta: {
					title: "Cron Job Monitoring | Uptime",
					description:
						"Monitor scheduled tasks and background jobs. Get alerted when cron jobs are late or miss their execution window.",
				},
			},

			"content-monitoring": {
				meta: {
					title: "Content Monitoring | Uptime",
					description:
						"Verify specific content appears on your pages. Check for keywords, patterns, or specific text to ensure page integrity.",
				},
			},

			list: {
				first: {
					title: "Monitor your uptime",
					description:
						"Track your services 24/7 with 99.9% monitoring reliability. Get detailed metrics and performance insights at a glance.",
				},
				second: {
					title: "Receive alerts anywhere",
					description:
						"Get instant notifications via email, Slack, Discord, or webhooks when your services experience downtime or performance issues.",
				},
				third: {
					title: "Pay for what you use",
					description:
						"Transparent pricing with no hidden fees. Scale up or down as needed, with plans that grow with your monitoring needs.",
				},
				fourth: {
					title: "Status Pages",
					description:
						"Create beautiful public status pages to keep your users informed about service availability and incidents.",
				},
				fifth: {
					title: "SSL Monitoring",
					description:
						"Track certificate expiry dates and get alerts before your SSL certificates expire to prevent security warnings.",
				},
				sixth: {
					title: "DNS Monitoring",
					description:
						"Detect DNS record changes and propagation issues before they impact your users or get hijacked.",
				},
				seventh: {
					title: "Native Integrations",
					description:
						"Direct Slack and Discord integrations with rich notifications, not just basic webhooks.",
				},
			},
		},

		completeFeatureSet: {
			badge: "Complete Feature Set",
			title: "Everything you need for reliable monitoring",
			description: "Advanced capabilities that make monitoring effortless and comprehensive.",

			list: {
				maintenanceWindows: {
					title: "Maintenance Windows",
					description: "Schedule downtime and suppress alerts during planned maintenance",
				},
				contentMonitoring: {
					title: "Content Monitoring",
					description: "Verify specific keywords or content appear on your pages",
				},
				recoveryAlerts: {
					title: "Recovery Alerts",
					description: "Get notified when services come back up after an incident",
				},
				apiAccess: {
					title: "API Access",
					description: "Full REST API with key management for automation",
				},
				alertCooldowns: {
					title: "Alert Cooldowns",
					description: "Prevent alert fatigue with configurable cooldown periods",
				},
				customHeaders: {
					title: "Custom Headers",
					description: "Add authentication headers and custom request parameters",
				},
				cronMonitoring: {
					title: "Cron Job Monitoring",
					description: "Monitor scheduled jobs and background tasks with heartbeat checks",
				},
			},
		},

		useCases: {
			badge: "Use Cases",
			title: "Built for every monitoring need",
			description:
				"From simple health checks to complex distributed systems, we've got you covered.",
			learnMore: "Learn more",
			tailoredFor: "Tailored solutions for:",

			websiteMonitoring: {
				meta: {
					title: "Website Monitoring | Uptime",
					description:
						"Monitor website uptime and performance from 9 global regions. Track response times, SSL certificates, and get instant downtime alerts.",
				},
			},

			apiMonitoring: {
				meta: {
					title: "API Monitoring | Uptime",
					description:
						"Monitor REST APIs and endpoints with detailed status checks. Track response codes, measure latency, and verify API health.",
				},
			},

			cronJobs: {
				meta: {
					title: "Cron Job Monitoring | Uptime",
					description:
						"Monitor scheduled tasks and cron jobs. Get alerts when jobs are late, miss their window, or fail to complete.",
				},
			},

			healthcheck: {
				meta: {
					title: "Health Check Monitoring | Uptime",
					description:
						"Automated health checks for your services. Monitor endpoints, databases, and internal services with customizable intervals.",
				},
			},

			ecommerce: {
				meta: {
					title: "E-commerce Monitoring | Uptime",
					description:
						"Protect your online store with uptime monitoring. Track checkout, payments, and product pages to prevent lost sales.",
				},
			},

			saas: {
				meta: {
					title: "SaaS Application Monitoring | Uptime",
					description:
						"Keep your SaaS product reliable with comprehensive monitoring. Track APIs, dashboards, and background jobs in one platform.",
				},
			},

			microservices: {
				meta: {
					title: "Microservices Monitoring | Uptime",
					description:
						"Monitor distributed systems and microservices architecture. Catch failures before they cascade across your infrastructure.",
				},
			},

			list: {
				websiteMonitoring: {
					title: "Website Monitoring",
					description:
						"Track uptime and performance for landing pages, blogs, and web applications.",
				},
				apiMonitoring: {
					title: "API Monitoring",
					description: "Monitor REST APIs, GraphQL endpoints, and webhooks for availability.",
				},
				saas: {
					title: "SaaS Applications",
					description:
						"Keep your SaaS product reliable with proactive monitoring and instant alerts.",
				},
				microservices: {
					title: "Microservices",
					description: "Monitor distributed systems and catch failures before they cascade.",
				},
				healthChecks: {
					title: "Health Checks",
					description: "Verify service health and database connections with scheduled pings.",
				},
				ecommerce: {
					title: "E-commerce",
					description:
						"Monitor checkout flows, payment APIs, and product pages to protect revenue.",
				},
			},

			audiences: {
				indieHackers: "Indie Hackers",
				soloDevelopers: "Solo Developers",
				startups: "Startups",
				agencies: "Agencies",
				enterprises: "Enterprises",
				devops: "DevOps",
			},
		},

		pricing: {
			badge: "Pricing",
			title: "Simple, Transparent Pricing",
			description:
				"One subscription, no tiers. Pay only for what you use with our straightforward pricing model",

			howItWorks: {
				title: "How pricing works",

				list: {
					first: {
						title: "Base subscription",
						description: "{{price}}/month includes your first {{included}} pings",
					},

					second: {
						title: "Additional pings",
						description:
							"{{blockPrice}} per {{blockSize}} pings after that, billed in whole blocks",
					},

					third: {
						title: "No hidden fees",
						description:
							"No extra charges for features or integrations. Pay for the pings you use.",
					},
				},
			},

			calculator: {
				title: "Pricing Calculator",
				description: "Calculate your monthly cost based on your monitoring needs",

				add: "Add Monitor",

				monitor: {
					label: "Monitor frequency",
					delete: "Remove",
					frequency: {
						lower: "1m",
						upper: "60m",
					},
				},

				stats: {
					pingsPerMonth: "Pings per month:",
					baseSubscription: "Base subscription",
					includes: "Includes first {{amount}} pings",
					additionalPings: "Additional pings:",
					additionalPingsCost:
						"{{blocks}} × {{blockPrice}} per {{blockSize}} pings ({{pings}} over)",
					totalCost: "Total monthly cost:",
				},
			},
		},

		faq: {
			badge: "FAQ",
			title: "Frequently Asked Questions",
			description: "Find answers to common questions about Uptime",

			list: {
				first: {
					q: "How does Uptime monitor my services?",
					a: "Uptime sends regular HTTP or HTTPS requests to your endpoints. We check response codes and response times to determine if your service is available and responsive.",
				},

				second: {
					q: "What happens when an outage is detected?",
					a: "When Uptime detects an outage, it immediately sends an alert through your configured channels.",
				},

				third: {
					q: "Can I monitor internal services?",
					a: "Yes, as long as your internal services are accessible from the internet. You can also configure custom headers to authenticate requests.",
				},

				fourth: {
					q: "How do I get started?",
					a: "Just sign up, create your first monitor, and configure your alert preferences. You’ll be up and running in under a minute.",
				},

				fifth: {
					q: "Is there a free tier?",
					a: "Yes! You can create unlimited monitors and trigger pings manually for free, forever. Scheduled automatic monitoring requires a subscription.",
				},

				sixth: {
					q: "How long is ping data stored?",
					a: "We store your ping results for 365 days. After that, they are automatically deleted.",
				},

				seventh: {
					q: "Can I monitor services that require authentication?",
					a: "Yes. You can set custom headers with tokens or credentials to authenticate your requests.",
				},

				eighth: {
					q: "Can I monitor multiple URLs?",
					a: "Yes. Just create a separate monitor for each URL. Each monitor can have its own check frequency, HTTP method, expected status code, and more.",
				},

				ninth: {
					q: "Can I monitor APIs?",
					a: "Absolutely. Uptime is designed to monitor both websites and APIs. You can set the endpoint, method, headers, and expected responses to monitor your API effectively.",
				},

				tenth: {
					q: "Can I set a timeout for each ping?",
					a: "Yes. You can configure a timeout for each monitor. If the response takes longer than expected, it’s considered a failure. This helps detect slow services.",
				},

				eleventh: {
					q: "Can I pause or disable a monitor temporarily?",
					a: "Yes. You can pause any monitor at any time, individually.",
				},

				twelfth: {
					q: "Can I test a monitor immediately after creating it?",
					a: "Yes. A ping is automatically triggered right after you create a monitor.",
				},

				thirteenth: {
					q: "Do you support status pages?",
					a: "Yes! Create customizable public status pages to share your service health with users. Include any monitors you want and add your branding.",
				},

				fourteenth: {
					q: "Can I view historical performance trends?",
					a: "We store all past results so you get a full history. Performance trend charts are planned for a future release.",
				},

				fifteenth: {
					q: "Which alert channels are supported?",
					a: "Email, Slack, Discord, and webhooks. Native integrations make it easy to get alerts where your team already works. Webhooks let you connect to any other service.",
				},

				sixteenth: {
					q: "Do you support teams or shared monitors?",
					a: "Yes! Each user starts with a team. Invite team members with different roles (Owner, Admin, Member). Domain auto-provisioning automatically adds users with verified company email domains.",
				},

				seventeenth: {
					q: "What happens if I exceed my plan’s limits?",
					a: "Usage above the {{included}} pings included in your subscription is billed in whole blocks of {{blockSize}} at {{blockPrice}} each — a single ping over starts a new block.",
				},

				eighteenth: {
					q: "Do you store request or response bodies?",
					a: "No. We never store body data. For extra privacy and efficiency, we recommend using the `HEAD` method.",
				},

				nineteenth: {
					q: "From which regions can I monitor my services?",
					a: "Uptime supports monitoring from multiple regions: Africa, Asia-Pacific, Eastern and Western Europe, Eastern and Western North America, Middle East, Oceania, and South America.\n\nYou can choose one region per monitor. The region is treated as a hint, the actual ping will originate from a server in or near that region.",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "Simple, reliable monitoring for your websites and APIs.",
			copyright: "© {{year}} Uptime by Sergio Xalambrí. All rights reserved.",
			sections: {
				product: {
					title: "Product",
					features: "Features",
					pricing: "Pricing",
					faq: "FAQ",
				},
				features: {
					title: "Features",
					monitors: "Monitors",
					alerts: "Alerts",
					statusPages: "Status Pages",
					ssl: "SSL Monitoring",
					dns: "DNS Monitoring",
					cronJobs: "Cron Job Monitoring",
					contentMonitoring: "Content Monitoring",
					maintenance: "Maintenance Windows",
					integrations: "Integrations",
					teams: "Teams",
					analytics: "Analytics",
					api: "API Access",
				},
				useCases: {
					title: "Use Cases",
					websiteMonitoring: "Website Monitoring",
					apiMonitoring: "API Monitoring",
					saas: "SaaS Applications",
					ecommerce: "E-commerce",
					cronJobs: "Cron Job Monitoring",
					microservices: "Microservices",
					healthChecks: "Health Checks",
				},
				solutions: {
					title: "Solutions",
					indieHackers: "For Indie Hackers",
					soloDevs: "For Solo Developers",
					startups: "For Startups",
					agencies: "For Agencies",
					enterprises: "For Enterprises",
					devops: "For DevOps",
				},
				compare: {
					title: "Compare",
					uptimerobot: "vs UptimeRobot",
					pingdom: "vs Pingdom",
					betterUptime: "vs Better Uptime",
					healthchecks: "vs Healthchecks.io",
					cronitor: "vs Cronitor",
					checkly: "vs Checkly",
					statuscake: "vs StatusCake",
					datadog: "vs Datadog",
					site24x7: "vs Site24x7",
					ohdear: "vs Oh Dear",
				},
				docs: {
					title: "Documentation",
					overview: "Overview",
					quickstart: "Quick Start",
					apiReference: "API Reference",
				},
				legal: {
					title: "Legal",
					terms: "Terms of Service",
					privacy: "Privacy Policy",
				},
			},
		},

		finalCta: {
			body: "Create your first monitor in under 2 minutes. No credit card required to start.",
		},

		marketingPage: {
			everythingBadge: "Deep Dive",
			everythingTitle: "Everything you need",
			everythingDescription:
				"A closer look at what you get, from the first check to the alert that reaches you.",
			howItWorksBadge: "Get started",
			howItWorksTitle: "How it works",
			howItWorksDescription: "Three steps from an empty dashboard to checks that run on their own.",
			faqBadge: "FAQ",
			faqTitle: "Frequently asked questions",
			faqDescription: "The questions people ask most before they start monitoring.",
			finalCtaTitle: "Start monitoring your services",
		},

		comparison: {
			tableLabel: "Uptime vs {{competitor}}",
			tableCategoryHeader: "Category",
			tableProductHeader: "Uptime",
			whyTeamsSwitchTitle: "Why teams switch to Uptime",
			gettingStartedTitle: "Getting started",
			finalCtaTitle: "Switch to Uptime",

			honestTake: {
				badge: "Honest take",
				title: "When {{competitor}} might be better",
				description:
					"We believe in being transparent. Here's when {{competitor}} could be the right choice.",
			},

			pricing: {
				badge: "Pricing",
				title: "Real cost comparison",
				description: "See how much you could save for a typical monitoring setup.",
				tableLabel: "Cost comparison: Uptime vs {{competitor}}",
				scenarioHeader: "Use case",
				savingsHeader: "Savings",
				savingsPerYear: "~{{amount}}/year",
				footnote:
					"Estimates based on typical usage patterns. {{competitor}} pricing can change and your actual cost depends on your setup.",
			},
		},

		for: {
			soloDevs: {
				meta: {
					title: "Uptime for Solo Developers | Free Monitoring",
					description:
						"Professional uptime monitoring for solo developers. Start free, upgrade when ready. Perfect for portfolios and side projects.",
				},
			},
			startups: {
				meta: {
					title: "Uptime for Startups | Team Monitoring",
					description:
						"Uptime monitoring for startups. Team collaboration, instant alerts, and usage-based pricing that scales with you.",
				},
			},
			agencies: {
				meta: {
					title: "Uptime for Agencies | Client Monitoring",
					description:
						"Monitor all your client websites from one dashboard. Proactive uptime monitoring for digital agencies.",
				},
			},
			enterprises: {
				meta: {
					title: "Uptime for Enterprises | Domain Auto-Provisioning",
					description:
						"Enterprise uptime monitoring with domain verification, auto-provisioning, and role-based access. 99.9% SLA guaranteed.",
				},
			},
			devops: {
				meta: {
					title: "Uptime for DevOps | API-First Monitoring",
					description:
						"Uptime monitoring built for DevOps workflows. API-first design, webhook integrations, and fits into your existing toolchain.",
				},
			},
			indieHackers: {
				meta: {
					title: "Uptime for Indie Hackers | Simple Monitoring",
					description:
						"Uptime monitoring built for indie hackers. Start free, pay only for what you use. $5/mo includes 100,000 pings.",
				},
			},
		},
	},

	legal: {
		terms: {
			meta: {
				title: "Terms of Service | Uptime",
				description:
					"Terms of Service for Uptime, the uptime monitoring service by Sergio Xalambrí.",
			},

			lastUpdated: "Last updated: February 11, 2026",
			title: "Terms of Service",

			sections: {
				introduction: {
					title: "1. Introduction",
					body: "Welcome to Uptime. These Terms of Service govern your use of our uptime monitoring service operated by Sergio Xalambrí. By accessing or using Uptime, you agree to be bound by these terms.",
				},
				serviceDescription: {
					title: "2. Service Description",
					body: "Uptime provides uptime and scheduled task monitoring services, including HTTP endpoint monitoring, DNS monitoring, TCP port monitoring, SSL certificate monitoring, and cron job monitoring. These services help you track the health of your services and scheduled tasks. We monitor your endpoints from multiple global regions and notify you when issues are detected.",
				},
				accountTerms: {
					title: "3. Account Terms",
					first: "You must provide accurate and complete information when creating an account.",
					second:
						"You are responsible for maintaining the security of your account credentials and for all activities that occur under your account.",
					third:
						"You must be at least 18 years old or have the legal authority to enter into this agreement on behalf of an organization.",
					fourth: "You must notify us immediately of any unauthorized use of your account.",
				},
				acceptableUse: {
					title: "4. Acceptable Use",
					intro: "When using Uptime, you agree not to:",
					first:
						"Abuse, overload, or interfere with our service or attempt to circumvent any usage limits.",
					second: "Monitor URLs or endpoints that you do not own or have authorization to monitor.",
					third:
						"Monitor cron jobs or scheduled tasks that you do not own or have authorization to monitor.",
					fourth:
						"Use cron job ping endpoints for purposes other than legitimate scheduled task monitoring.",
					fifth: "Use the service for any illegal or unauthorized purpose.",
					sixth: "Attempt to gain unauthorized access to our systems or other users' accounts.",
					seventh: "Resell or redistribute the service without our written consent.",
				},
				paymentTerms: {
					title: "5. Payment Terms",
					first:
						"Uptime operates on a usage-based billing model. You pay based on the number of monitors and check frequency you configure.",
					second: "Subscriptions are managed and processed through Polar.",
					third:
						"Refunds are provided on a prorated basis for the unused portion of your subscription if you cancel.",
					fourth:
						"We reserve the right to change pricing with 30 days notice. Continued use after price changes constitutes acceptance.",
				},
				dataAndPrivacy: {
					title: "6. Data and Privacy",
					firstPrefix: "Your use of Uptime is also governed by our ",
					firstLinkText: "Privacy Policy",
					firstSuffix: ", which describes how we collect, use, and protect your data.",
					second:
						"Monitoring data is retained for 365 days. After this period, historical data is automatically deleted.",
					third:
						"You may request deletion of your data at any time by contacting us. Upon account termination, your data will be deleted within 30 days.",
				},
				serviceAvailability: {
					title: "7. Service Availability",
					first:
						"We target 99.9% service availability, but this is a goal, not a guarantee. We do not offer service level agreements (SLAs) with financial remedies.",
					second:
						"We may perform scheduled maintenance with reasonable advance notice when possible. Emergency maintenance may occur without notice.",
					third:
						"We are not liable for any downtime, data loss, or damages resulting from service interruptions, whether planned or unplanned.",
				},
				limitationOfLiability: {
					title: "8. Limitation of Liability",
					first:
						'Uptime is provided "as is" and "as available" without warranties of any kind, either express or implied.',
					second:
						"We do not guarantee that our service will detect all downtime events affecting your monitored endpoints. Monitoring is subject to network conditions and other factors outside our control.",
					third:
						"Our total liability to you for any claims arising from your use of the service is limited to the amount you paid us in the 12 months preceding the claim.",
					fourth:
						"We are not liable for any indirect, incidental, special, consequential, or punitive damages.",
				},
				termination: {
					title: "9. Termination",
					first:
						"You may terminate your account at any time through your account settings or by contacting us.",
					second:
						"We may suspend or terminate your account if you violate these terms or for any other reason with reasonable notice.",
					third:
						"Upon termination, your access to the service will end and your data will be deleted within 30 days.",
				},
				changesToTerms: {
					title: "10. Changes to Terms",
					body: "We may update these Terms of Service from time to time. We will notify you of significant changes by email or through the service. Your continued use of Uptime after changes take effect constitutes acceptance of the revised terms.",
				},
				contact: {
					title: "11. Contact",
					prefix: "If you have questions about these Terms of Service, please contact us at ",
					email: "hello@sergiodxa.com",
				},
			},
		},
		privacy: {
			meta: {
				title: "Privacy Policy | Uptime",
				description:
					"Privacy Policy for Uptime. Learn how we collect, use, and protect your data when using our uptime monitoring service.",
			},

			lastUpdated: "Last updated: August 2, 2026",
			title: "Privacy Policy",

			sections: {
				introduction: {
					title: "1. Introduction",
					first:
						'This Privacy Policy describes how Uptime, operated by Sergio Xalambrí ("we", "us", or "our"), collects, uses, and protects your personal information when you use our uptime monitoring service.',
					second:
						"This policy applies to all users of our service and covers data collected through our website and monitoring platform.",
				},
				dataCollected: {
					title: "2. Data We Collect",
					accountData: {
						title: "Account Data",
						body: "When you sign up using GitHub authentication, we collect your email address and display name from your GitHub profile.",
					},
					monitoringData: {
						title: "Monitoring Data",
						body: "We collect data related to the monitors you create, including URLs you choose to monitor, response times, HTTP status codes, and uptime/downtime events.",
					},
					cronJobData: {
						title: "Cron Job Monitoring Data",
						intro: "For cron job (scheduled task) monitoring, we collect:",
						first: "Ping timestamps (when your scheduled tasks report completion)",
						second: "Source IP addresses of ping requests",
						third: "User agent strings from ping requests",
						fourth: "Schedule configuration (cron expressions, timezones, grace periods)",
						outro:
							"This data helps you track whether your scheduled tasks are running on time and enables us to alert you when expected pings are missed.",
					},
					usageData: {
						title: "Usage Data",
						body: "We collect analytics and log data about how you interact with our service, including page views, feature usage, and error logs.",
					},
					paymentData: {
						title: "Payment Data",
						body: "Payment processing is handled by Polar. We do not store your credit card information. We only receive confirmation of your subscription status and billing history from Polar.",
					},
				},
				dataUsage: {
					title: "3. How We Use Your Data",
					first: {
						label: "To provide the monitoring service:",
						body: "We use your data to monitor your specified URLs and track their availability.",
					},
					second: {
						label: "To send alerts and notifications:",
						body: "We use your email to send you downtime alerts and status notifications.",
					},
					third: {
						label: "To improve the service:",
						body: "We analyze usage patterns to enhance features and fix issues.",
					},
					fourth: {
						label: "To communicate with you:",
						body: "We may send you service updates, security notices, and support messages.",
					},
				},
				dataSharing: {
					title: "4. Data Sharing",
					noSell: "We do not sell your personal data.",
					intro:
						"We share data with the following third-party services that help us operate Uptime:",
					first: {
						label: "Cloudflare:",
						body: "Infrastructure, hosting, content delivery, and email delivery",
					},
					second: { label: "Polar:", body: "Payment processing and subscription management" },
					third: { label: "GitHub:", body: "Authentication services" },
					outro:
						"We may also disclose your data if required by law or to protect our rights and the safety of our users.",
				},
				dataRetention: {
					title: "5. Data Retention",
					first: { label: "Monitoring data:", body: "Retained for 365 days from collection" },
					second: { label: "Account data:", body: "Retained until you delete your account" },
					third: { label: "Logs:", body: "Retained for 30 days" },
				},
				rights: {
					title: "6. Your Rights (GDPR)",
					intro: "Under the General Data Protection Regulation (GDPR), you have the right to:",
					first: {
						label: "Access your data:",
						body: "Request a copy of the personal data we hold about you",
					},
					second: {
						label: "Correct your data:",
						body: "Request correction of inaccurate personal data",
					},
					third: { label: "Delete your data:", body: "Request deletion of your personal data" },
					fourth: { label: "Export your data:", body: "Receive your data in a portable format" },
					fifth: {
						label: "Object to processing:",
						body: "Object to certain types of data processing",
					},
					outro:
						"To exercise any of these rights, please contact us at the email address provided below.",
				},
				security: {
					title: "7. Security",
					intro: "We implement appropriate security measures to protect your data:",
					first: {
						label: "Encryption in transit:",
						body: "All data is transmitted over HTTPS/TLS",
					},
					second: { label: "Encryption at rest:", body: "Stored data is encrypted" },
					third: {
						label: "Access controls:",
						body: "Strict access controls limit who can access your data",
					},
					fourth: {
						label: "Regular security reviews:",
						body: "We regularly review our security practices",
					},
				},
				cookies: {
					title: "8. Cookies",
					intro: "We use minimal cookies necessary for the service to function:",
					first: {
						label: "Session cookies:",
						body: "Used for authentication and maintaining your logged-in state",
					},
					outro:
						"We do not use tracking cookies, third-party advertising cookies, or any cookies for marketing purposes.",
				},
				turnstile: {
					title: "9. Bot Protection",
					first:
						"The public page where anyone can check a URL without an account is protected by Cloudflare Turnstile. It is there to tell a person from a bot, so the free checker is not drained by automated traffic.",
					second:
						"To do that, Cloudflare receives your IP address and information about your browser, and may set a token in your browser to remember that the check passed.",
					third:
						"Turnstile runs only on that public page. It is not used anywhere in the signed-in app.",
					referencePrefix: "For what Cloudflare does with that data, see their ",
					referenceLinkText: "Turnstile Privacy Addendum",
					referenceSuffix: ".",
				},
				childrensPrivacy: {
					title: "10. Children's Privacy",
					body: "Uptime is not intended for use by individuals under 18 years of age. We do not knowingly collect personal information from children under 18.",
				},
				internationalTransfers: {
					title: "11. International Data Transfers",
					first:
						"Your data may be processed via Cloudflare's global network. If you are located in the European Union, your data may be transferred to and processed in the United States.",
					second:
						"We rely on Cloudflare's Standard Contractual Clauses and other appropriate safeguards to ensure your data is protected in accordance with GDPR requirements.",
				},
				changesToPolicy: {
					title: "12. Changes to This Policy",
					first:
						'We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.',
					second:
						"For significant changes, we will also send you an email notification if you have an account with us.",
				},
				contact: {
					title: "13. Contact Us",
					body: "If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us at:",
					email: "privacy@sergiodxa.com",
				},
			},
		},
	},

	notFound: {
		title: "Page Not Found",
		description: "The page you're looking for doesn't exist or may have moved.",
		goBackHome: "Go back home",
	},

	errors: {
		backHome: "Back home",
	},

	app: {
		meta: {
			title: "Uptime by Sergio Xalambrí",
			description: "Simple & reliable uptime monitoring for developers",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "Select Team" },
				userMenu: { label: "User Menu" },

				navigation: {
					items: {
						dashboard: "Dashboard",
						alerts: "Alerts",
						maintenance: "Maintenance",
						monitors: "Monitors",
						httpMonitors: "HTTP Monitors",
						statusPages: "Status Pages",
						tcpMonitors: "TCP Monitors",
						dnsMonitors: "DNS Monitors",
						cronJobs: "Cron Jobs",
						settings: "Settings",
						billing: "Billing",
						domains: "Domains",
						members: "Members",
						team: "Team",
						docs: "Documentation",
						apiKeys: "API Keys",
					},
				},

				account: {
					title: "Account",
					overview: "Overview",
					teams: "Your Teams",
				},
			},
		},

		errors: {
			notFound: {
				title: "404 Not Found",
				description: "The team you are looking for does not exist.",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "Stats",
			uptime: "Uptime",
			totalChecks: "Total Checks",
			lastCheck: "Last Check",
			neverRan: "N/A",
		},

		actions: {
			refresh: "Refresh",
			delete: {
				confirm: "Are you sure you want to delete this monitor?",
				cta: "Delete Monitor",
			},
		},
	},

	monitorList: {
		header: {
			title: "Uptime Monitors",
			cta: "Create Monitor",
			subscribe: "Your monitors are paused. Subscribe to continue monitoring",
		},
	},

	statusPage: {
		banner: {
			operational: "All Systems Operational",
			degraded: "Partial System Outage",
			down: "Major System Outage",
		},
		status: {
			operational: "Operational",
			degraded: "Degraded",
			down: "Down",
			unknown: "Unknown",
		},
		uptimeBar: {
			daysAgo: "90 days ago",
			today: "Today",
			legend: {
				full: "100%",
				partial: "Partial",
				down: "Down",
				noData: "No data",
			},
			tooltip: {
				uptime: "{{percentage}}% uptime",
				noData: "No data",
			},
		},
		cronJobs: {
			title: "Scheduled Jobs",
			lastPing: "Last ping",
			never: "Never",
			schedule: "Schedule",
		},
		empty: {
			description: "No services are configured for this status page.",
		},
		footer: {
			lastUpdated: "Last updated {{date}}",
			poweredBy: "Powered by Uptime",
		},
		error: {
			title: "Status Page Not Found",
			description: "The status page you're looking for doesn't exist or is not public.",
			goHome: "Go to homepage",
		},
	},

	contentMonitoring: {
		title: "Content Monitoring",
		description:
			"Check response content for specific keywords or patterns. The monitor will fail if any check does not pass.",
		empty:
			"No content checks configured. Add a check to monitor for specific keywords or patterns in the response.",
		addButton: "Add Content Check",

		form: {
			checkType: {
				label: "Check Type",
				description: "Choose how to match the response content",
				options: {
					contains: "Contains",
					notContains: "Does Not Contain",
					regex: "Regex Pattern",
				},
			},
			value: {
				label: "Value",
				placeholder: "Enter keyword or pattern",
				description: "The text or regex pattern to check for",
			},
			caseSensitive: "Case sensitive matching",
			cancel: "Cancel",
			add: "Add Check",
		},

		item: {
			type: "Type",
			status: "Status",
			caseSensitive: "Case sensitive",
			enabled: "Enabled",
			disabled: "Disabled",
			yes: "Yes",
			no: "No",
			delete: "Delete",
			deleteConfirmTitle: "Delete this content check?",
		},

		types: {
			contains: "Contains",
			notContains: "Does Not Contain",
			regex: "Regex",
		},
	},

	auth: {
		error: {
			title: "Authentication Error",
			errorCode: "Error Code: {{code}}",
			description: "Description: {{description}}",
			uri: "URI:",
			tryAgain: "Please try again or contact support if the issue persists.",

			signInFailedTitle: "Sign-in failed",
			signInFailedGeneric: "The sign-in attempt could not be completed. Please try again.",
			missingIdToken: "The identity provider did not return an ID token.",
		},
	},

	dashboard: {
		header: {
			title: "Uptime Monitors",
			cta: "Create Monitor",
			subscribe: "Your monitors are paused. Subscribe to continue monitoring",
		},

		monitor: {
			stats: {
				title: "Stats",
				uptime: "Uptime",
				totalChecks: "Total Checks",
				lastCheck: "Last Check",
				neverRan: "N/A",
			},

			actions: {
				refresh: "Refresh",
				delete: {
					confirm: "Are you sure you want to delete this monitor?",
					cta: "Delete Monitor",
				},
			},
		},
	},

	createMonitor: {
		title: "Create a New Monitor",
		fields: {
			name: {
				label: "Monitor Name",
				placeholder: "Landing Page",
				description: "A descriptive name for your monitor.",
			},
			url: {
				label: "URL to Monitor",
				placeholder: "https://example.com/healthcheck",
				description: "The URL of the service you want to monitor.",
			},
			method: {
				label: "Request Method",
				placeholder: "HEAD",
				description: "The HTTP method to use for the request.",
			},
			status: {
				label: "Expected Status Code",
				placeholder: "200",
				description: "The HTTP status code you expect to receive.",
			},
			interval: {
				label: "Check Interval",
				placeholder: "60",
				description: "Interval in seconds. Minimum is 60 seconds.",
			},
			visibility: {
				label: "Visibility",
				description: "Public monitors can be shared with anyone.",
				options: { public: "Public", private: "Private" },
			},
			region: {
				label: "Region",
				description: "The region from which the ping will run.",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} Africa",
					apac: "{{emoji}} Asia-Pacific",
					eeur: "{{emoji}} Eastern Europe",
					enam: "{{emoji}} Eastern North America",
					me: "{{emoji}} Middle East",
					oc: "{{emoji}} Oceania",
					sam: "{{emoji}} South America",
					weur: "{{emoji}} Western Europe",
					wnam: "{{emoji}} Western North America",
				},
			},
		},
		cta: "Create Monitor",
	},

	toasts: {
		refreshMonitor: {
			pending: "Pinging {{name}}...",
			success: "{{name}}'s ping ended.",
			failure: "Oops! Something went wrong while running the monitor.",
		},

		deleteMonitor: {
			success: "{{name}} was deleted.",
			failure: "We couldn't delete {{name}}. Please try again.",
		},

		createMonitor: {
			pending: "Creating monitor {{name}}...",
			success: "{{name}} was created.",
			failure: "We couldn't create {{name}}. Please try again.",
		},
	},

	emails: {
		teamInvite: {
			subject: "You've been invited to join {{team}} on Uptime",
			preview: "Join {{team}} on Uptime",
			heading: "You've been invited to join {{team}}",
			body: "{{team}} uses Uptime to keep an eye on its services. Accept the invite to join the team.",
			action: "Accept invite",
			footer:
				"You received this email because someone invited you to their team on Uptime. If you weren't expecting it, you can ignore this message.",
		},

		alert: {
			subject: "[Uptime Alert] {{monitor}} is {{status}}",
			preview: "{{monitor}} is {{status}}",
			heading: "{{monitor}} is {{status}}",
			action: "Open the dashboard",
			incident:
				"Notifications for this incident: {{sent}} sent, {{suppressed}} suppressed by cooldown and the {{cap}}-per-incident limit.",
			footer: "You received this email because one of your team's alerts matched this event.",

			status: {
				up: "RECOVERED",
				down: "DOWN",
				degraded: "DEGRADED",
			},

			fields: {
				monitor: "Monitor",
				status: "Status",
				time: "Time",
				url: "URL",
				responseStatus: "Response status",
				responseTime: "Response time",
				domain: "Domain",
				resolvedValue: "Resolved value",
				endpoint: "Endpoint",
				schedule: "Schedule",
				lastPing: "Last ping",
				nextExpected: "Next expected",
				hostname: "Hostname",
				expiresAt: "Expires at",
			},

			values: {
				none: "—",
				never: "never",
				monitor: "{{name}} ({{type}})",
				responseStatus: "{{actual}} (expected {{expected}})",
				milliseconds: "{{value}}ms",
				domain: "{{domain}} ({{recordType}})",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}} ({{timezone}})",
			},
		},

		trial: {
			stopAction: "Stop these emails",
			stop: "One click ends every URL you asked us to watch and deletes your address and its data. You can start again any time from our website.",

			status: {
				up: "UP",
				degraded: "DEGRADED",
				down: "DOWN",
			},

			fields: {
				url: "URL",
				status: "Status",
				previousStatus: "Previous status",
				responseStatus: "Response status",
				responseTime: "Response time",
				checkedAt: "Checked at",
				changedAt: "Changed at",
				checks: "Checks run",
				uptime: "Uptime",
				slowest: "Slowest response",
			},

			values: {
				none: "—",
				milliseconds: "{{value}}ms",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "{{value}}% uptime",
				legend: {
					up: "Up",
					degraded: "Degraded",
					down: "Down",
					noData: "No data",
				},
			},

			confirmation: {
				subject: "We are now checking {{url}} every hour",
				preview: "Hourly checks on {{url}} have started",
				heading: "We are now checking {{url}} every hour",
				body: "This is the check you just ran. We will run the same one every hour until {{until}} and email you whenever the result changes. You will also get a summary once a day.",
				footer: "You received this email because you asked us to check this URL from our website.",
			},

			change: {
				subject: "{{url}} is {{status}}",
				preview: "{{url}} is {{status}}",
				heading: "{{url}} is {{status}}",
				body: "The hourly check at {{time}} returned a different result from the one before it.",
				footer: "You received this email because you asked us to watch this URL for a week.",
			},

			daily: {
				subject: "Daily report: {{url}}",
				subjectMany: "Daily report: {{total}} URLs",
				preview: "The last 24 hours of checks on {{url}}",
				previewMany: "The last 24 hours of checks on {{total}} URLs",
				heading: "{{url}} over the last 24 hours",
				headingMany: "Your {{total}} URLs over the last 24 hours",
				summaryAll: "All {{total}} were up at the last check.",
				summary: "{{up}} of {{total}} were up at the last check.",
				target: "{{url}} — {{status}}",
				rangeStart: "24 hours ago",
				rangeEnd: "Now",
				footer:
					"You received this email because you asked us to run these checks from our website.",
			},

			weekly: {
				subject: "Seven-day report: {{url}}",
				preview: "The full week of checks on {{url}}",
				heading: "{{url}} over the last seven days",
				rangeStart: "7 days ago",
				rangeEnd: "Today",
				closing: "That was the seventh day, so the free checks on {{url}} stop here.",
				action: "Keep checking this URL",
				footer:
					"You received this email because you asked us to watch this URL for a week. This is the last one.",
			},

			repeat: {
				subject: "What we have found on {{url}} so far",
				preview: "The checks we already have on {{url}}",
				heading: "{{url}} has already been checked",
				intro: "You asked us to watch {{url}} on {{since}}. Here is everything those checks found.",
				rangeStart: "Day 1",
				rangeEnd: "Day 7",
				closing:
					"Each URL gets one free week every 30 days, so this request did not start a second one. To keep checking {{url}} — as often as you like, with an alert the moment it changes — use Uptime.",
				action: "Keep checking this URL",
				footer:
					"You received this email because you submitted this URL on our website and we already had a report for it.",
			},
		},
	},

	components: {
		heatmap: {
			tooltip: "{{date}}\n{{successRate}} success rate\n{{checks}} checks",
			legend: {
				success: "Success",
				failure: "Failure",
				mixed: "Mixed",
				noData: "No data",
			},
		},
		copyButton: {
			label: "Copy",
			copied: "Copied!",
		},
	},

	cron: {
		error: {
			empty: "Enter a cron expression.",
			"field-count":
				"A cron expression needs exactly five fields: minute, hour, day of month, month, and day of week.",
			"seconds-not-supported":
				"Seconds are not supported. Use the five-field format, starting with the minute.",
			"unknown-macro":
				"That shorthand is not supported. Use @hourly, @daily, @weekly, @monthly, or @yearly.",
			syntax: "One of the fields is not a value, a range, a list, or a step.",
			"unknown-name":
				"One of the month or weekday names is not recognized. Use three-letter abbreviations such as JAN or MON.",
			"out-of-range": "One of the values is outside the range its field allows.",
			"reversed-range": "One of the ranges starts after it ends.",
			"invalid-step": "A step must be a whole number greater than zero.",
			"impossible-date": "That day of the month never happens in the month it is paired with.",
		},
	},

	schedule: {
		interval: {
			minute_one: "Every minute",
			minute_other: "Every {{count}} minutes",
			hour_one: "Every hour",
			hour_other: "Every {{count}} hours",
		},
		hourly: {
			onTheHour: "Every hour",
			atMinutes: "Every hour at minute {{minutes}}",
		},
		daily: "Every day at {{times}}",
		weekly: "Every {{days}} at {{times}}",
		monthly: "Every month on day {{days}} at {{times}}",
		yearly: "Every year on {{months}} {{days}} at {{times}}",
		expression: "Custom schedule ({{expression}})",
	},

	actions: {
		addDomain: {
			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to add domains to this team.",
				alreadyExists: "{{hostname}} was added on {{verifiedAt}}.",
			},

			success: {
				accepted: "{{hostname}} is still pending verification.",
				created: "{{hostname}} was added to {{team}}. Verification is pending.",
			},
		},

		changeRole: {
			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to change roles in this team.",
				cannotChangeOwner: "You cannot change the role of the team owner.",
			},

			success: "{{name}}'s role was changed to {{role}} in {{team}}.",
		},

		createAlert: {
			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to create alerts in this team.",
				limitExceeded: "You have reached the limit of {{limit}} alerts in this team.",
			},
			success: { created: "{{name}} alert was created." },
		},

		createInvite: {
			email: {
				subject: "You've been invited to join {{team}} on Uptime",
			},

			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to invite members to this team.",
				alreadyAccepted: "There's already a member of {{team}} with this email.",
			},

			success: "{{email}} was invited to join {{team}}.",
		},

		createMonitor: {
			errors: {
				generic: "Oops! Something went wrong.",
			},

			success: "{{name}} monitor was created.",
		},

		updateMonitor: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This monitor does not exist.",
			},

			success: "{{name}} monitor was updated.",
		},

		updateSsl: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This monitor does not exist.",
			},

			success: "SSL settings for {{name}} were updated.",
		},

		deleteMonitor: {
			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to delete monitors in this team.",
				notFound: "This monitor does not exist.",
			},
			success: "{{name}} monitor was deleted.",
		},

		playMonitor: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This monitor does not exist.",
			},

			pending: "Pinging {{name}}...",
			success: "{{name}}'s ping ended.",
			failure: "Oops! Something went wrong while running the monitor.",
		},

		removeAlert: {
			errors: {
				generic: "Oops! Something went wrong.",
				forbidden: "You are not allowed to remove alerts in this team.",
				notFound: "{{name}} does not exist.",
			},
			success: "{{name}} alert was removed.",
		},

		removeDomain: {
			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to remove domains from this team.",
				notFound: "{{hostname}} does not exist.",
			},

			success: "{{hostname}} was removed from {{team}}.",
		},

		removeMember: {
			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to remove members from this team.",
				cannotRemoveOwner: "You cannot remove the team owner.",
			},

			success: "{{name}} was removed from {{team}}.",
		},

		retryDomainVerification: {
			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to retry domain verification in this team.",
				notFound: "{{hostname}} does not exist.",
				workflowFailed:
					"The verification process failed to start for {{hostname}}. Try again later.",
			},

			success: {
				alreadyVerified: "{{hostname}} is already verified.",
				requested: "{{hostname}} verification retry was requested.",
			},
		},

		revokeInvite: {
			errors: {
				generic: "Oops! Something went wrong.",
				notAllowed: "You are not allowed to revoke invites in this team.",
				notFound: "This invite does not exist.",
				alreadyAccepted: "This invite has already been accepted by the invitee.",
			},

			success: "{{email}}'s invite was revoked from {{team}}.",
		},

		updateTeam: {
			errors: {
				generic: "Oops! Something went wrong.",
				forbidden: "You are not allowed to update team settings.",
			},

			success: {
				updated: "Team settings were updated successfully.",
			},
		},

		deleteTeam: {
			errors: {
				generic: "Oops! Something went wrong while deleting the team.",
				forbidden: "Only the team owner can delete the team.",
				confirmationRequired: "Please type DELETE to confirm.",
			},

			success: "{{team}} has been deleted.",
		},

		leaveTeam: {
			errors: {
				generic: "Oops! Something went wrong.",
				notMember: "You are not a member of this team.",
				ownerCannotLeave: "Team owners cannot leave their team. Transfer ownership first.",
				adminCannotLeave: "Admins cannot leave the team. Ask the owner to demote you first.",
			},

			success: "You have left {{team}}.",
		},

		createStatusPage: {
			errors: {
				generic: "Oops! Something went wrong.",
				slugTaken: "This slug is already in use.",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This status page does not exist.",
				slugTaken: "This slug is already in use.",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This status page does not exist.",
			},

			success: "Status page was deleted.",
		},

		createMaintenance: {
			errors: {
				generic: "Oops! Something went wrong.",
				invalidDates: "End time must be after start time.",
			},

			success: {
				created: "Maintenance window '{{name}}' was created.",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This maintenance window does not exist.",
				forbidden: "You are not allowed to delete this maintenance window.",
			},

			success: "Maintenance window '{{name}}' was deleted.",
		},

		endMaintenance: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This maintenance window does not exist.",
				forbidden: "You are not allowed to end this maintenance window.",
			},

			success: "Maintenance window '{{name}}' was ended early.",
		},

		createTeam: {
			errors: {
				generic: "Oops! Something went wrong while creating the team.",
			},

			success: {
				created: "{{name}} team was created successfully.",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "Oops! Something went wrong.",
				limitExceeded: "You have reached the limit of {{limit}} DNS monitors in this team.",
			},

			success: {
				created: "{{name}} DNS monitor was created.",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This DNS monitor does not exist.",
				forbidden: "You are not allowed to update this DNS monitor.",
			},

			success: "{{name}} DNS monitor was updated.",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This DNS monitor does not exist.",
				forbidden: "You are not allowed to delete this DNS monitor.",
			},

			success: "{{name}} DNS monitor was deleted.",
		},

		checkDnsMonitor: {
			errors: {
				generic: "Oops! Something went wrong.",
				notFound: "This DNS monitor does not exist.",
				forbidden: "You are not allowed to check this DNS monitor.",
			},

			success: "DNS check completed for {{name}}.",
		},

		createTcpMonitor: {
			errors: {
				generic: "Oops! Something went wrong while creating the TCP monitor.",
			},
			success: "{{name}} TCP monitor was created.",
		},

		updateTcpMonitor: {
			errors: {
				generic: "Oops! Something went wrong while updating the TCP monitor.",
				notFound: "This TCP monitor does not exist.",
			},
			success: "{{name}} TCP monitor was updated.",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "Oops! Something went wrong while deleting the TCP monitor.",
				notAllowed: "You are not allowed to delete TCP monitors in this team.",
				notFound: "This TCP monitor does not exist.",
			},
			success: "{{name}} TCP monitor was deleted.",
		},

		createApiKey: {
			errors: {
				generic: "Oops! Something went wrong while creating the API key.",
				limitExceeded: "You have reached the limit of {{limit}} API keys in this team.",
			},
			success: {
				created: "API key '{{name}}' was created.",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "Oops! Something went wrong while deleting the API key.",
				notFound: "This API key does not exist.",
			},
			success: "API key '{{name}}' was deleted.",
		},

		updateLanguage: {
			errors: {
				generic: "Oops! Something went wrong while updating your language preference.",
			},
			success: "Language preference updated successfully.",
		},

		createCronJob: {
			errors: {
				generic: "Oops! Something went wrong while creating the cron job.",
				limitExceeded: "You have reached the limit of {{limit}} cron job monitors in this team.",
			},
			success: "{{name}} cron job was created.",
		},

		updateCronJob: {
			errors: {
				generic: "Oops! Something went wrong while updating the cron job.",
				notFound: "This cron job does not exist.",
			},
			success: "{{name}} cron job was updated.",
		},

		deleteCronJob: {
			errors: {
				generic: "Oops! Something went wrong while deleting the cron job.",
				notFound: "This cron job does not exist.",
				forbidden: "You are not allowed to delete this cron job.",
			},
			success: "{{name}} cron job was deleted.",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "Dashboard",
				action: {
					create: "Create Monitor",
					refresh: "Refresh",
				},
			},

			quickPing: {
				title: "Quick check",
				description: "Check a URL once. Nothing saved, no alerts — costs one ping.",
				field: {
					label: "URL",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "Run check",
				},
				result: {
					noResponse: "No response",
					status: {
						up: "Up",
						degraded: "Degraded",
						down: "Down",
					},
				},
				error: {
					invalidUrl: "Enter a full http:// or https:// URL.",
					subscriptionRequired: "An active subscription is required to run a check.",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			empty: {
				title: "No monitors yet",
				description: "Create your first monitor to start tracking your services.",
				cta: "Create Monitor",
			},

			stats: {
				monitors: {
					label: "Monthly Pings Usage",
					value: "{{consumed}}<small> used</small>",
					description: "Out of {{estimated}} estimated",
					unavailable: "Estimate unavailable",
				},

				uptime: {
					label: "Uptime percentage",
					description: "Overall system uptime",
				},

				slowestEndpoint: {
					label: {
						default: 'Slowest Endpoint "<em>{{name}}</em>"',
						noData: "Slowest Endpoint",
					},
					value: { noData: "N/A" },
					description: "In the last 24 hours",
				},

				httpMonitors: {
					label: "HTTP Monitors",
					description: "{{up}} up / {{down}} down",
				},

				dnsMonitors: {
					label: "DNS Monitors",
					description: "{{ok}} ok / {{changed}} changed / {{error}} error",
				},

				tcpMonitors: {
					label: "TCP Monitors",
					description: "{{up}} up / {{down}} down",
				},

				cronJobs: {
					label: "Cron Jobs",
					description: "{{healthy}} healthy / {{late}} late / {{missed}} missed",
				},

				sslMonitors: {
					label: "SSL Monitors",
					description: "{{valid}} valid, {{expiring}} expiring, {{expired}} expired",
				},
			},

			tabs: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cronJobs: "Cron Jobs",
			},

			loading: "Loading…",

			panel: {
				tabsLabel: "Monitor type",
				tabPanelLabel: "{{tab}} monitors",
				refresh: "Refresh",
			},

			error: {
				card: {
					label: "Error",
					value: "-",
					description: "Failed to load data",
				},
				table: {
					message: "Failed to load monitors. Please try again.",
				},
				analytics: {
					message: "Analytics data temporarily unavailable. Please retry later.",
				},
			},

			table: {
				label: "Monitors",

				columns: {
					name: "Name",
					latencyChart: "Latency Trend",
					status: "Status",
					lastIncident: "Last Incident",
					responseTime: "Avg. Latency",
					actions: "Actions",
				},

				status: {
					up: "Up & Running",
					down: "Down",
					degraded: "Degraded",
					unknown: "No Data",
				},

				lastIncident: { never: "-" },
				responseTime: "~{{value}}",

				actions: {
					menu: "Actions Menu",
					edit: "Edit Monitor",
					delete: "Delete Monitor",
					play: "Run Monitor",
				},

				confirmation: {
					deleteMonitor:
						"Are you sure you want to delete the monitor {{name}}? This action cannot be undone.",
				},
			},
		},

		monitors: {
			header: {
				title: "Uptime Monitors",
				cta: "Create Monitor",
				subscribe: "Your monitors are paused. Subscribe to continue monitoring",
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},
		},

		createMonitor: {
			header: {
				title: "Create Monitor",
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor Name",
						placeholder: "Landing Page",
						description: "A descriptive name for your monitor.",
					},
					url: {
						label: "URL to Monitor",
						placeholder: "https://example.com/healthcheck",
						description: "The URL of the service you want to monitor.",
					},
					method: {
						label: "Request Method",
						placeholder: "HEAD",
						description: "The HTTP method to use for the request.",
					},
					status: {
						label: "Expected Status Code",
						placeholder: "200",
						description: "The HTTP status code you expect to receive.",
					},
					interval: {
						label: "Check Interval",
						placeholder: "60",
						description: "Interval in seconds. Minimum is 60 seconds.",
					},
					visibility: {
						label: "Visibility",
						description: "Public monitors can be shared with anyone.",
						options: { public: "Public", private: "Private" },
					},
					region: {
						label: "Region",
						description: "The region from which the ping will run.",
						placeholder: "Select a region",
						options: {
							afr: "{{emoji}} Africa",
							apac: "{{emoji}} Asia-Pacific",
							eeur: "{{emoji}} Eastern Europe",
							enam: "{{emoji}} Eastern North America",
							me: "{{emoji}} Middle East",
							oc: "{{emoji}} Oceania",
							sam: "{{emoji}} South America",
							weur: "{{emoji}} Western Europe",
							wnam: "{{emoji}} Western North America",
						},
					},
				},

				cta: "Create Monitor",
			},
		},

		editMonitor: {
			header: {
				title: "Edit Monitor",
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor Name",
						placeholder: "Landing Page",
						description: "A descriptive name for your monitor.",
					},
					url: {
						label: "URL to Monitor",
						placeholder: "https://example.com/healthcheck",
						description: "The URL of the service you want to monitor.",
					},
					method: {
						label: "Request Method",
						placeholder: "HEAD",
						description: "The HTTP method to use for the request.",
					},
					status: {
						label: "Expected Status Code",
						placeholder: "200",
						description: "The HTTP status code you expect to receive.",
					},
					interval: {
						label: "Check Interval",
						placeholder: "60",
						description: "Interval in seconds. Minimum is 60 seconds.",
					},
					visibility: {
						label: "Visibility",
						description: "Public monitors can be shared with anyone.",
						options: { public: "Public", private: "Private" },
					},
					region: {
						label: "Region",
						description: "The region from which the ping will run.",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} Africa",
							apac: "{{emoji}} Asia-Pacific",
							eeur: "{{emoji}} Eastern Europe",
							enam: "{{emoji}} Eastern North America",
							me: "{{emoji}} Middle East",
							oc: "{{emoji}} Oceania",
							sam: "{{emoji}} South America",
							weur: "{{emoji}} Western Europe",
							wnam: "{{emoji}} Western North America",
						},
					},
					ssl: {
						enabled: {
							label: "Enable SSL Monitoring",
							description: "Monitor SSL certificate expiry and receive alerts before it expires.",
						},
						expiresAt: {
							label: "Certificate Expiry Date",
							placeholder: "Select expiry date",
							description:
								"Enter the expiry date of your SSL certificate. You can find this in your hosting provider's dashboard or by checking the certificate details in your browser.",
						},
						issuer: {
							label: "Certificate Issuer",
							placeholder: "Let's Encrypt, DigiCert, etc.",
							description: "The Certificate Authority that issued your SSL certificate (optional).",
						},
						warningDays: {
							label: "Alert Before Expiry",
							description: "Receive alerts this many days before the certificate expires.",
						},
					},
				},

				cancel: "Cancel",
				cta: "Save Changes",
			},

			ssl: {
				title: "SSL certificate monitoring",
				cta: "Save SSL settings",
			},

			dangerZone: {
				title: "Danger zone",
				delete: "Delete monitor",
			},
		},

		monitor: {
			header: {
				title: 'Monitor "{{name}}"',

				action: {
					play: "Run Monitor",
					running: "Running…",
					edit: "Edit Monitor",
					refresh: "Refresh",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			stats: {
				monitors: {
					label: "Monthly Pings Usage",
					value: "{{consumed}}<small> used</small>",
					description: "Out of {{estimated}} estimated",
					estimateUnavailable: "Estimate unavailable",
				},

				uptime: {
					label: "Uptime percentage",
					description: "Overall monitor uptime",
				},

				slowestResult: {
					label: "Slowest Result",
					description: "In the last 24 hours",
				},

				p99ResponseTime: {
					label: "P99 Response Time",
					value: "{{value}} ms",
					description: "p99, last 24h",
				},
			},

			heatmap: {
				tooltip: "{{date}}\n{{successRate}} success rate\n{{checks}} checks",
				legend: {
					success: "Success",
					failure: "Failure",
					mixed: "Mixed",
					noData: "No data",
				},
			},

			ssl: {
				title: "SSL Certificate",
				status: {
					valid: "Valid",
					expiring: "Expiring Soon",
					expired: "Expired",
					error: "Error",
					unknown: "Not Configured",
				},
				expiresAt: "Expires",
				expiresIn: "{{days}} days",
				issuer: "Issuer",
				lastChecked: "Last Checked",
				notConfigured: "SSL monitoring is not enabled for this monitor.",
				configure: "Configure SSL Monitoring",
			},
		},

		billing: {
			header: {
				title: "Billing",
			},
			ownerOnly: "Only the team owner can view and manage billing for this team.",
		},

		members: {
			header: {
				title: "Team Members",

				action: {
					invite: "Invite Member",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			sections: {
				members: {
					title: "Members",
					description: "Manage your team members and their roles.",
				},
			},

			membersTable: {
				label: "Current Members",
				description: "People who have access to this team.",

				columns: {
					name: "Name",
					role: "Team Role",
					actions: "Actions",
				},

				role: {
					member: "Member",
					admin: "Admin",
					owner: "Owner",
				},

				actions: {
					menu: "Actions Menu",
					remove: "Remove from Team",
					transfer: "Transfer Ownership",
					changeRole: {
						member: "Convert to Admin",
						admin: "Convert to Member",
						owner: "Can't change owner",
					},
				},

				confirmation: {
					removeMember: "Are you sure you want to remove {{name}} from the team?",
				},
			},

			invitedMembersTable: {
				label: "Pending Invitations",
				description: "People who have been invited but haven't joined yet.",

				columns: {
					email: "Email",
					actions: "Actions",
				},

				actions: {
					menu: "Actions Menu",
					copy: "Copy Invite Link",
					revoke: "Revoke Invite",
				},

				confirmation: {
					revokeInvite: "Are you sure you want to revoke {{email}}'s invite?",
				},
			},

			error: {
				forbidden: {
					title: "You do not have permission to access this page.",
					description: "Please contact your team administrator for assistance.",
				},

				unknown: {
					title: "An unexpected error occurred.",
					description: "Please try again later or contact support.",
				},
			},
		},

		invite: {
			header: {
				title: "Invite Team Member",
				description: "Send an invitation to join your team.",
			},

			dialog: {
				close: "Close dialog",
			},

			form: {
				fields: {
					email: {
						label: "Email Address",
						placeholder: "john.doe@example.com",
						description: "The email address of the person you want to invite to {{team}}.",
					},
				},

				cancel: "Cancel",
				cta: "Invite Member",
			},
		},

		acceptInvite: {
			errors: {
				pageTitle: "Invite unavailable",
				notFound: "This invite does not exist.",
				gone: "This invite has already been accepted.",
				forbidden: "This invite was not meant for you.",
				badRequest: "Somehow you don't have an email address. Try to login again.",
				wrongEmail: "This invite was sent to {{email}}. Sign in with that email to accept it.",
			},
		},

		domains: {
			header: {
				title: "Team Domains",
				action: { addDomain: "Add Domain" },
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			sections: {
				domains: {
					title: "Domains",
					description: "Manage verified domains for your team.",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "Domain",
						placeholder: "example.com",
						description: "The domain you want to add to {{team}}.",
					},
				},

				cta: "Add Domain",
			},

			table: {
				label: "Verified Domains",
				description: "Domains that can be used for auto-provisioning team members.",

				columns: {
					hostname: "Hostname",
					id: "Verification ID",
					verifiedAt: "Verified At",
					actions: "Actions",
				},

				verifiedAt: {
					pending: "Awaiting verification",
				},

				actions: {
					menu: "Actions Menu",
					copy: "Copy Verification ID",
					remove: "Remove Domain",
					retryVerification: "Retry Verification",
				},

				confirmation: {
					removeDomain: "Are you sure you want to remove {{hostname}} from the team?",
				},
			},

			instructions: {
				title: "How to verify your domain",

				description: "To verify your domain, add the following `TXT` record to your DNS settings:",

				record: {
					name: {
						label: "Name",
						value: "_ping-verification",
					},
					content: {
						label: "Content",
						value: "VERIFICATION_ID",
					},
				},

				note: "Make sure to replace <code>VERIFICATION_ID</code> with the actual verification ID shown above.",

				disclaimer:
					"DNS changes may take some time to propagate, so verification might be delayed.",
			},

			error: {
				forbidden: {
					title: "You do not have permission to access this page.",
					description: "Please contact your team administrator for assistance.",
				},

				unknown: {
					title: "An unexpected error occurred.",
					description: "Please try again later or contact support.",
				},
			},
		},

		alerts: {
			header: {
				title: "Alerts",

				action: {
					create: "Create Alert",
					history: "View History",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			empty: {
				title: "No alerts configured",
				description: "Create an alert to get notified when your monitors go down.",
				cta: "Create Alert",
			},

			limitReached: "This team has reached the limit of {{limit}} alerts.",

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "CTO Alert",
						description: "A name to identify the alert.",
					},

					scope: {
						label: "Scope",
						teamWide: "Team-wide (every monitor)",
					},

					channel: {
						label: "Channel",
						description: "The channel to use for the alert.",
						options: {
							webhook: "Webhook",
							email: "Email",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL",
								placeholder: "https://example.com/webhook",
								description: "The URL to send the alert payload to.",
							},
							secret: {
								label: "Signing secret (optional)",
								placeholder: "optional-secret",
								description:
									"An optional secret to include in the request headers. A `Webhook-Signature` header will be added with a HMAC SHA256 signature of the payload using this secret.",
							},
							signatureNote:
								"When set, requests carry a <code>Webhook-Signature: sha256=<hex></code> header — an HMAC-SHA256 of the raw JSON body using this secret.",
						},
						email: {
							to: {
								label: "Recipient",
								placeholder: "cto@example.com",
								description: "The email address to send the alert to.",
							},

							subjectPrefix: {
								label: "Subject prefix (optional)",
								placeholder: "[Uptime Alert]",
								description:
									"An optional prefix to add to the email subject. Useful to filter alerts in your inbox.",
							},
						},
						slack: {
							webhookUrl: {
								label: "Webhook URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"The Slack Incoming Webhook URL. Create one at api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Channel override (optional)",
								placeholder: "#alerts",
								description:
									"Optional channel to post to instead of the webhook default. Include the # prefix.",
							},
						},
						discord: {
							webhookUrl: {
								label: "Webhook URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"The Discord Webhook URL. Create one in Server Settings > Integrations > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notify on recovery",
						description:
							"Send an alert when the monitor recovers from a down state. Includes recovery time and downtime duration.",
					},

					cooldown: {
						label: "Alert Cooldown",
						description:
							"Minimum time between alerts of the same type. Prevents alert fatigue during ongoing outages.",
						options: {
							none: "No cooldown",
							"5min": "5 minutes",
							"15min": "15 minutes",
							"30min": "30 minutes",
							"1hour": "1 hour",
							"2hours": "2 hours",
							custom: "Custom",
						},
						custom: {
							label: "Custom Cooldown (minutes)",
							placeholder: "Enter minutes",
							description: "Enter the number of minutes between alerts.",
						},
					},

					cooldownMinutes: {
						label: "Cooldown (minutes, 0 = no cooldown)",
					},

					legends: {
						email: "Email settings",
						webhook: "Webhook settings",
						slack: "Slack settings",
						discord: "Discord settings",
					},
				},

				cta: "Create Alert",
			},

			table: {
				label: "Alerts",

				columns: {
					name: "Name",
					scope: "Scope",
					strategy: "Type",
					notifyOnRecovery: "Recovery",
					cooldown: "Cooldown",
					actions: "Actions",
				},

				scope: {
					unknownMonitor: "Unknown monitor",
					teamWide: "Team-wide",
				},

				cooldown: {
					none: "None",
					minutes: "{{count}} min",
					hours: "{{count}} hr",
				},

				actions: {
					menu: "Actions Menu",
					edit: "Edit Alert",
					remove: "Remove Alert",
				},

				types: {
					webhook: "Webhook",
					email: "Email",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "Yes",
					disabled: "No",
				},

				confirmation: {
					deleteAlert: "Are you sure you want to delete the alert {{name}}?",
				},
			},
		},

		statusPages: {
			header: {
				title: "Status Pages",

				action: {
					create: "Create Status Page",
				},
			},

			empty: {
				title: "No status pages yet",
				description: "Create a status page to share your system status with your users.",
				cta: "Create Status Page",
			},

			table: {
				label: "Status Pages",

				columns: {
					name: "Name",
					slug: "URL",
					services: "Services",
					monitors: "Monitors",
					visibility: "Visibility",
					actions: "Actions",
				},

				visibility: {
					public: "Public",
					private: "Private",
				},

				actions: {
					menu: "Actions Menu",
					view: "View Page",
					edit: "Edit Page",
					delete: "Delete Page",
				},

				confirmation: {
					delete: "Are you sure you want to delete the status page {{name}}?",
				},
			},

			form: {
				fields: {
					name: {
						label: "Internal Name",
						placeholder: "Production Status",
						description: "A name to identify the status page internally.",
					},
					slug: {
						label: "URL Slug",
						placeholder: "production",
						description: "The URL path for the public status page (e.g., /status/production).",
					},
					title: {
						label: "Public Title",
						placeholder: "Acme Inc. Status",
						description: "The title displayed on the public status page.",
					},
					description: {
						label: "Description",
						placeholder: "Current status of Acme Inc. services",
						description: "An optional description for the status page.",
					},
					logoUrl: {
						label: "Logo URL",
						placeholder: "https://example.com/logo.png",
						description: "An optional logo to display on the status page.",
					},
					isPublic: {
						label: "Public",
						description: "Make this status page accessible to anyone with the link.",
					},
					showOverallStatus: {
						label: "Show Overall Status",
						description: "Display an overall system status banner at the top of the page.",
					},
					monitors: {
						label: "Monitors to Include",
						description: "Select which monitors to display on this status page.",
					},
					cronJobs: {
						label: "Cron Jobs to Include",
						description: "Select which cron jobs to display on this status page.",
					},
				},

				cta: "Create Status Page",
				ctaUpdate: "Save Changes",
			},
		},

		createStatusPage: {
			header: {
				title: "Create Status Page",
			},
		},

		editStatusPage: {
			header: {
				title: "Edit Status Page",
			},
		},

		httpMonitors: {
			header: {
				title: "HTTP Monitors",
				action: {
					create: "Create Monitor",
				},
			},
			empty: {
				title: "No HTTP monitors yet",
				description: "Create an HTTP monitor to start tracking your endpoints.",
				cta: "Create Monitor",
			},
			table: {
				label: "HTTP Monitors",
				columns: {
					name: "Name",
					url: "URL",
					status: "Status",
					responseTime: "Response Time",
					lastChecked: "Last Checked",
					actions: "Actions",
				},
				neverChecked: "Never",
				disabled: "Disabled",
				actions: {
					menu: "Actions Menu",
					view: "View",
					edit: "Edit",
					delete: "Delete",
				},
				status: {
					up: "Up",
					down: "Down",
					degraded: "Degraded",
					unknown: "Unknown",
				},
				confirmation: {
					delete: "Are you sure you want to delete the monitor {{name}}?",
					deleteDescription:
						"This also deletes its content checks and check-result history. This can't be undone.",
				},
			},
		},

		dnsMonitors: {
			header: {
				title: "DNS Monitors",

				action: {
					create: "Create DNS Monitor",
				},
			},

			empty: {
				title: "No DNS monitors yet",
				description: "Create a DNS monitor to track DNS record changes.",
				cta: "Create DNS Monitor",
			},

			table: {
				label: "DNS Monitors",

				columns: {
					name: "Name",
					domain: "Domain",
					recordType: "Type",
					status: "Status",
					lastChecked: "Last Checked",
					actions: "Actions",
				},

				disabled: "Disabled",
				neverChecked: "Never",
				notChecked: "Not checked",

				actions: {
					menu: "Actions Menu",
					check: "Check Now",
					edit: "Edit",
					delete: "Delete",
				},

				confirmation: {
					delete: "Are you sure you want to delete the DNS monitor {{name}}?",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "Create DNS Monitor",
			},

			form: {
				fields: {
					name: {
						label: "Monitor Name",
						placeholder: "Production DNS",
						description: "A descriptive name for this DNS monitor.",
					},

					domain: {
						label: "Domain",
						placeholder: "example.com",
						description: "The domain to monitor DNS records for.",
					},

					recordType: {
						label: "Record Type",
						description: "The type of DNS record to check.",
					},

					expectedValue: {
						label: "Expected Value",
						placeholder: "192.168.1.1",
						description:
							"Optional. Alert if the resolved value doesn't match. Leave empty to track changes.",
					},

					interval: {
						label: "Check Interval",
						description: "How often to check the DNS record.",
						options: {
							"5m": "5 minutes",
							"15m": "15 minutes",
							"30m": "30 minutes",
							"1h": "1 hour",
							"6h": "6 hours",
							"12h": "12 hours",
							"24h": "24 hours",
						},
					},

					isEnabled: {
						label: "Enable monitoring",
						description: "Start monitoring this DNS record immediately.",
					},
				},

				cta: "Create DNS Monitor",
			},
		},

		editDnsMonitor: {
			header: {
				title: "Edit DNS Monitor",
			},

			form: {
				fields: {
					name: {
						label: "Monitor Name",
						placeholder: "Production DNS",
						description: "A descriptive name for this DNS monitor.",
					},

					domain: {
						label: "Domain",
						placeholder: "example.com",
						description: "The domain to monitor DNS records for.",
					},

					recordType: {
						label: "Record Type",
						description: "The type of DNS record to check.",
					},

					expectedValue: {
						label: "Expected Value",
						placeholder: "192.168.1.1",
						description:
							"Optional. Alert if the resolved value doesn't match. Leave empty to track changes.",
					},

					interval: {
						label: "Check Interval",
						description: "How often to check the DNS record.",
						options: {
							"5m": "5 minutes",
							"15m": "15 minutes",
							"30m": "30 minutes",
							"1h": "1 hour",
							"6h": "6 hours",
							"12h": "12 hours",
							"24h": "24 hours",
						},
					},

					isEnabled: {
						label: "Enable monitoring",
						description: "Whether to actively monitor this DNS record.",
					},
				},

				cancel: "Cancel",
				cta: "Save Changes",
			},

			dangerZone: {
				title: "Danger zone",
				deleteMonitor: "Delete monitor",
				deleteDescription: "This also deletes its check-result history. This can't be undone.",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: 'DNS Monitor "{{name}}"',

				action: {
					check: "Check Now",
					refresh: "Refresh",
					edit: "Edit",
				},
			},

			uptimeHistory: "Uptime history",
			notChecked: "Not checked",

			info: {
				domain: "Domain",
				recordType: "Record Type",
				status: "Status",
				expectedValue: "Expected Value",
				currentValue: "Current Value",
			},

			stats: {
				totalChecks: {
					label: "Total Checks",
					description: "Number of DNS checks performed",
				},

				successRate: {
					label: "Success Rate",
					description: "Percentage of successful checks",
				},

				avgResponseTime: {
					label: "Avg. Response Time",
					description: "Average DNS resolution time",
				},
			},

			results: {
				title: "Check History",
				empty: "No checks have been performed yet.",

				table: {
					columns: {
						checkedAt: "Checked At",
						status: "Status",
						value: "Value",
						responseTime: "Response Time",
					},
				},
			},
		},

		maintenance: {
			header: {
				title: "Maintenance Windows",

				action: {
					create: "Schedule Maintenance",
				},
			},

			empty: {
				title: "No maintenance windows",
				description: "Schedule maintenance windows to suppress alerts during planned downtime.",
				cta: "Schedule Maintenance",
			},

			tabs: {
				label: "Maintenance Status",
				active: "Active",
				upcoming: "Upcoming",
				past: "Past",
			},

			noActive: "No active maintenance windows",
			noUpcoming: "No upcoming maintenance windows",
			noPast: "No past maintenance windows",

			table: {
				columns: {
					name: "Name",
					schedule: "Schedule",
					monitor: "Monitor",
					status: "Status",
					actions: "Actions",
					scope: "Scope",
					starts: "Starts",
					ends: "Ends",
				},

				allMonitors: "All Monitors",
				recurring: "Recurring",
				unknownMonitor: "Unknown monitor",
				endedEarly: "Ended early",
				edit: "Edit",

				status: {
					active: "Active",
					upcoming: "Scheduled",
					past: "Completed",
				},

				actions: {
					menu: "Actions Menu",
					end: "End Now",
					delete: "Delete",
				},

				confirmation: {
					endMaintenance: "Are you sure you want to end '{{name}}' maintenance early?",
					deleteMaintenance: "Are you sure you want to delete '{{name}}'?",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "Schedule Maintenance",
			},

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "Database upgrade",
						description: "A description of the maintenance work.",
					},

					monitor: {
						label: "Monitor",
						description: "Select a specific monitor or leave empty for all monitors.",
						all: "All Monitors",
					},

					startsAt: {
						label: "Start Time",
						description: "When the maintenance window begins.",
					},

					duration: {
						label: "Duration",
						description: "How long the maintenance window lasts.",
						options: {
							"15m": "15 minutes",
							"30m": "30 minutes",
							"1h": "1 hour",
							"2h": "2 hours",
							"4h": "4 hours",
							"8h": "8 hours",
						},
					},

					suppressAlerts: {
						label: "Suppress alerts",
						description: "Don't send alerts during this maintenance window.",
					},

					showOnStatusPage: {
						label: "Show on status page",
						description: "Display a maintenance notice on public status pages.",
					},

					isRecurring: {
						label: "Recurring",
						description: "Repeat this maintenance window on a schedule.",
					},

					recurringPattern: {
						label: "Recurring Pattern",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"Pattern format: 'daily:HH:MM-HH:MM', 'weekly:dayOfWeek:HH:MM-HH:MM', or 'monthly:dayOfMonth:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "Maintenance window",
				},

				cta: "Schedule Maintenance",
			},
		},

		editMaintenance: {
			header: {
				title: "Edit {{name}}",
			},

			form: {
				cta: "Save changes",
				cancel: "Cancel",
			},

			endNow: {
				cta: "End maintenance now",
			},

			danger: {
				title: "Danger zone",

				delete: {
					trigger: "Delete maintenance window",
					confirmTitle: "Delete this maintenance window?",
					confirmDescription: "This can't be undone.",
					confirm: "Delete",
				},
			},
		},

		maintenanceWindows: {
			form: {
				fields: {
					name: {
						label: "Name",
					},

					scope: {
						label: "Scope",
						allMonitors: "All monitors",
					},

					startsAt: {
						label: "Starts at",
					},

					endsAt: {
						label: "Ends at",
					},

					suppressAlerts: {
						label: "Suppress alerts during this window",
					},

					showOnStatusPage: {
						label: "Show on status page",
					},

					recurring: {
						label: "Recurring",
					},

					recurringPattern: {
						label: "Recurrence pattern (when recurring)",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"daily:HH:MM-HH:MM, weekly:<day>:HH:MM-HH:MM, or monthly:<day-of-month>:HH:MM-HH:MM, in UTC.",
					},
				},
			},
		},

		alertHistory: {
			header: {
				title: "Alert History",
			},

			breadcrumbs: {
				alerts: "Alerts",
			},

			empty: {
				title: "No alert events yet",
				description:
					"Alert events will appear here when monitors trigger alerts. Configure alerts to get started.",
				cta: "View Alerts",
			},

			table: {
				label: "Alert Events",

				columns: {
					alert: "Alert",
					monitor: "Monitor",
					eventType: "Event",
					status: "Status",
					sentAt: "Time",
				},

				unknownAlert: "Unknown Alert",
				unknownMonitor: "Unknown Monitor",

				eventType: {
					down: "Down",
					up: "Recovered",
					degraded: "Degraded",
				},

				status: {
					sent: "Sent",
					skipped_cooldown: "Skipped (Cooldown)",
					skipped_cap: "Skipped (Repeat Limit)",
					// Fallback label for a suppression reason with no label of its own yet.
					skipped: "Skipped",
					failed: "Failed",
				},
			},
		},

		createAlert: {
			header: {
				title: "Create Alert",
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "CTO Alert",
						description: "A name to identify the alert.",
					},

					strategy: {
						label: "Strategy",
						description: "The strategy to use for the alert.",
						options: {
							webhook: "Webhook",
							email: "Email",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "Webhook URL",
								placeholder: "https://example.com/webhook",
								description: "The URL to send the alert payload to.",
							},
							secret: {
								label: "Secret",
								placeholder: "optional-secret",
								description:
									"An optional secret to include in the request headers. A `Webhook-Signature` header will be added with a HMAC SHA256 signature of the payload using this secret.",
							},
						},
						email: {
							to: {
								label: "Email Address",
								placeholder: "cto@example.com",
								description: "The email address to send the alert to.",
							},

							subjectPrefix: {
								label: "Subject Prefix",
								placeholder: "[Uptime Alert]",
								description:
									"An optional prefix to add to the email subject. Useful to filter alerts in your inbox.",
							},
						},
						slack: {
							webhookUrl: {
								label: "Slack Webhook URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"The Slack Incoming Webhook URL. Create one at api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Channel Override",
								placeholder: "#alerts",
								description:
									"Optional channel to post to instead of the webhook default. Include the # prefix.",
							},
						},
						discord: {
							webhookUrl: {
								label: "Discord Webhook URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"The Discord Webhook URL. Create one in Server Settings > Integrations > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notify on recovery",
						description:
							"Send an alert when the monitor recovers from a down state. Includes recovery time and downtime duration.",
					},

					cooldown: {
						label: "Alert Cooldown",
						description:
							"Minimum time between alerts of the same type. Prevents alert fatigue during ongoing outages.",
						options: {
							none: "No cooldown",
							"5min": "5 minutes",
							"15min": "15 minutes",
							"30min": "30 minutes",
							"1hour": "1 hour",
							"2hours": "2 hours",
							custom: "Custom",
						},
						custom: {
							label: "Custom Cooldown (minutes)",
							placeholder: "Enter minutes",
							description: "Enter the number of minutes between alerts.",
						},
					},
				},

				cta: "Create Alert",
			},
		},

		editAlert: {
			header: {
				title: "Edit Alert",
			},

			form: {
				cta: "Save changes",
				cancel: "Cancel",
			},

			danger: {
				title: "Danger zone",

				delete: {
					trigger: "Delete alert",
					confirmTitle: "Delete this alert?",
					confirmDescription: "This can't be undone.",
					confirm: "Delete",
				},
			},
		},

		logout: {
			title: "Are you sure you want to logout?",
			cta: "Logout",
		},

		trial: {
			meta: {
				title: "Check a URL — Uptime",
				description:
					"Run one real check on any URL from our network, with no account. Then have us watch it for a week.",
			},

			heading: "Check a URL right now",
			intro:
				"Type a URL and we run one real check on it from our network — the same check a paid monitor runs. Nothing is stored and nothing is billed unless you ask us to keep going.",

			form: {
				url: {
					label: "URL to check",
					description: "An http:// or https:// address on the public internet.",
					placeholder: "https://example.com",
				},
				submit: "Run the check",
			},

			refusal: {
				title: "The check did not run",
				blockedTarget:
					"That is not an address we will check on your behalf. It has to be a public http:// or https:// URL on port 80 or 443, carry no username or password, and resolve to somewhere on the open internet.",
				challengeIncomplete: "Complete the verification and we can run the check.",
				failedChallenge:
					"We could not confirm the request came from a browser. Reload the page and try again.",
				rateLimited: "You can run another check in a minute.",
				rateLimitedFor: "You can run another check in {{seconds}} seconds.",
				budgetExhausted:
					"We have already run every free check we run in a day. That is about us, not about your URL — come back tomorrow, or start monitoring and we will check it every minute.",
				unavailable:
					"Something on our side stopped the check before it ran, so we learned nothing about your URL. That is us and not you. Try again in a moment.",
			},

			result: {
				checkAnother: "Check another URL",
				noResponse: "No response",
				httpStatus: "HTTP {{status}}",
				milliseconds: "{{value}} ms",
				checkedAt: "Checked {{time}}",

				redirect: {
					badge: "Redirects",
					title: "This URL redirects somewhere else",
					description:
						"It answered, and it answered by pointing us at another address. We did not go there: we only check the URL you gave us, which is what keeps this box from being used to reach places it should not. Check the destination instead and you will get a real result for it.",
					destination: "It points at {{url}}",
					action: "Check that instead",
					unknownDestination:
						"We did not read where it points. Open the URL in a browser, see where you land, and check that address here.",
				},

				status: {
					up: "Up",
					degraded: "Slow",
					down: "Down",
				},
			},

			lead: {
				title: "Get an email when this changes",
				description:
					"Leave an email and we run this same check every hour for seven days, with one summary a day. No account and no card.",
				consent: "Also email me occasionally about Uptime itself.",
				consentNote: "Either way you get the checks.",
				promise: "Every email carries a one-click link that stops them and deletes your address.",
				submit: "Watch this URL for a week",

				email: {
					label: "Email",
					placeholder: "you@example.com",
					error: "That does not look like an email address.",
				},
			},

			monitor: {
				title: "Keep watching this URL",
				description:
					"Turn this one check into a monitor: the same check on your schedule, with an alert the moment it changes.",
				subscribeDescription:
					"Turn this one check into a monitor: the same check on your schedule, with an alert the moment it changes. It starts running once your subscription is active.",
				create: "Create a monitor for this URL",
				subscribe: "Start your subscription",
			},

			watching: {
				title: "We are on it",
				description:
					"The first hourly check on {{url}} runs in an hour. A copy of the check you just ran is already in your inbox.",
			},

			repeated: {
				title: "We have already checked this one",
				description:
					"{{url}} already had its free week from an earlier request — each URL gets one every 30 days. We have emailed you everything those checks found, so nothing new was started.",
			},

			benefits: {
				title: "What the week looks like",
				description:
					"Everything a paid monitor would tell you about this URL, free, for seven days.",

				list: {
					hourly: {
						title: "A check every hour",
						description: "For seven days, from the same network a paid monitor runs on.",
					},
					changes: {
						title: "An email when it changes",
						description:
							"Up or down, you hear about it. At most one a day, so a flapping site cannot flood you.",
					},
					digest: {
						title: "One summary a day",
						description: "How your URL held up, at a glance.",
					},
					noAccount: {
						title: "No account, no card",
						description: "Nothing to sign up for, and one click stops it for good.",
					},
				},
			},

			more: {
				title: "Not just websites",
				description:
					"The free week covers HTTP. A paid account keeps an eye on three more things for you.",

				list: {
					tcp: {
						title: "TCP",
						description:
							"Know a port is still answering, for the things that are not websites: databases, mail servers, game servers.",
					},
					dns: {
						title: "DNS",
						description:
							"Know a record still points where it should, so a hijack or a botched change does not go unnoticed.",
					},
					cron: {
						title: "Cron jobs",
						description:
							"Know your nightly backup finished, and hear about it on the night it does not.",
					},
				},
			},

			cta: {
				badge: "After the week",
				title: "Keep the checks, add the rest",
				description:
					"Every minute instead of every hour, as many URLs as you like, alerts wherever you already work, status pages, and a year of history. {{price}} a month.",
				action: "Start monitoring",
				pricing: "See pricing",
			},
		},

		unsubscribe: {
			confirm: {
				title: "Stop these emails?",
				body: "This ends every check that address asked for and deletes the address along with everything recorded against it. Nothing is kept, so there is nothing to undo — but you can start again from our website whenever you like.",
				cta: "Yes, stop and delete",
			},

			done: {
				title: "You are unsubscribed",
				body: "That address is no longer on our list and any checks it asked for have stopped. Nothing further will be sent to it. You can start again from our website whenever you like.",
				cta: "Back to the site",
			},
		},
		splat: {
			notFound: {
				title: "Not Found",
				description: "The page you are looking for does not exist.",
			},
		},

		account: {
			meta: {
				title: "Account - Uptime",
				description: "Manage your account settings and teams.",
			},

			header: {
				title: "Account",
			},

			form: {
				actions: {
					cancel: "Cancel",
				},
			},

			profile: {
				title: "Profile",
				description: "Your personal information.",

				card: {
					title: "Profile Details",
					description: "Your name, email address, and avatar.",
				},
			},

			language: {
				title: "Language Preference",
				description: "Choose your preferred language for the interface.",

				card: {
					title: "Language",
					description: "Applies across the dashboard and email notifications.",
				},

				form: {
					fields: {
						language: {
							label: "Preferred Language",
							description:
								"Select your preferred language. Auto-detect uses your browser settings.",
							options: {
								auto: "Auto-detect",
								en: "English",
								es: "Espanol",
								de: "Deutsch",
								ja: "Japanese",
								fr: "Francais",
								it: "Italiano",
							},
						},
					},

					cta: "Save Language",
				},
			},

			teams: {
				title: "Your Teams",
				description: "Teams you are a member of.",

				actions: {
					createTeam: "Create Team",
				},

				empty: {
					title: "No teams yet",
					description: "Create a team to start monitoring your services.",
					cta: "Create Team",
				},

				table: {
					label: "Teams",
					description: "All teams you belong to.",

					columns: {
						team: "Team",
						role: "Role",
						actions: "Actions",
					},

					role: {
						member: "Member",
						admin: "Admin",
						owner: "Owner",
					},

					actions: {
						menu: "Actions Menu",
						leave: "Leave Team",
					},

					confirmation: {
						leaveTeam: "Are you sure you want to leave {{name}}?",
					},
				},
			},
		},

		createTeam: {
			header: {
				title: "Create Team",
				description: "Create a new team to monitor your services.",
			},

			dialog: {
				close: "Close dialog",
			},

			form: {
				fields: {
					name: {
						label: "Team Name",
						placeholder: "My Awesome Team",
						description: "Choose a name for your new team.",
					},
				},

				cancel: "Cancel",
				cta: "Create Team",
			},
		},

		settings: {
			header: {
				title: "Team Settings",
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			sections: {
				general: {
					title: "General",
					description: "Manage your team's basic information.",
				},
			},

			form: {
				card: {
					title: "Team Profile",
					description: "Update your team's name and logo.",
				},

				fields: {
					logo: {
						label: "Logo URL",
						placeholder: "https://example.com/logo.png",
						description: "A URL to your team's logo image.",
					},
					name: {
						label: "Team Name",
						placeholder: "My Team",
						description: "The name of your team.",
					},
				},

				actions: {
					cancel: "Cancel",
					save: "Save Changes",
				},
			},

			members: {
				title: "Members",
				description: "Manage your team members and their roles.",

				actions: {
					invite: "Invite Member",
				},

				table: {
					label: "Current Members",
					description: "People who have access to this team.",

					columns: {
						name: "Name",
						role: "Role",
						actions: "Actions",
					},

					role: {
						member: "Member",
						admin: "Admin",
						owner: "Owner",
					},

					actions: {
						menu: "Actions Menu",
						remove: "Remove from Team",
						transfer: "Transfer Ownership",
						changeRole: {
							member: "Convert to Admin",
							admin: "Convert to Member",
							owner: "Can't change owner",
						},
					},

					confirmation: {
						removeMember: "Are you sure you want to remove {{name}} from the team?",
					},
				},

				invitedTable: {
					label: "Pending Invitations",
					description: "People who have been invited but haven't joined yet.",

					columns: {
						email: "Email",
						expires: "Expires",
						actions: "Actions",
					},

					expires: {
						expired: "Expired",
					},

					actions: {
						menu: "Actions Menu",
						copy: "Copy Invite Link",
						revoke: "Revoke Invite",
					},

					confirmation: {
						revokeInvite: "Are you sure you want to revoke {{email}}'s invite?",
					},

					empty: {
						description: "No pending invitations.",
					},
				},
			},

			domains: {
				title: "Domains",
				description: "Manage verified domains for your team.",

				actions: {
					addDomain: "Add Domain",
				},

				table: {
					label: "Verified Domains",
					description: "Domains that can be used for auto-provisioning team members.",

					columns: {
						hostname: "Hostname",
						id: "Verification ID",
						verifiedAt: "Verified At",
						actions: "Actions",
					},

					verifiedAt: {
						pending: "Awaiting verification",
					},

					actions: {
						menu: "Actions Menu",
						copy: "Copy Verification ID",
						remove: "Remove Domain",
						retryVerification: "Retry Verification",
					},

					confirmation: {
						removeDomain: "Are you sure you want to remove {{hostname}} from the team?",
					},

					empty: {
						description: "No verified domains yet.",
					},
				},

				form: {
					title: "Add Domain",

					fields: {
						hostname: {
							label: "Domain",
							placeholder: "example.com",
							description: "The domain you want to add to {{team}}.",
						},
					},

					cta: "Add Domain",
				},

				instructions: {
					title: "How to verify your domain",
					description: "To verify your domain, add the following TXT record to your DNS settings:",

					record: {
						name: {
							label: "Name",
							value: "_ping-verification",
						},
						content: {
							label: "Content",
							value: "VERIFICATION_ID",
						},
					},

					note: "Make sure to replace <code>VERIFICATION_ID</code> with the actual verification ID shown above.",
					disclaimer:
						"DNS changes may take some time to propagate, so verification might be delayed.",
				},
			},

			billing: {
				title: "Billing",
				description: "Manage your subscription and payment details.",

				card: {
					title: "Subscription & Payments",
					description: "View invoices, update payment methods, and manage your subscription.",
					notice:
						"You will be redirected to Polar's customer portal to manage your billing settings.",
					cta: "Open Billing Portal",
				},
			},

			danger: {
				title: "Danger Zone",
				description: "Irreversible actions that affect your team.",

				card: {
					title: "Delete Team",
					description:
						"Permanently delete this team and all of its data. This action cannot be undone.",
					warning:
						"This will cancel your subscription and delete all monitors, alerts, domains, members, and invites.",
					confirmation: {
						label: "Type DELETE to confirm",
						placeholder: "DELETE",
					},
					cta: "Delete Team",
				},
			},

			error: {
				forbidden: {
					title: "You do not have permission to access this page.",
					description: "Please contact your team administrator for assistance.",
				},

				unknown: {
					title: "An unexpected error occurred.",
					description: "Please try again later or contact support.",
				},
			},
		},

		tcpMonitors: {
			header: {
				title: "TCP Monitors",
				action: {
					create: "Create TCP Monitor",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
				limitation: {
					title: "TCP Monitoring Limitation",
					description:
						"TCP port monitoring requires Cloudflare Workers paid plan with socket support. On the free plan, TCP checks will show as unavailable. Consider using HTTP monitoring as an alternative.",
				},
			},

			empty: {
				title: "No TCP monitors yet",
				description: "Create a TCP monitor to check if ports are open and responsive.",
				cta: "Create TCP Monitor",
			},

			table: {
				label: "TCP Monitors",
				columns: {
					name: "Name",
					endpoint: "Host:Port",
					status: "Status",
					lastChecked: "Last Checked",
					responseTime: "Response Time",
					actions: "Actions",
				},
				status: {
					up: "Up",
					down: "Down",
					timeout: "Timeout",
					disabled: "Disabled",
					pending: "Pending",
				},
				actions: {
					edit: "Edit",
					delete: "Delete",
					confirmation: {
						delete: "Are you sure you want to delete {{name}}?",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "Create TCP Monitor",
				breadcrumb: {
					tcpMonitors: "TCP Monitors",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor Name",
						placeholder: "Database Server",
						description: "A descriptive name for this TCP monitor.",
					},
					host: {
						label: "Host",
						placeholder: "db.example.com",
						description: "The hostname or IP address to monitor.",
					},
					port: {
						label: "Port",
						placeholder: "5432",
						description: "The TCP port to check (1-65535).",
						decrement: "Decrease port",
						increment: "Increase port",
					},
					interval: {
						label: "Check Interval",
						description: "How often to check the port.",
						decrement: "Decrease check interval",
						increment: "Increase check interval",
					},
					timeout: {
						label: "Connection Timeout",
						description: "How long to wait for a connection before timing out.",
						decrement: "Decrease connection timeout",
						increment: "Increase connection timeout",
					},
				},
				cta: "Create Monitor",
			},
		},

		editTcpMonitor: {
			header: {
				title: "Edit TCP Monitor",
				breadcrumb: {
					tcpMonitors: "TCP Monitors",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor Name",
						placeholder: "Database Server",
						description: "A descriptive name for this TCP monitor.",
					},
					host: {
						label: "Host",
						placeholder: "db.example.com",
						description: "The hostname or IP address to monitor.",
					},
					port: {
						label: "Port",
						placeholder: "5432",
						description: "The TCP port to check (1-65535).",
						decrement: "Decrease port",
						increment: "Increase port",
					},
					interval: {
						label: "Check Interval",
						description: "How often to check the port.",
						decrement: "Decrease check interval",
						increment: "Increase check interval",
					},
					timeout: {
						label: "Connection Timeout",
						description: "How long to wait for a connection before timing out.",
						decrement: "Decrease connection timeout",
						increment: "Increase connection timeout",
					},
					isEnabled: {
						label: "Enable monitoring",
					},
				},
				cancel: "Cancel",
				cta: "Save Changes",
			},

			danger: {
				title: "Danger zone",
				cta: "Delete monitor",
				description: "This also deletes its check-result history. This can't be undone.",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "TCP Monitors",
				},
				action: {
					edit: "Edit",
					checkNow: "Check now",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			info: {
				title: "Monitor Configuration",
				endpoint: "Endpoint",
				status: "Status",
				interval: "Check Interval",
				timeout: "Timeout",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "Based on recent checks",
				},
				avgResponseTime: {
					label: "Avg Response Time",
					description: "Average connection time",
				},
				totalChecks: {
					label: "Total Checks",
					description: "Number of checks performed",
				},
			},

			history: {
				title: "Uptime history",
			},

			results: {
				title: "Check History",
				description: "Recent TCP connection check results",
				label: "Results",
				empty: "No check results yet. Results will appear after the first check runs.",
				columns: {
					time: "Time",
					status: "Status",
					responseTime: "Response Time",
					error: "Error",
				},
			},
		},

		apiKeys: {
			header: {
				title: "API Keys",
				action: {
					create: "Create API Key",
				},
			},

			docsLink: {
				text: "Learn how to use API keys in our",
				link: "documentation",
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			empty: {
				title: "No API keys yet",
				description: "Create an API key to access the Uptime API programmatically.",
				cta: "Create API Key",
			},

			newKey: {
				title: "API Key '{{name}}' created!",
				description: "Copy this key now. For security reasons, you won't be able to see it again.",
				dismiss: "I've copied my key",
				copyLabel: "Copy key",
			},

			form: {
				title: "Create New API Key",
				description:
					"Create an API key to access the Uptime API. See the <link>documentation</link> for usage examples.",

				fields: {
					name: {
						label: "Key Name",
						placeholder: "Production API Key",
						description: "A name to identify this API key.",
					},
					scopes: {
						label: "Permissions",
						description: "Select what this API key can access.",
						descriptions: {
							"teams:read": "Read the team's name and logo, and list its members and their roles.",
							"teams:write":
								"Change the team's name and logo. It cannot add or remove members, or delete the team.",
							"invites:read":
								"List the team's invites, pending and accepted, including the email address each one was sent to.",
							"invites:write":
								"Invite an email address to the team and revoke an existing invite. Whoever accepts an invite becomes a member.",
							"team-domains:read":
								"List the domains claimed by the team and whether each one is verified.",
							"team-domains:write":
								"Claim a domain for the team, or remove one. Once a domain is verified, anyone signing up with an email at it joins the team automatically.",
							"monitors:read":
								"List and read HTTP monitors, their check results, their uptime stats and the team's overall status.",
							"monitors:write":
								"Create, update and delete HTTP monitors and their content checks. It can also queue a rebuild of the daily stats.",
							"maintenance:read": "List and read the team's maintenance windows.",
							"maintenance:write":
								"Create, update, end early and delete maintenance windows. A running window can suppress alerts for the monitors it covers.",
							"dns-monitors:read":
								"List and read DNS monitors and the resolution results they recorded.",
							"dns-monitors:write": "Create, update and delete DNS monitors.",
							"tcp-monitors:read":
								"List and read TCP monitors and the connection results they recorded.",
							"tcp-monitors:write": "Create, update and delete TCP monitors.",
							"alerts:read":
								"List and read alerts and the events they fired. Webhook URLs and other channel secrets are never returned.",
							"alerts:write":
								"Create, update and delete alerts, including their webhook and chat destinations. Deleting an alert stops every notification it was sending.",
							"status-pages:read":
								"List and read the team's status pages and the monitors attached to each one.",
							"status-pages:write":
								"Create, update and delete status pages, and replace the set of monitors and cron jobs a page shows publicly.",
							"cron-jobs:read": "List and read the team's cron jobs and their schedules.",
							"cron-jobs:write":
								"Create, update and delete cron jobs. Deleting one stops its ping URL from being accepted.",
							"cron-jobs:ping":
								"Listed for the cron job ping URL, which is public and checks no scope. Granting it gives a key no access it doesn't already have.",
							"api-keys:read":
								"List the team's API keys with their names, prefixes, scopes and expiry. The secret key itself is never returned.",
							"api-keys:write":
								"Create and delete the team's API keys. A new key can be given any scope, so this one can grant every other permission.",
							"ping:trigger":
								"Run one-off HTTP, DNS and TCP checks without creating a monitor. Each check is billed as one ping and needs an active subscription.",
						} satisfies Record<ApiKeyScope, string>,
					},
					expiresAt: {
						label: "Expiration Date (Optional)",
						description: "Leave empty for a key that never expires.",
					},
				},

				actions: {
					cancel: "Cancel",
					create: "Create API Key",
				},
			},

			table: {
				label: "API Keys",

				columns: {
					name: "Name",
					prefix: "Key",
					scopes: "Permissions",
					lastUsed: "Last Used",
					expires: "Expires",
					actions: "Actions",
				},

				lastUsed: {
					never: "Never",
				},

				expires: {
					never: "Never",
				},

				actions: {
					menu: "Actions Menu",
					delete: "Delete Key",
				},

				confirmation: {
					delete:
						"Are you sure you want to delete the API key '{{name}}'? This action cannot be undone.",
				},
			},

			error: {
				forbidden: {
					title: "You do not have permission to access this page.",
					description: "Please contact your team administrator for assistance.",
				},

				unknown: {
					title: "An unexpected error occurred.",
					description: "Please try again later or contact support.",
				},
			},
		},

		cronJobs: {
			header: {
				title: "Cron Jobs",
				action: {
					create: "Create Cron Job",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			empty: {
				title: "No cron jobs yet",
				description: "Create a cron job monitor to track your scheduled tasks.",
				cta: "Create Cron Job",
			},

			table: {
				label: "Cron Job Monitors",
				columns: {
					name: "Name",
					schedule: "Schedule",
					status: "Status",
					lastPing: "Last Ping",
					nextExpected: "Next Expected",
					actions: "Actions",
				},
				status: {
					healthy: "Healthy",
					late: "Late",
					missed: "Missed",
					new: "New",
				},
				disabled: "Disabled",
				actions: {
					edit: "Edit",
					delete: "Delete",
					confirmation: {
						delete: "Are you sure you want to delete {{name}}?",
					},
				},
			},
		},

		createCronJob: {
			header: {
				title: "Create Cron Job",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "Daily Backup Job",
						description: "A descriptive name for this cron job monitor.",
					},
					description: {
						label: "Description",
						placeholder: "Optional description of what this job does",
						description: "An optional description to help identify this cron job.",
					},
					cronExpression: {
						label: "Cron Expression",
						placeholder: "0 * * * *",
						description: "The cron schedule expression (e.g., '0 * * * *' for every hour).",
					},
					gracePeriod: {
						label: "Grace Period",
						description: "How long to wait after the expected time before marking as late.",
						decrement: "Decrease grace period",
						increment: "Increase grace period",
						unit: {
							minutes: "minutes",
							seconds: "seconds",
						},
					},
					timezone: {
						label: "Timezone",
						placeholder: "Select timezone",
						description: "The timezone for the cron schedule.",
					},
					alertOnLate: {
						label: "Alert on Late",
						description: "Send an alert when the job misses its expected time.",
					},
					enabled: {
						label: "Enabled",
						description: "Start monitoring this cron job immediately.",
					},
				},
				cta: "Create Cron Job",
			},
		},

		editCronJob: {
			header: {
				title: "Edit Cron Job",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "Daily Backup Job",
						description: "A descriptive name for this cron job monitor.",
					},
					description: {
						label: "Description",
						placeholder: "Optional description of what this job does",
						description: "An optional description to help identify this cron job.",
					},
					cronExpression: {
						label: "Cron Expression",
						placeholder: "0 * * * *",
						description: "The cron schedule expression (e.g., '0 * * * *' for every hour).",
					},
					gracePeriod: {
						label: "Grace Period",
						description: "How long to wait after the expected time before marking as late.",
						decrement: "Decrease grace period",
						increment: "Increase grace period",
						unit: {
							minutes: "minutes",
							seconds: "seconds",
						},
					},
					timezone: {
						label: "Timezone",
						placeholder: "Select timezone",
						description: "The timezone for the cron schedule.",
					},
					alertOnLate: {
						label: "Alert on Late",
						description: "Send an alert when the job misses its expected time.",
					},
					enabled: {
						label: "Enabled",
						description: "Whether to actively monitor this cron job.",
					},
				},
				cancel: "Cancel",
				cta: "Save Changes",
			},

			danger: {
				title: "Danger zone",

				delete: {
					trigger: "Delete monitor",
					confirmTitle: "Delete this cron job monitor?",
					confirmDescription: "This also deletes its ping history. This can't be undone.",
					confirm: "Delete",
				},
			},
		},

		cronJobDetail: {
			header: {
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
				action: {
					edit: "Edit",
					delete: "Delete",
				},
			},

			alert: {
				subscription: {
					title: "Your monitors are paused!",
					description: "A subscription is required to continue monitoring automatically.",
					cta: "Start Monitoring",
				},
			},

			info: {
				title: "Cron Job Configuration",
				schedule: "Schedule",
				timezone: "Timezone",
				status: "Status",
				gracePeriod: "Grace Period",
				gracePeriodValue: "{{duration}} grace",
				description: "Description",
			},

			stats: {
				totalPings: {
					label: "Total Pings",
					description: "Number of pings received",
				},
				onTimeRate: {
					label: "On-Time Rate",
					description: "Percentage of on-time pings",
				},
				lastPing: {
					label: "Last Ping",
					description: "When the last ping was received",
					never: "Never",
				},
				nextExpected: {
					label: "Next Expected",
					description: "When the next ping is expected",
				},
			},

			ping: {
				title: "Ping this monitor",
				description:
					"Have your job send a POST request here after it finishes, with an API key carrying the `cron-jobs:ping` scope.",
				snippet: {
					curl: "From a script",
					copyCurl: "Copy command",
					crontab: "From crontab",
					copyCrontab: "Copy crontab line",
				},
				apiKey: {
					text: "Without a key carrying that scope the ping is rejected with a 401, and the run still counts as missed.",
					cta: "Create an API key",
				},
			},

			uptimeHistory: "Uptime history",

			pings: {
				title: "Ping History",
				description: "Recent pings received from this cron job",
				empty: "No pings received yet. Pings will appear here after your job sends its first ping.",
				label: "Pings",
				columns: {
					time: "Time",
					status: "Status",
					sourceIp: "Source IP",
				},
				status: {
					onTime: "On Time",
					late: "Late",
				},
			},

			integration: {
				title: "Integration Instructions",
				description: "Send a POST request to this endpoint when your cron job completes.",
				endpoint: "Ping Endpoint",
				curlExample: "cURL Example",
				codeExamples: {
					title: "Code Examples",
					bash: "Bash / Cron",
					python: "Python",
					nodejs: "Node.js",
				},
				apiKeyNote:
					"You need an API key with the 'cron-jobs:ping' scope. Create one in API Keys settings.",
			},

			delete: {
				confirmation: "Are you sure you want to delete {{name}}? This action cannot be undone.",
			},
		},
	},

	docs: {
		meta: {
			title: "Documentation - Uptime",
			description:
				"Documentation for Uptime monitoring service. Learn how to use monitors, alerts, status pages, and more.",
		},

		header: {
			cta: {
				in: "Open Dashboard",
				out: "Start Monitoring",
			},
		},

		sidebar: {
			title: "Documentation",
			description: "Guides and reference",
			searchPlaceholder: "Search...",
			openMenu: "Open menu",
			closeMenu: "Close menu",
		},

		nav: {
			gettingStarted: "Getting Started",
			overview: "Overview",
			quickstart: "Quickstart",

			api: "API Reference",
			apiOverview: "API Overview",
			authentication: "Authentication",
			errors: "Errors",

			resources: "Resources",
			monitors: "Monitors",
			dnsMonitors: "DNS Monitors",
			tcpMonitors: "TCP Monitors",
			cronJobs: "Cron Jobs",
			alerts: "Alerts",
			statusPages: "Status Pages",
		},

		error: {
			title: "Documentation Error",
			description: "There was an error loading this documentation page.",
			notFoundTitle: "Page Not Found",
			notFoundDescription: "The documentation page you're looking for doesn't exist.",
		},

		lastUpdated: "Last updated: {{date}}",
	},
};
