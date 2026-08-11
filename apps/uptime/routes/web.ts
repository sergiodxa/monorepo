/**
 * Web route table for the uptime app. Declares every URL the fetch-router serves —
 * the auth flow, signed-in team-area pages, and their form actions — so controllers,
 * middleware, and views share one source of truth for paths and can build hrefs via
 * `routes.*.href(...)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, form, get, patch, post, put, resources, route } from "remix/fetch-router/routes";

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

	/**
	 * The public try-it surface. Unauthenticated by design — the whole point is that a
	 * visitor with no account can probe one URL and see what monitoring would tell them.
	 * Every leaf here is reachable by anyone, so each one carries its own protection
	 * rather than inheriting an auth chain: `trial.check.action` goes through
	 * `trial-guard.ts` (target blocklist, Turnstile, per-IP limit, daily budget) and
	 * `trial.unsubscribe` proves itself with the unguessable token in its own URL.
	 */
	trial: {
		/**
		 * `form()` rather than a page and a separate action at their own URLs: the `GET` is
		 * an empty box and the `POST` runs the check and renders the answer in its own
		 * response. Collapsing the two is what lets the page hold no state between requests
		 * — a reload of the `GET` cannot show somebody else's stale result, and every link
		 * back here lands on a fresh form.
		 *
		 * Running a probe is always the `POST`, so a link preview or a crawler following
		 * `/try` cannot spend one; arriving with `?url=` only pre-fills the field.
		 */
		check: form("/try"),
		lead: post("/try/lead"),
		/**
		 * The seven-day health report as a page, addressed by the watch's own unguessable
		 * `report_token` — the same way `unsubscribe` proves itself, and for the same reason:
		 * there is no account behind a trial, so the URL is the only credential available.
		 *
		 * A separate token from the lead's unsubscribe one on purpose. That token *acts* (it
		 * deletes an address), and a report is something a reader may forward to a colleague or a
		 * client; sharing a link must never hand over the power to unsubscribe somebody.
		 */
		report: get("/try/report/:token"),
		/**
		 * `form()` rather than `post()`: the GET renders a confirmation page and only the
		 * POST deletes. A mail scanner that follows every link in an email — Outlook Safe
		 * Links, Gmail's fetcher — must not be able to unsubscribe somebody who never
		 * clicked, which is exactly what a GET that deletes would allow.
		 */
		unsubscribe: form("/unsubscribe/:token"),
	},
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

	/**
	 * How the monitoring works and who runs it. Its own top-level leaf rather than a
	 * `marketing.*` slug, because it is not a page that sells: it is the one a prospective
	 * customer reads to decide whether to believe the rest of the site, and it is linked from
	 * the footer next to the legal pages for that reason.
	 */
	trust: get("/trust"),

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
				 * Fragment route: the quick-check card. Its own `Frame` so submitting the
				 * form swaps just this card — running a check must not cost the page its
				 * stat cards, its tab table, and every fetch behind them.
				 */
				quickPing: get("/app/:team/dashboard/quick-ping"),
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
				 * the uptime history bar), loaded into its own named `Frame` with a skeleton
				 * `fallback` so none of them block the page shell or each other — notably the
				 * usage card's Polar API call, the slowest of the bunch. Same rationale as
				 * `dashboard.cards` above, scoped down to one monitor via `:monitorId`.
				 */
				cards: {
					usage: get("/app/:team/monitors/:monitorId/cards/usage"),
					slowestResult: get("/app/:team/monitors/:monitorId/cards/slowest-result"),
					p99ResponseTime: get("/app/:team/monitors/:monitorId/cards/p99-response-time"),
					uptime: get("/app/:team/monitors/:monitorId/cards/uptime"),
					uptimeHistory: get("/app/:team/monitors/:monitorId/cards/uptime-history"),
				},
				/**
				 * JSON probe reporting the monitor's cached last status and last-checked
				 * instant. An on-demand run only *enqueues* a check, so the request that
				 * starts it cannot report the outcome; this is what a hydrated page polls
				 * afterwards to notice the result landing, and it stays a page-area route
				 * (session-authenticated) rather than an API one so no key is involved.
				 */
				runStatus: get("/app/:team/monitors/:monitorId/run-status"),
			},
			/**
			 * Paste-a-list bulk creation. `/app/:team/import-monitors` rather than a leaf under the
			 * monitors base path, because `monitors.show` is `/app/:team/monitors/:monitorId` —
			 * anything at `/app/:team/monitors/import` is also a valid `show` with the id
			 * `"import"`, and which of the two wins would be a property of match ordering rather
			 * than of this table.
			 */
			monitorsImport: get("/app/:team/import-monitors"),
			dnsMonitors: {
				...resources("/app/:team/dns", {
					param: "monitorId",
					only: ["index", "new", "show", "edit"],
				}),
				/**
				 * The step between creating a domain monitor and monitoring anything with it:
				 * discovery has run, and this lists what it found — grouped by name, then by
				 * type — for the visitor to accept or decline before any of it becomes an
				 * expectation. Its own page rather than a section of `show`, because a monitor
				 * with unreviewed records is a distinct state and a reload must land back on
				 * the decision rather than on a detail page that implies it was made.
				 *
				 * `/review` under `:monitorId` rather than a query flag: the monitor already
				 * exists by the time it renders (discovery wrote its records), so the URL is
				 * shareable, re-openable, and cannot be reached for a monitor that is not there.
				 */
				review: get("/app/:team/dns/:monitorId/review"),
				/**
				 * Fragment routes for the detail page's data fetches, same rationale as
				 * `monitors.cards` above: the shell renders from the monitor row alone, while the
				 * uptime history bar, the result-derived stat cards and the check history each
				 * load into their own `Frame` rather than the page awaiting all three before its
				 * first byte.
				 *
				 * `results` and `checkHistory` are two routes over the same result rows because
				 * the page puts them in different places — the summary above the record table, the
				 * raw log below it — and a `Frame` fills the region it was declared in, so content
				 * that has to appear in two places cannot come from one fragment.
				 */
				cards: {
					uptimeHistory: get("/app/:team/dns/:monitorId/cards/uptime-history"),
					results: get("/app/:team/dns/:monitorId/cards/results"),
					checkHistory: get("/app/:team/dns/:monitorId/cards/check-history"),
				},
			},
			tcpMonitors: {
				...resources("/app/:team/tcp", {
					param: "monitorId",
					only: ["index", "new", "show", "edit"],
				}),
				/** Fragment routes, same rationale as `dnsMonitors.cards` above. */
				cards: {
					uptimeHistory: get("/app/:team/tcp/:monitorId/cards/uptime-history"),
					results: get("/app/:team/tcp/:monitorId/cards/results"),
				},
			},
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
				/** Creates one monitor per URL in a pasted list, in a single submission. */
				import: post("/actions/:team/import-monitors"),
				updateSsl: post("/actions/:team/update-ssl"),
				createContentCheck: post("/actions/:team/create-content-check"),
				deleteContentCheck: del("/actions/:team/delete-content-check"),
			},
			dns: {
				create: post("/actions/:team/create-dns-monitor"),
				update: post("/actions/:team/update-dns-monitor"),
				delete: del("/actions/:team/delete-dns-monitor"),
				check: post("/actions/:team/check-dns-monitor"),
				/**
				 * Submits the review screen: which of the discovered records are watched. A
				 * declined record is stored disabled rather than dropped, so this settles every
				 * record on the monitor at once instead of creating a subset of them.
				 */
				review: post("/actions/:team/review-dns-monitor"),
				/**
				 * Flips one already-stored record between watched and not, from the detail page.
				 * Separate from `review` because that one settles a monitor nobody has looked at
				 * yet, while this is the single-row edit a visitor makes later.
				 */
				toggleRecord: post("/actions/:team/toggle-dns-monitor-record"),
				/**
				 * Re-parses a freshly pasted zone file for an existing monitor. Its own action
				 * rather than a field on the edit form, because the pasted text is never stored:
				 * names can only be re-discovered by asking for the file again, which is a
				 * deliberate, occasional act rather than part of renaming a monitor.
				 */
				importZoneFile: post("/actions/:team/import-dns-monitor-zone-file"),
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
		/**
		 * The dashboard's quick-check form. Its own leaf rather than one of
		 * `monitor.http`'s, because it acts on no monitor at all — the URL comes from the
		 * form body and nothing is stored once the check answers.
		 */
		runPing: post("/actions/:team/run-ping"),
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
		/**
		 * Which optional emails the viewer wants. Not team-scoped for the same reason as its
		 * neighbours and one of its own: the choice is the person's, so somebody in three
		 * teams turns a digest off once rather than three times.
		 */
		updateEmails: post("/actions/update-emails"),
		/**
		 * The viewer's own data as a JSON download. A `POST` rather than a `GET`, even though it
		 * mutates nothing: a `GET` that returns somebody's whole account is a URL another site
		 * can point an image or an iframe at, and cross-origin protection only applies to the
		 * unsafe methods. The form is a button, so nothing is lost by it.
		 */
		exportData: post("/actions/export-data"),
		/**
		 * Queues the account for deletion — it deletes nothing itself; the daily sweep does. The
		 * gap between the two is the grace period, which is what {@link cancelDeletion} exists
		 * to use.
		 */
		requestDeletion: post("/actions/request-account-deletion"),
		/** Removes a queued deletion request, undoing it while it is still only a request. */
		cancelDeletion: del("/actions/cancel-account-deletion"),
	},

	/**
	 * Inbound webhooks from third parties. Grouped under one path prefix because that
	 * prefix is what exempts them from cross-origin protection and language resolution in
	 * `bootstrap/app.tsx` — a sender proves itself with a signature over the request body,
	 * so neither an `Origin` header nor a session applies. Every leaf here is
	 * unauthenticated by the auth chain's standards and must verify its own signature.
	 */
	webhooks: {
		polar: post("/webhooks/polar"),
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

			/**
			 * One-shot check against a target the caller describes in the request body, with
			 * no monitor behind it. Not a `resources()` leaf and not nested under a monitor
			 * type, because it creates nothing and belongs to none of them: the body's `type`
			 * discriminator picks which kind of check to run.
			 */
			ping: post("/api/v1/ping"),

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
				/**
				 * The monitor's tracked records, and the toggle deciding which of them alert.
				 * Deliberately on the existing `dns-monitors:read`/`:write` scopes rather than a
				 * pair of its own: a key that may reconfigure a domain monitor may decide which of
				 * its records are watched, because the two are the same authority.
				 *
				 * `PATCH` rather than `PUT`: the only mutable field is `isEnabled`, and a caller
				 * must never be able to rewrite a record's identity — the normalized value is the
				 * key the diff runs on, so editing it would silently retarget the expectation.
				 */
				records: {
					index: get("/api/v1/dns-monitors/:dnsMonitorId/records"),
					update: patch("/api/v1/dns-monitors/:dnsMonitorId/records/:recordId"),
				},
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
