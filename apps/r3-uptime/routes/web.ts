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
			monitors: {
				...resources("/app/:team/monitors", {
					param: "monitorId",
					only: ["index", "new", "show", "edit"],
				}),
				/**
				 * Fragment routes: each renders exactly one monitor-detail-page stat card (or
				 * the heatmap), loaded into its own named `Frame` with a skeleton `fallback` so
				 * none of them block the page shell or each other — notably the usage card's
				 * Polar API call, the slowest of the bunch. Same rationale as
				 * `dashboard.cards` above, scoped down to one monitor via `:monitorId`.
				 */
				cards: {
					usage: get("/app/:team/monitors/:monitorId/cards/usage"),
					slowestResult: get("/app/:team/monitors/:monitorId/cards/slowest-result"),
					uptime: get("/app/:team/monitors/:monitorId/cards/uptime"),
					heatmap: get("/app/:team/monitors/:monitorId/cards/heatmap"),
				},
			},
			dnsMonitors: resources("/app/:team/dns", {
				param: "monitorId",
				only: ["index", "new", "show", "edit"],
			}),
			tcpMonitors: resources("/app/:team/tcp", {
				param: "monitorId",
				only: ["index", "new", "show", "edit"],
			}),
			cronJobs: resources("/app/:team/cron-jobs", {
				param: "monitorId",
				only: ["index", "new", "show", "edit"],
			}),
			/**
			 * No `show` page — alerts only have list/new/edit. `alertHistory` lives at
			 * `/app/:team/alert-history`, a different base path, so it stays a separate leaf.
			 */
			alerts: {
				...resources("/app/:team/alerts", { param: "alertId", only: ["index", "new", "edit"] }),
				history: get("/app/:team/alert-history"),
			},
			/** No `show` page. */
			maintenanceWindows: resources("/app/:team/maintenance", {
				param: "windowId",
				only: ["index", "new", "edit"],
			}),
			/** No `show` page — the public status page itself is `routes.statusPage`. */
			statusPages: resources("/app/:team/status-pages", {
				param: "statusPageId",
				only: ["index", "new", "edit"],
			}),
			settings: get("/app/:team/settings"),
			account: get("/app/:team/account"),
			/** No `show`/`edit` pages. */
			apiKeys: resources("/app/:team/api-keys", { only: ["index", "new"] }),
			checkout: get("/app/:team/checkout"),
		},
	},

	/**
	 * None of these leaves carry an id in the URL (only `:team`) — the record being
	 * acted on comes from a form-body field instead (e.g. a hidden `monitor_id` input),
	 * so `resources()`'s `:param`-in-URL shape doesn't fit here. Grouped by resource
	 * instead, with every path string unchanged from the old flat map. `monitor.http`
	 * also carries the SSL-settings and content-check actions since both are
	 * sub-resources of an HTTP monitor, even though they're implemented in their own
	 * controller files (`ssl.ts`, `content-checks.ts`). `setDashboardTab` doesn't belong
	 * to any resource, so it stays a standalone leaf.
	 */
	actions: {
		monitor: {
			http: {
				create: post("/actions/:team/create-monitor"),
				update: post("/actions/:team/update-monitor"),
				delete: del("/actions/:team/delete-monitor"),
				play: post("/actions/:team/play-monitor"),
				updateSsl: post("/actions/:team/update-ssl"),
				createContentCheck: post("/actions/:team/create-content-check"),
				deleteContentCheck: del("/actions/:team/delete-content-check"),
			},
			dns: {
				create: post("/actions/:team/create-dns-monitor"),
				update: post("/actions/:team/update-dns-monitor"),
				delete: del("/actions/:team/delete-dns-monitor"),
				check: post("/actions/:team/check-dns-monitor"),
			},
			tcp: {
				create: post("/actions/:team/create-tcp-monitor"),
				update: post("/actions/:team/update-tcp-monitor"),
				delete: del("/actions/:team/delete-tcp-monitor"),
				check: post("/actions/:team/check-tcp-monitor"),
			},
		},
		cronJob: {
			create: post("/actions/:team/create-cron-job"),
			update: post("/actions/:team/update-cron-job"),
			delete: del("/actions/:team/delete-cron-job"),
		},
		alert: {
			create: post("/actions/:team/create-alert"),
			update: post("/actions/:team/update-alert"),
			delete: del("/actions/:team/delete-alert"),
		},
		maintenanceWindow: {
			create: post("/actions/:team/create-maintenance-window"),
			update: post("/actions/:team/update-maintenance-window"),
			delete: del("/actions/:team/delete-maintenance-window"),
			end: post("/actions/:team/end-maintenance-window"),
		},
		statusPage: {
			create: post("/actions/:team/create-status-page"),
			update: post("/actions/:team/update-status-page"),
			delete: del("/actions/:team/delete-status-page"),
		},
		setDashboardTab: post("/actions/:team/set-dashboard-tab"),
	},

	/**
	 * A separate route-map group (not a URL prefix — the paths are still
	 * `/actions/:team/...`) purely so `bootstrap/app.tsx` can lay `requireRole("admin")`
	 * over this whole group without also restricting the member-level `actions` above.
	 * `router.map()` requires one middleware chain per call and every leaf of a group
	 * in the same call, so these can't just be extra keys on `actions`. Grouped by
	 * sub-resource, same rationale (and same no-id-in-URL shape) as `actions` above.
	 */
	teamAdminActions: {
		team: {
			update: post("/actions/:team/update-team"),
			delete: del("/actions/:team/delete-team"),
		},
		member: {
			remove: del("/actions/:team/remove-member"),
			changeRole: post("/actions/:team/change-role"),
		},
		invite: {
			create: post("/actions/:team/create-invite"),
			revoke: del("/actions/:team/revoke-invite"),
		},
		domain: {
			add: post("/actions/:team/add-domain"),
			remove: del("/actions/:team/remove-domain"),
			retryVerification: post("/actions/:team/retry-domain-verification"),
		},
		apiKey: {
			create: post("/actions/:team/create-api-key"),
			delete: del("/actions/:team/delete-api-key"),
		},
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

			// `destroy` takes the id in the JSON body rather than the URL (`DELETE
			// /api/v1/team-domains` with no id segment), so it can't come from
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
