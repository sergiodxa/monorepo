/**
 * Every string Pulse shows or announces, gathered in one place the way a real app keeps its
 * translations: one status vocabulary, Verb + Noun buttons, and past-tense toasts that echo
 * the button that raised them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	AppShell,
	DetailSheet,
	FilterBar,
	RangePicker,
	SelectionBar,
	SettingsLayout,
	ViewOptions,
} from "@sdxc/ui/app";

import type { IncidentStatus, ServiceStatus, ServiceTrend } from "./data";

/** The status words and the tone each one draws in, fixed across every screen. */
export const STATUS: Record<
	ServiceStatus,
	{ label: string; color: "success" | "warning" | "danger" | "neutral" }
> = {
	up: { label: "Up", color: "success" },
	degraded: { label: "Degraded", color: "warning" },
	down: { label: "Down", color: "danger" },
	paused: { label: "Paused", color: "neutral" },
};

/** The one word a sparkline's trend reads as, and its line's tone. */
export const TREND: Record<
	ServiceTrend,
	{ label: string; tone: "brand" | "neutral" | "success" | "warning" | "danger" }
> = {
	stable: { label: "Stable", tone: "brand" },
	degrading: { label: "Degrading", tone: "warning" },
	recovering: { label: "Recovering", tone: "success" },
	down: { label: "Down", tone: "danger" },
	paused: { label: "Paused", tone: "neutral" },
};

/** Each incident status's word and tone. */
export const INCIDENT_STATUS: Record<
	IncidentStatus,
	{ label: string; color: "danger" | "warning" | "success" }
> = {
	investigating: { label: "Investigating", color: "danger" },
	monitoring: { label: "Monitoring", color: "warning" },
	resolved: { label: "Resolved", color: "success" },
};

