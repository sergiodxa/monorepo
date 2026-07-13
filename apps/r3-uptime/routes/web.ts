/**
 * Web route table for the r3-uptime app. Declares every URL the fetch-router serves —
 * the auth flow, signed-in team-area pages, and their form actions — so controllers,
 * middleware, and views share one source of truth for paths and can build hrefs via
 * `routes.*.href(...)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, form, get, post, put, resources, route } from "remix/fetch-router/routes";

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

	/** GET = OAuth callback ("index"), POST = starts the OAuth flow ("action"). */
	auth: form("/auth"),
	/** GET = confirmation page ("index"), POST = destroys the session ("action"). */
	logout: form("/logout"),

	/**
	 * Public marketing pages. Each leaf takes a `:slug` param resolved against a
	 * content record in `resources/content/marketing.ts` instead of one static route
	 * per page — see that file's docblock for why (35 near-identical marketing pages).
	 */
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
		/**
		 * Wildcard: captures every remaining path segment as one `slug` string
		 * (e.g. `concepts/http-monitors`).
		 */
		show: get("/docs/*slug"),
	},

	app: {
		index: get("/app"),
		team: {
			index: get("/app/:team"),
			dashboard: {
				index: get("/app/:team/dashboard"),
				/**
				 * Fragment route: renders just one monitor-type table, loaded into the
				 * dashboard's named "dashboard-panel" `Frame` so switching tabs doesn't
				 * reload the stat cards above it.
				 */
				panel: get("/app/:team/dashboard/panel/:type"),
				/**
				 * Fragment routes: each renders exactly one dashboard stat card, loaded into
				 * its own named `Frame` with a skeleton `fallback` so no card ever blocks
				 * another (notably usage, the slowest fetch, a Polar API call). `count` is
				 * parameterized by `:resource` rather than one route per monitor type since
				 * all five counts share the same shape (a total plus a status breakdown).
				 */
				cards: {
					usage: get("/app/:team/dashboard/cards/usage"),
					uptime: get("/app/:team/dashboard/cards/uptime"),
					slowestEndpoint: get("/app/:team/dashboard/cards/slowest-endpoint"),
					count: get("/app/:team/dashboard/cards/count/:resource"),
				},
			},
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

	/**
	 * A separate route-map group (not a URL prefix — the paths are still
	 * `/actions/:team/...`) purely so `bootstrap/app.tsx` can lay `requireRole("admin")`
	 * over this whole group without also restricting the member-level `actions` above.
	 * `router.map()` requires one middleware chain per call and every leaf of a group
	 * in the same call, so these can't just be extra keys on `actions`.
	 */
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

	/**
	 * Not team-scoped: reached from the account page, which lists every team the
	 * viewer belongs to rather than acting on the one team in its own URL.
	 */
	accountActions: {
		createTeam: post("/actions/create-team"),
		leaveTeam: post("/actions/leave-team"),
		updateLanguage: post("/actions/update-language"),
	},

	api: {
		/**
		 * Public, unauthenticated (see its controller's docblock) — kept separate from
		 * the bearer-key-gated `v1` group below.
		 */
		cronJobPing: post("/api/v1/cron-jobs/:cronJobId/ping"),

		/**
		 * Bearer-API-key-gated public REST API. Each resource below groups its
		 * conventional CRUD leaves via `resources()` (collection `index`/`create` plus
		 * item `show`/`update`/`destroy`, relative to the resource's base path and
		 * `:idParam`), with any non-standard action (e.g. `alerts.events`,
		 * `monitors.contentChecks`) added as an extra key alongside the spread. Every
		 * leaf is still mapped in `bootstrap/app.tsx` with its own `requireApiKey(scope)`
		 * middleware, since read/write methods on the same resource need different
		 * scopes — grouping here is only about the route table, not shared middleware.
		 */
		v1: {
			status: get("/api/v1/status"),
			backfillDailyStats: post("/api/v1/backfill-daily-stats"),

			monitors: {
				...resources("/api/v1/monitors", { param: "monitorId", exclude: ["new", "edit"] }),
				stats: get("/api/v1/monitors/stats"),
				itemStats: get("/api/v1/monitors/:monitorId/stats"),
				results: get("/api/v1/monitors/:monitorId/results"),
				alertEvents: get("/api/v1/monitors/:monitorId/alert-events"),
				contentChecks: {
					index: get("/api/v1/monitors/:monitorId/content-checks"),
					create: post("/api/v1/monitors/:monitorId/content-checks"),
					destroy: del("/api/v1/monitors/:monitorId/content-checks/:contentCheckId"),
				},
			},

			dnsMonitors: {
				...resources("/api/v1/dns-monitors", {
					param: "dnsMonitorId",
					exclude: ["new", "edit"],
				}),
				results: get("/api/v1/dns-monitors/:dnsMonitorId/results"),
			},

			tcpMonitors: {
				...resources("/api/v1/tcp-monitors", {
					param: "tcpMonitorId",
					exclude: ["new", "edit"],
				}),
				results: get("/api/v1/tcp-monitors/:tcpMonitorId/results"),
			},

			cronJobs: resources("/api/v1/cron-jobs", { param: "cronJobId", exclude: ["new", "edit"] }),

			alerts: {
				...resources("/api/v1/alerts", { param: "alertId", exclude: ["new", "edit"] }),
				events: get("/api/v1/alerts/:alertId/events"),
			},

			maintenance: {
				...resources("/api/v1/maintenance", {
					param: "maintenanceId",
					exclude: ["new", "edit"],
				}),
				end: post("/api/v1/maintenance/:maintenanceId/end"),
			},

			statusPages: {
				...resources("/api/v1/status-pages", {
					param: "statusPageId",
					exclude: ["new", "edit"],
				}),
				monitors: put("/api/v1/status-pages/:statusPageId/monitors"),
			},

			invites: resources("/api/v1/invites", {
				param: "inviteId",
				exclude: ["new", "edit", "show", "update"],
			}),

			memberships: get("/api/v1/memberships"),

			teamShow: get("/api/v1/team"),
			teamUpdate: put("/api/v1/team"),

			// `destroy` takes the id in the JSON body rather than the URL — matching the
			// OLD APP's `DELETE /api/v1/team-domains` contract — so it can't come from
			// `resources()`'s `:id`-param shape and is added by hand instead.
			teamDomains: {
				...resources("/api/v1/team-domains", { only: ["index", "create"] }),
				destroy: del("/api/v1/team-domains"),
			},

			apiKeys: resources("/api/v1/api-keys", {
				param: "apiKeyId",
				exclude: ["new", "edit", "show", "update"],
			}),
		},
	},
});
