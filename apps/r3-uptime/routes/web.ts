/**
 * Web route table for the r3-uptime app. Declares every URL the fetch-router serves —
 * the auth flow, signed-in team-area pages, and their form actions — so controllers,
 * middleware, and views share one source of truth for paths and can build hrefs via
 * `routes.*.href(...)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, form, get, post, put, route } from "remix/fetch-router/routes";

/**
 * The application route map. Each leaf is a typed route with `.href(params)` for
 * building URLs and is used as the key when mapping controllers in `bootstrap/app.tsx`.
 *
 * @example
 * routes.app.team.href({ team: "acme" });
 */
export default route({
	home: get("/"),
	healthcheck: get("/healthcheck"),
	healthcheckAnalyticsEngine: get("/healthcheck/analytics-engine"),
	statusPage: get("/status/:slug"),
	invite: get("/invite/:inviteId"),
	sitemap: get("/sitemap.xml"),

	// GET = OAuth callback ("index"), POST = starts the OAuth flow ("action").
	auth: form("/auth"),
	// GET = confirmation page ("index"), POST = destroys the session ("action").
	logout: form("/logout"),

	// Public marketing pages. Each leaf takes a `:slug` param resolved against a
	// content record in `resources/content/marketing.ts` instead of one static route
	// per page — see that file's docblock for why (35 near-identical OLD APP pages).
	marketing: {
		feature: get("/features/:slug"),
		audience: get("/for/:slug"),
		useCase: get("/use-cases/:slug"),
		comparison: get("/vs/:slug"),
	},

	legal: {
		privacy: get("/privacy"),
		terms: get("/terms"),
	},

	docs: {
		index: get("/docs"),
		// Wildcard: captures every remaining path segment as one `slug` string
		// (e.g. `concepts/http-monitors`), matching the OLD APP's `docs/*` splat route.
		show: get("/docs/*slug"),
	},

	app: {
		index: get("/app"),
		team: {
			index: get("/app/:team"),
			dashboard: get("/app/:team/dashboard"),
			httpMonitors: get("/app/:team/http"),
			monitorNew: get("/app/:team/monitors/new"),
			monitorShow: get("/app/:team/monitors/:monitorId"),
			monitorEdit: get("/app/:team/monitors/:monitorId/edit"),
			dnsMonitors: get("/app/:team/dns"),
			dnsMonitorNew: get("/app/:team/dns/new"),
			dnsMonitorShow: get("/app/:team/dns/:monitorId"),
			dnsMonitorEdit: get("/app/:team/dns/:monitorId/edit"),
			tcpMonitors: get("/app/:team/tcp"),
			tcpMonitorNew: get("/app/:team/tcp/new"),
			tcpMonitorShow: get("/app/:team/tcp/:monitorId"),
			tcpMonitorEdit: get("/app/:team/tcp/:monitorId/edit"),
			cronJobs: get("/app/:team/cron-jobs"),
			cronJobNew: get("/app/:team/cron-jobs/new"),
			cronJobShow: get("/app/:team/cron-jobs/:monitorId"),
			cronJobEdit: get("/app/:team/cron-jobs/:monitorId/edit"),
			alerts: get("/app/:team/alerts"),
			alertNew: get("/app/:team/alerts/new"),
			alertEdit: get("/app/:team/alerts/:alertId/edit"),
			alertHistory: get("/app/:team/alert-history"),
			maintenanceWindows: get("/app/:team/maintenance"),
			maintenanceWindowNew: get("/app/:team/maintenance/new"),
			maintenanceWindowEdit: get("/app/:team/maintenance/:windowId/edit"),
			statusPages: get("/app/:team/status-pages"),
			statusPageNew: get("/app/:team/status-pages/new"),
			statusPageEdit: get("/app/:team/status-pages/:statusPageId/edit"),
			settings: get("/app/:team/settings"),
			account: get("/app/:team/account"),
			apiKeys: get("/app/:team/api-keys"),
			apiKeyNew: get("/app/:team/api-keys/new"),
			checkout: get("/app/:team/checkout"),
		},
	},

	actions: {
		createMonitor: post("/actions/:team/create-monitor"),
		updateMonitor: post("/actions/:team/update-monitor"),
		deleteMonitor: del("/actions/:team/delete-monitor"),
		playMonitor: post("/actions/:team/play-monitor"),
		updateSsl: post("/actions/:team/update-ssl"),
		createContentCheck: post("/actions/:team/create-content-check"),
		deleteContentCheck: del("/actions/:team/delete-content-check"),
		setDashboardTab: post("/actions/:team/set-dashboard-tab"),
		createDnsMonitor: post("/actions/:team/create-dns-monitor"),
		updateDnsMonitor: post("/actions/:team/update-dns-monitor"),
		deleteDnsMonitor: del("/actions/:team/delete-dns-monitor"),
		checkDnsMonitor: post("/actions/:team/check-dns-monitor"),
		createTcpMonitor: post("/actions/:team/create-tcp-monitor"),
		updateTcpMonitor: post("/actions/:team/update-tcp-monitor"),
		deleteTcpMonitor: del("/actions/:team/delete-tcp-monitor"),
		checkTcpMonitor: post("/actions/:team/check-tcp-monitor"),
		createCronJob: post("/actions/:team/create-cron-job"),
		updateCronJob: post("/actions/:team/update-cron-job"),
		deleteCronJob: del("/actions/:team/delete-cron-job"),
		createAlert: post("/actions/:team/create-alert"),
		updateAlert: post("/actions/:team/update-alert"),
		deleteAlert: del("/actions/:team/delete-alert"),
		createMaintenanceWindow: post("/actions/:team/create-maintenance-window"),
		updateMaintenanceWindow: post("/actions/:team/update-maintenance-window"),
		deleteMaintenanceWindow: del("/actions/:team/delete-maintenance-window"),
		endMaintenanceWindow: post("/actions/:team/end-maintenance-window"),
		createStatusPage: post("/actions/:team/create-status-page"),
		updateStatusPage: post("/actions/:team/update-status-page"),
		deleteStatusPage: del("/actions/:team/delete-status-page"),
	},

	// A separate route-map group (not a URL prefix — the paths are still
	// `/actions/:team/...`) purely so `bootstrap/app.tsx` can lay `requireRole("admin")`
	// over this whole group without also restricting the member-level `actions` above.
	// `router.map()` requires one middleware chain per call and every leaf of a group
	// in the same call, so these can't just be extra keys on `actions`.
	teamAdminActions: {
		updateTeam: post("/actions/:team/update-team"),
		deleteTeam: del("/actions/:team/delete-team"),
		removeMember: del("/actions/:team/remove-member"),
		changeRole: post("/actions/:team/change-role"),
		createInvite: post("/actions/:team/create-invite"),
		revokeInvite: del("/actions/:team/revoke-invite"),
		addDomain: post("/actions/:team/add-domain"),
		removeDomain: del("/actions/:team/remove-domain"),
		retryDomainVerification: post("/actions/:team/retry-domain-verification"),
		createApiKey: post("/actions/:team/create-api-key"),
		deleteApiKey: del("/actions/:team/delete-api-key"),
	},

	// Not team-scoped: reached from the account page, which lists every team the
	// viewer belongs to rather than acting on the one team in its own URL.
	accountActions: {
		createTeam: post("/actions/create-team"),
		leaveTeam: post("/actions/leave-team"),
		updateLanguage: post("/actions/update-language"),
	},

	api: {
		// Public, unauthenticated (see its controller's docblock) — kept separate from
		// the bearer-key-gated `v1` group below.
		cronJobPing: post("/api/v1/cron-jobs/:cronJobId/ping"),

		// Bearer-API-key-gated public REST API. Every leaf here is mapped individually
		// in `bootstrap/app.tsx` with its own `requireApiKey(scope)` middleware, since a
		// single `router.map()` group call can only carry one middleware chain shared by
		// every leaf, and read/write methods on the same resource need different scopes.
		v1: {
			status: get("/api/v1/status"),
			backfillDailyStats: post("/api/v1/backfill-daily-stats"),

			monitorsIndex: get("/api/v1/monitors"),
			monitorsCreate: post("/api/v1/monitors"),
			monitorsStats: get("/api/v1/monitors/stats"),
			monitorShow: get("/api/v1/monitors/:monitorId"),
			monitorUpdate: put("/api/v1/monitors/:monitorId"),
			monitorDestroy: del("/api/v1/monitors/:monitorId"),
			monitorStats: get("/api/v1/monitors/:monitorId/stats"),
			monitorResults: get("/api/v1/monitors/:monitorId/results"),
			monitorAlertEvents: get("/api/v1/monitors/:monitorId/alert-events"),
			monitorContentChecksIndex: get("/api/v1/monitors/:monitorId/content-checks"),
			monitorContentChecksCreate: post("/api/v1/monitors/:monitorId/content-checks"),
			monitorContentCheckDestroy: del("/api/v1/monitors/:monitorId/content-checks/:contentCheckId"),

			dnsMonitorsIndex: get("/api/v1/dns-monitors"),
			dnsMonitorsCreate: post("/api/v1/dns-monitors"),
			dnsMonitorShow: get("/api/v1/dns-monitors/:dnsMonitorId"),
			dnsMonitorUpdate: put("/api/v1/dns-monitors/:dnsMonitorId"),
			dnsMonitorDestroy: del("/api/v1/dns-monitors/:dnsMonitorId"),
			dnsMonitorResults: get("/api/v1/dns-monitors/:dnsMonitorId/results"),

			tcpMonitorsIndex: get("/api/v1/tcp-monitors"),
			tcpMonitorsCreate: post("/api/v1/tcp-monitors"),
			tcpMonitorShow: get("/api/v1/tcp-monitors/:tcpMonitorId"),
			tcpMonitorUpdate: put("/api/v1/tcp-monitors/:tcpMonitorId"),
			tcpMonitorDestroy: del("/api/v1/tcp-monitors/:tcpMonitorId"),
			tcpMonitorResults: get("/api/v1/tcp-monitors/:tcpMonitorId/results"),

			cronJobsIndex: get("/api/v1/cron-jobs"),
			cronJobsCreate: post("/api/v1/cron-jobs"),
			cronJobShow: get("/api/v1/cron-jobs/:cronJobId"),
			cronJobUpdate: put("/api/v1/cron-jobs/:cronJobId"),
			cronJobDestroy: del("/api/v1/cron-jobs/:cronJobId"),

			alertsIndex: get("/api/v1/alerts"),
			alertsCreate: post("/api/v1/alerts"),
			alertShow: get("/api/v1/alerts/:alertId"),
			alertUpdate: put("/api/v1/alerts/:alertId"),
			alertDestroy: del("/api/v1/alerts/:alertId"),
			alertEvents: get("/api/v1/alerts/:alertId/events"),

			maintenanceIndex: get("/api/v1/maintenance"),
			maintenanceCreate: post("/api/v1/maintenance"),
			maintenanceShow: get("/api/v1/maintenance/:maintenanceId"),
			maintenanceUpdate: put("/api/v1/maintenance/:maintenanceId"),
			maintenanceDestroy: del("/api/v1/maintenance/:maintenanceId"),
			maintenanceEnd: post("/api/v1/maintenance/:maintenanceId/end"),

			statusPagesIndex: get("/api/v1/status-pages"),
			statusPagesCreate: post("/api/v1/status-pages"),
			statusPageShow: get("/api/v1/status-pages/:statusPageId"),
			statusPageUpdate: put("/api/v1/status-pages/:statusPageId"),
			statusPageDestroy: del("/api/v1/status-pages/:statusPageId"),
			statusPageMonitors: put("/api/v1/status-pages/:statusPageId/monitors"),

			invitesIndex: get("/api/v1/invites"),
			invitesCreate: post("/api/v1/invites"),
			inviteDestroy: del("/api/v1/invites/:inviteId"),

			memberships: get("/api/v1/memberships"),

			teamShow: get("/api/v1/team"),
			teamUpdate: put("/api/v1/team"),

			teamDomainsIndex: get("/api/v1/team-domains"),
			teamDomainsCreate: post("/api/v1/team-domains"),
			teamDomainsDestroy: del("/api/v1/team-domains"),

			apiKeysIndex: get("/api/v1/api-keys"),
			apiKeysCreate: post("/api/v1/api-keys"),
			apiKeyDestroy: del("/api/v1/api-keys/:apiKeyId"),
		},
	},
});
