export default {
	landing: {
		meta: {
			title: "Uptime by Sergio Xalambrí",
			description: "Simple & reliable uptime monitoring for developers",
		},

		header: {
			title: "Uptime",

			nav: {
				features: "Features",
				pricing: "Pricing",

				cta: {
					in: "Open Dashboard",
					out: "Start Monitoring",
				},
			},
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

			screenshot: {
				alt: "Screenshot of an uptime monitoring dashboard showing two services with weekly heatmap charts. Each dot represents a check: green for success, yellow for mixed, red for failure, and gray for no data. Each monitor also displays uptime percentage, total checks, last check time, and 99th percentile response time",
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
						description: "$5/month includes your first 5,000 pings",
					},

					second: {
						title: "Additional pings",
						description: "$0.001 per ping after the first 5,000",
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
					additionalPingsCost: "{{pings}} × {{costPerPing}}",
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
					a: "You will be charged $1 for every 1,000 pings above the 5,000 included in your subscription.",
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
				legal: {
					title: "Legal",
					terms: "Terms of Service",
					privacy: "Privacy Policy",
				},
			},
		},
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
						statusPages: "Status Pages",
						tcpMonitors: "TCP Monitors",
						dnsMonitors: "DNS Monitors",
						cronJobs: "Cron Jobs",
						settings: "Settings",
						billing: "Billing",
						domains: "Domains",
						members: "Members",
						team: "Team",
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
			p99ResponseTime: "P99 Response Time",
			p99ResponseTimeValue: "{{value}}",
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
		heatmap: {
			daysAgo: "30 days ago",
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
			caseSensitive: "Case sensitive",
			disabled: "Disabled",
			delete: "Delete",
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
				p99ResponseTime: "P99 Response Time",
				p99ResponseTimeValue: "{{value}} ms",
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
				invalidCron: "Invalid cron expression.",
			},
			success: "{{name}} cron job was created.",
		},

		updateCronJob: {
			errors: {
				generic: "Oops! Something went wrong while updating the cron job.",
				notFound: "This cron job does not exist.",
				invalidCron: "Invalid cron expression.",
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
		},

		monitor: {
			header: {
				title: 'Monitor "{{name}}"',

				action: {
					play: "Run Monitor",
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
				},

				uptime: {
					label: "Uptime percentage",
					description: "Overall monitor uptime",
				},

				slowestResult: {
					label: "Slowest Result",
					description: "In the last 24 hours",
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
				notFound: "This invite does not exist.",
				gone: "This invite has already been accepted.",
				forbidden: "This invite was not meant for you.",
				badRequest: "Somehow you don't have an email address. Try to login again.",
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

			table: {
				label: "Alerts",

				columns: {
					name: "Name",
					strategy: "Type",
					notifyOnRecovery: "Recovery",
					cooldown: "Cooldown",
					actions: "Actions",
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
				},

				allMonitors: "All Monitors",
				recurring: "Recurring",

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

		logout: {
			title: "Are you sure you want to logout?",
			cta: "Logout",
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

			profile: {
				title: "Profile",
				description: "Your personal information.",
			},

			language: {
				title: "Language Preference",
				description: "Choose your preferred language for the interface.",

				form: {
					fields: {
						language: {
							label: "Language",
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
					},
					interval: {
						label: "Check Interval",
						description: "How often to check the port.",
					},
					timeout: {
						label: "Connection Timeout",
						description: "How long to wait for a connection before timing out.",
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
					},
					interval: {
						label: "Check Interval",
						description: "How often to check the port.",
					},
					timeout: {
						label: "Connection Timeout",
						description: "How long to wait for a connection before timing out.",
					},
					isEnabled: {
						label: "Enable monitoring",
					},
				},
				cancel: "Cancel",
				cta: "Save Changes",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "TCP Monitors",
				},
				action: {
					edit: "Edit",
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
			},

			form: {
				title: "Create New API Key",
				description: "API keys allow programmatic access to your monitors and alerts.",

				fields: {
					name: {
						label: "Key Name",
						placeholder: "Production API Key",
						description: "A name to identify this API key.",
					},
					scopes: {
						label: "Permissions",
						description: "Select what this API key can access.",
						options: {
							"monitors:read": "Read Monitors",
							"monitors:write": "Write Monitors",
							"alerts:read": "Read Alerts",
							"alerts:write": "Write Alerts",
							"cron-jobs:read": "Read Cron Jobs",
							"cron-jobs:write": "Write Cron Jobs",
							"cron-jobs:ping": "Ping Cron Jobs",
						},
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
					preset: {
						label: "Common Presets",
						description: "Select a common schedule or enter a custom expression.",
						options: {
							custom: "Custom",
							everyMinute: "Every minute",
							every5Minutes: "Every 5 minutes",
							every15Minutes: "Every 15 minutes",
							everyHour: "Every hour",
							everyDay: "Every day at midnight",
							everyWeek: "Every week (Sunday midnight)",
						},
					},
					gracePeriod: {
						label: "Grace Period",
						description: "How long to wait after the expected time before marking as late.",
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
					preset: {
						label: "Common Presets",
						description: "Select a common schedule or enter a custom expression.",
						options: {
							custom: "Custom",
							everyMinute: "Every minute",
							every5Minutes: "Every 5 minutes",
							every15Minutes: "Every 15 minutes",
							everyHour: "Every hour",
							everyDay: "Every day at midnight",
							everyWeek: "Every week (Sunday midnight)",
						},
					},
					gracePeriod: {
						label: "Grace Period",
						description: "How long to wait after the expected time before marking as late.",
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
				},
				nextExpected: {
					label: "Next Expected",
					description: "When the next ping is expected",
				},
			},

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
};
