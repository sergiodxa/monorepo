export default {
	landing: {
		meta: {
			title: "Uptime by Sergio Xalambrí",
			description: "Simple & reliable uptime monitoring for developers",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "Pricing",
				features: "Features",

				cta: {
					in: "Open Dashboard",
					out: "Start Monitoring",
				},
			},
		},

		hero: {
			pill: "Monitor your services with confidence",
			title: "Monitor your services <strong>with confidence</strong>",
			description:
				"Get instant alerts when your websites and APIs go down. Monitor your websites and APIs with ease.",

			cta: {
				in: "Open Dashboard",
				out: "Start Monitoring",
				demo: "View Demo",
			},

			screenshot: {
				alt: "Screenshot of an uptime monitoring dashboard showing two services with weekly heatmap charts. Each dot represents a check: green for success, yellow for mixed, red for failure, and gray for no data. Each monitor also displays uptime percentage, total checks, last check time, and 99th percentile response time",
			},
		},

		features: {
			title: "Powerful Monitoring Made Simple",
			description:
				"Everything you need to keep your services running smoothly, with no unnecessary complexity.",

			list: {
				first: {
					title: "Monitor your uptime",
					description:
						"Track your services 24/7 with 99.9% monitoring reliability. Get detailed metrics and performance insights at a glance.",
				},
				second: {
					title: "Receive alerts anywhere",
					description:
						"Get instant notifications via webhooks wherever you want, when your services experience downtime or performance issues.",
				},
				third: {
					title: "Pay for what you use",
					description:
						"Transparent pricing with no hidden fees. Scale up or down as needed, with plans that grow with your monitoring needs.",
				},
			},
		},

		pricing: {
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
					q: "Is there a free trial?",
					a: "Sort of, you can create unlimited monitors and trigger pings manually for free. Scheduled automatic pings require a subscription.",
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
					a: "You can make monitors public and share your team's monitor list. A proper status page feature is in the roadmap.",
				},

				fourteenth: {
					q: "Can I view historical performance trends?",
					a: "We store all past results so you get a full history. Performance trend charts are planned for a future release.",
				},

				fifteenth: {
					q: "Which alert channels are supported?",
					a: "Currently only webhooks. You can use them to integrate with any alerting system. Direct integrations like Slack, email, or others are in the roadmap. Let us know which ones you need.",
				},

				sixteenth: {
					q: "Do you support teams or shared monitors?",
					a: "Each user starts with a team. Inviting other members is not available yet but is planned, along with user auto provisioning.",
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
			links: {
				privacy: "Privacy",
				terms: "Terms of Service",
				security: "Security",
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
						monitors: "Monitors",
						settings: "Settings",
						billing: "Billing",
						domains: "Domains",
						members: "Members",
						team: "Team",
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
					deleteMonitor: "Are you sure you want to delete the monitor {{name}}?",
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
				},

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
					},
				},

				cta: "Create Alert",
			},

			table: {
				label: "Alerts",

				columns: {
					name: "Name",
					strategy: "Type",
					actions: "Actions",
				},

				actions: {
					menu: "Actions Menu",
					edit: "Edit Alert",
					remove: "Remove Alert",
				},

				types: {
					webhook: "Webhook",
					email: "Email",
				},

				confirmation: {
					deleteAlert: "Are you sure you want to delete the alert {{name}}?",
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
	},
};