/** The frame's strings. */
export const SHELL: AppShell.Labels = {
	nav: "Main",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** The app's own words, by screen. */
export const COPY = {
	app: "Pulse",
	workspace: "Northwind",
	plan: "Scale plan",
	user: "Priya Raman",
	email: "priya@northwind.dev",
	nav: {
		overview: "Overview",
		services: "Services",
		deployments: "Deployments",
		incidents: "Incidents",
		statusPages: "Status pages",
		settings: "Settings",
		workspace: "Workspace",
		general: "General",
		notifications: "Notifications",
		billing: "Billing",
		servicesDown: (count: number) => `${count} service down`,
		incidentsOpen: (count: number) => `${count} open incidents`,
	},
	banner: {
		label: "Billing",
		text: "The card ending 4242 was declined. Checks stop on November 8 unless the invoice is paid.",
		action: "Update payment method",
	},
	overview: {
		title: "Overview",
		description: "Every Northwind service in one place. Two incidents are open right now.",
		tabs: "Metric shown in the chart",
		metrics: {
			uptime: "Uptime",
			latency: "p95 latency",
			errors: "Error rate",
			incidents: "Open incidents",
		},
		comparison: (range: string) => `vs previous ${range}`,
		chartLabel: (metric: string, range: string) => `${metric} over the last ${range}`,
		legend: "Solid: this period. Dashed: the previous one. Hatched: no data.",
		legendCurrent: "This period",
		legendPrevious: "Previous period",
		noData: "No data",
		incidentBand: (id: string, status: string) => `${id} · ${status.toLowerCase()}`,
		chartStart: (range: string) => `${range} ago`,
		chartEnd: "Now",
		attention: "Needs attention",
		attentionDescription: "Services that are down or slower than their target.",
		viewAll: "View all services",
		failed: "Couldn't load services that need attention",
		failedHint: "The metrics store didn't answer in time. Try again in a moment.",
		requestId: "Request ID",
		retry: "Retry",
		loading: "Loading services",
		loadingStats: "Loading metrics",
		states: "Preview states",
		loadingState: "Loading",
		errorState: "Error",
		liveState: "Live",
	},
	range: {
		group: "Time range",
		apply: "Apply",
		presets: {
			"24h": { label: "24h", description: "Last 24 hours", long: "24 hours" },
			"7d": { label: "7d", description: "Last 7 days", long: "7 days" },
			"30d": { label: "30d", description: "Last 30 days", long: "30 days" },
			"90d": { label: "90d", description: "Last 90 days", long: "90 days" },
		},
	},
	services: {
		title: "Services",
		description: "12 services across 4 regions, checked every 30 to 60 seconds.",
		create: "Add service",
		table: "Services",
		all: "All",
		failing: "Failing",
		select: (name: string) => `Select ${name}`,
		selectAll: "Select all services",
		columns: {
			name: "Service",
			status: "Status",
			latency: "p95",
			trend: "Last 16 hours",
			uptime: "30 days",
			checked: "Last checked",
			actions: "Actions",
		},
		pause: "Pause",
		resume: "Resume",
		edit: "Edit",
		delete: "Delete",
		trendLabel: (name: string, state: string) => `${name} p95 latency, ${state.toLowerCase()}`,
		stripLabel: (name: string, days = 90) => `${name} uptime, last ${days} days`,
		stripSummary: (value: string) => `${value} uptime`,
		dayLabel: (daysAgo: number) => {
			if (daysAgo === 0) return "Today";
			if (daysAgo === 1) return "Yesterday";
			return `${daysAgo} days ago`;
		},
		start: "90 days ago",
		end: "Today",
		viewing: (shown: number, total: number) => `Viewing ${shown} of ${total}`,
		noResults: "No services match",
		noResultsHint: "Nothing matches these filters. Remove one or clear them all.",
		clear: "Clear filters",
		loading: "Loading services",
		failed: "Couldn't load services. The checks API didn't answer.",
		retry: "Retry",
		keys: {
			group: "Services",
			next: "Next service",
			previous: "Previous service",
			open: "Open service",
			toggle: "Select service",
			peek: "Peek at service",
			search: "Search services",
		},
	},
	sheet: {
		description: (kind: string, region: string) => `${kind} · ${region}`,
		properties: "Properties",
		activity: "Recent activity",
		open: "Open service",
	},
	service: {
		crumbs: "Breadcrumb",
		tabs: "Service sections",
		overview: "Overview",
		checks: "Checks",
		incidents: "Incidents",
		settings: "Settings",
		pause: "Pause service",
		resume: "Resume service",
		runCheck: "Run check",
		chart: (name: string) => `${name} p95 latency, last 16 hours`,
		chartTitle: "p95 latency",
		chartHint: "Solid: the last 16 hours. Dashed: the same hours yesterday.",
		threshold: "Target 400 ms",
		properties: "Details",
		endpoint: "Endpoint",
		kind: "Runs on",
		region: "Region",
		owner: "Owner",
		version: "Version",
		interval: "Checked every",
		uptime: "Uptime (90 days)",
		errorRate: "Error rate",
		lastChecked: "Last checked",
		never: "Never checked",
		noErrors: "No errors",
		activity: "Incidents and deploys",
		noActivity: "No incidents or deploys in the last week.",
		more: (count: number) => (count === 1 ? "1 older event" : `${count} older events`),
		deployed: (version: string) => `deployed ${version}`,
		rolledBack: (version: string) => `rolled back ${version}`,
		opened: (id: string, title: string) => `opened ${id}: ${title}`,
		resolved: (id: string) => `resolved ${id}`,
		checksTable: "Recent checks",
		checkColumns: { region: "Region", result: "Result", latency: "Response", at: "Checked" },
		noIncidents: "No incidents",
		noIncidentsHint: "This service hasn't had an incident in 90 days.",
		settingsTitle: "Check settings",
		settingsDescription: "How Pulse checks this service.",
		save: "Save changes",
		nameLabel: "Name",
		intervalLabel: "Check interval",
		intervals: {
			30: "Every 30 seconds",
			60: "Every minute",
			300: "Every 5 minutes",
			3600: "Every hour",
		},
		timeoutLabel: "Timeout",
		timeoutHint: "A check slower than this counts as down.",
		danger: "Danger zone",
		deleteTitle: "Delete service",
		deleteDescription: "Stop checking this service and remove its history.",
		deleteButton: "Delete service…",
		deleteConfirmTitle: "Delete service?",
		deleteConfirmBody: (name: string) =>
			`${name} stops being checked and its 90 days of history are removed.`,
		cancel: "Cancel",
	},
	deployments: {
		title: "Deployments",
		description: "Every release in the last week, newest first.",
		table: "Deployments",
		columns: {
			id: "Deploy",
			service: "Service",
			version: "Version",
			author: "Author",
			duration: "Duration",
			at: "Started",
		},
		live: "Live",
		rolledBack: "Rolled back",
	},
	incidents: {
		title: "Incidents",
		description: "Open incidents first; resolved ones stay for 90 days.",
		declare: "Declare incident",
		tabs: "Incident states",
		open: "Open",
		resolved: "Resolved",
		mine: "Assigned to me",
		table: "Incidents",
		columns: {
			id: "ID",
			title: "Incident",
			service: "Service",
			severity: "Severity",
			status: "Status",
			started: "Started",
			duration: "Duration",
		},
		ongoing: "Ongoing",
		cleared: "All caught up",
		clearedHint: "No open incidents are assigned to you.",
	},
	statusPages: {
		title: "Status pages",
		description: "Public pages that show customers how Northwind is doing.",
		firstRun: "Publish your first status page",
		firstRunHint:
			"Pick the services customers care about and Pulse keeps the page current during incidents.",
		create: "Create status page",
	},
	settings: {
		title: "Settings",
		back: "Settings",
		general: {
			title: "General",
			description: "The workspace's name and the time zone reports use.",
			section: "Workspace",
			sectionDescription: "Shown in the sidebar and on every alert.",
			name: "Workspace name",
			slug: "URL",
			slugHint: "Changing it breaks existing links.",
			slugPrefix: "pulse.dev/",
			timezone: "Time zone",
			save: "Save changes",
			danger: "Danger zone",
			transferTitle: "Transfer ownership",
			transferDescription: "Make another admin the owner of Northwind. You stay on as an admin.",
			transferButton: "Transfer…",
			transferConfirmTitle: "Transfer Northwind?",
			transferConfirmBody: "Tomás Ibarra becomes the owner and takes over billing.",
			transferConfirm: "Transfer ownership",
			deleteTitle: "Delete workspace",
			deleteDescription: "Permanently delete Northwind for everyone.",
			deleteConsequences: [
				"12 services stop being checked right away",
				"The status page at status.northwind.dev goes offline",
				"90 days of checks, incidents and deploys are deleted",
			],
			deleteButton: "Delete workspace…",
			deleteConfirmTitle: "Delete workspace?",
			deleteConfirmBody: "Northwind and everything in it are deleted. This can't be undone.",
			deleteConfirm: "Delete workspace",
			deleteType: 'Type "northwind" to confirm',
			cancel: "Cancel",
		},
		notifications: {
			title: "Notifications",
			description: "Who hears about an incident, and how.",
			instant: "Alerts",
			instantDescription: "Each change saves as soon as you flip it.",
			down: "Page the on-call engineer when a service goes down",
			degraded: "Post in #ops when a service degrades",
			deploys: "Post deploys in #releases",
			weekly: "Weekly uptime report",
			weeklyHint: "Sent on Monday at 09:00 in the workspace's time zone.",
			saveSwitches: "Save alerts",
			escalation: "Escalation",
			escalationDescription: "Where an unacknowledged page goes next.",
			email: "Escalation email",
			after: "Escalate after",
			afterOptions: { 5: "5 minutes", 15: "15 minutes", 30: "30 minutes" },
			save: "Save escalation",
		},
		billing: {
			title: "Billing",
			description: "Plan, invoices and the payment method.",
			permission: "Only owners can see billing",
			permissionHint:
				"Ask Tomás Ibarra, the workspace owner, to update the payment method or make you an owner.",
		},
	},
	notFound: {
		title: "Page not found",
		description: "Nothing in Pulse lives at this address. It may have been renamed or removed.",
		back: "Go to overview",
	},
	filters: {
		options: "View",
		toolbar: "Filter services",
		tabs: "Service states",
		filters: "Filters",
		apply: "Apply",
		is: "is",
		isAnyOf: "is any of",
		clear: "Clear filters",
		remove: (field: string, values: string) => `Remove ${field}: ${values}`,
		status: "Status",
		region: "Region",
		search: "Search services",
		searchPlaceholder: "Search services…",
		sort: "Sort by",
		sortOptions: {
			name: "Name",
			status: "Status",
			latency: "Slowest first",
			checked: "Last checked",
		},
	},
	refresh: {
		trigger: "Auto-refresh",
		updated: "Updated {time}",
		off: "Off",
		every: (seconds: number) => `${seconds}s`,
	},
} as const;

/** The filter toolbar's strings. */
export const FILTER_LABELS: FilterBar.Labels = {
	toolbar: COPY.filters.toolbar,
	tabs: COPY.filters.tabs,
	filters: COPY.filters.filters,
	apply: COPY.filters.apply,
	is: COPY.filters.is,
	isAnyOf: COPY.filters.isAnyOf,
	clear: COPY.filters.clear,
	remove: COPY.filters.remove,
	options: COPY.filters.options,
};

/** The display menu's strings. */
export const VIEW_LABELS: ViewOptions.Labels = {
	trigger: "Display",
	layout: "Layout",
	grouping: "Grouping",
	ordering: "Ordering",
	density: "Density",
	properties: "Properties",
	apply: "Apply",
	setDefault: "Set as default",
};

/** The density choices the display menu offers. */
export const DENSITY = { compact: "Compact", comfortable: "Comfortable" } as const;

/** The selection bar's strings. */
export const SELECTION_LABELS: SelectionBar.Labels = {
	toolbar: "Services",
	clear: "Clear selection",
	selected: "{count} selected",
	cleared: "Selection cleared",
	previous: "Previous page",
	next: "Next page",
};

/** The peek sheet's strings. */
export const SHEET_LABELS: DetailSheet.Labels = {
	close: "Close",
	copyLink: "Copy link",
	linkCopied: "Link copied",
	previous: "Previous service",
	next: "Next service",
	position: "Service",
};

/** The range picker's strings. */
export const RANGE_LABELS: RangePicker.Labels = {
	group: COPY.range.group,
	apply: COPY.range.apply,
};

/** The settings nav's strings. */
export const SETTINGS_LABELS: SettingsLayout.Labels = {
	back: COPY.settings.back,
};
