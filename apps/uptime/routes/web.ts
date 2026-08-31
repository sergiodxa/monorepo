/**
 * Web route table for the uptime app. Declares every URL the fetch-router serves —
 * the auth flow, signed-in team-area pages, and their form actions — so controllers,
 * middleware, and views share one source of truth for paths and can build hrefs via
 * `routes.*.href(...)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, form, get, patch, post, put, resources, route } from "remix/routes";

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
	 * The public try-it surface, reachable with no account. Every leaf carries its own
	 * protection: `trial.check.action` goes through `trial-guard.ts`, and
	 * `trial.unsubscribe` proves itself with its own URL token.
	 */
	trial: {
		/**
		 * `form()` combines the empty `GET` box and the check-running `POST` into one
		 * route, so the page holds no state between requests. Running a probe is always
		 * the `POST`, keeping a preview or crawler following `/try` from spending one.
		 */
		check: form("/try"),
		lead: post("/try/lead"),
		/**
		 * Addressed by the watch's own unguessable `report_token`, the only credential a
		 * trial has since there's no account behind it. A separate token from the lead's
		 * unsubscribe one keeps a forwarded report from ever unsubscribing someone.
		 */
		report: get("/try/report/:token"),
		/**
		 * `form()` pairs a confirmation-page `GET` with the deleting `POST`, so a mail
		 * scanner following every link in an email lands safely on the confirmation
		 * page, and only a real click reaches the delete.
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
	 * Its own top-level leaf: this is what a prospective customer reads to decide
	 * whether to trust the rest of the site, so it sits in the footer next to the
	 * legal pages, apart from the `marketing.*` pages that sell.
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
				 * Fragment route: the header's quick-check bar. Its own `Frame` so submitting
				 * the form swaps just that bar — running a check must not cost the page its
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
				 * Each stat card loads into its own named `Frame` with a skeleton `fallback`, so
				 * usage — the slowest fetch, a Polar API call — never blocks another. `count` is
				 * parameterized by `:resource` since all five counts share the same shape.
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
				 * Each stat card (or the uptime history bar) loads into its own named `Frame`
				 * with a skeleton `fallback`, so the usage card's Polar API call — the slowest
				 * of the bunch — never blocks the page shell or the cards beside it.
				 */
				cards: {
					usage: get("/app/:team/monitors/:monitorId/cards/usage"),
					slowestResult: get("/app/:team/monitors/:monitorId/cards/slowest-result"),
					p99ResponseTime: get("/app/:team/monitors/:monitorId/cards/p99-response-time"),
					uptime: get("/app/:team/monitors/:monitorId/cards/uptime"),
					uptimeHistory: get("/app/:team/monitors/:monitorId/cards/uptime-history"),
				},
				/**
				 * Reports the monitor's cached last status and last-checked instant. An
				 * on-demand run only enqueues a check, so a hydrated page polls this route
				 * afterward to notice the result landing; it stays session-authenticated.
				 */
				runStatus: get("/app/:team/monitors/:monitorId/run-status"),
			},
			/**
			 * Paste-a-list bulk creation, at `/app/:team/import-monitors`. Since `monitors.show`
			 * is `/app/:team/monitors/:monitorId`, a path under the monitors base would also
			 * match `show` with the id `"import"`, leaving the winner to match ordering.
			 */
			monitorsImport: get("/app/:team/import-monitors"),
			dnsMonitors: {
				...resources("/app/:team/dns", {
					param: "monitorId",
					only: ["index", "new", "show", "edit"],
				}),
				/**
				 * Its own page: an unreviewed monitor is a distinct state, and a reload must
				 * land back on the decision. The monitor already exists by the time this
				 * renders, so `/review` under `:monitorId` stays a shareable, re-openable URL.
				 */
				review: get("/app/:team/dns/:monitorId/review"),
				/**
				 * The shell renders from the monitor row alone, while the uptime history bar,
				 * the stat cards, and the check history each load into their own `Frame`.
				 * `results` and `checkHistory` split the same rows since each `Frame` fills only its own region.
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
			flowMonitors: {
				...resources("/app/:team/flows", {
					param: "monitorId",
					only: ["index", "new", "show", "edit"],
				}),
				/** Fragment routes, same rationale as `dnsMonitors.cards` above. */
				cards: {
					results: get("/app/:team/flows/:monitorId/cards/results"),
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
	 * None of these leaves carry an id in the URL (only `:team`) — the record acted on
	 * comes from a form-body field instead. Grouped by resource; `setDashboardTab`
	 * belongs to no resource, so it stands alone.
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
				 * Re-parses a freshly pasted zone file for an existing monitor, as its own
				 * action: the pasted text is never stored, so names can only be rediscovered
				 * by pasting the file again — a deliberate, occasional act of its own.
				 */
				importZoneFile: post("/actions/:team/import-dns-monitor-zone-file"),
			},
			tcp: {
				create: post("/actions/:team/create-tcp-monitor"),
				update: post("/actions/:team/update-tcp-monitor"),
				delete: del("/actions/:team/delete-tcp-monitor"),
				check: post("/actions/:team/check-tcp-monitor"),
			},
			flow: {
				create: post("/actions/:team/create-flow-monitor"),
				update: post("/actions/:team/update-flow-monitor"),
				delete: del("/actions/:team/delete-flow-monitor"),
				/** Runs the flow now, inline. Billable work, so entitlement-gated and metered. */
				check: post("/actions/:team/check-flow-monitor"),
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
	 * A separate route-map group, not a URL prefix (paths stay `/actions/:team/...`),
	 * so `bootstrap/app.tsx` can lay `requireRole("admin")` over exactly this group: a
	 * `router.map()` call takes one middleware chain over every leaf within it.
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
		 * Exports the viewer's own data as a JSON download, mutating nothing. A `POST`
		 * keeps it behind cross-origin protection, which guards only the unsafe methods —
		 * a `GET` returning someone's whole account is a URL another site could point an image at.
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
	 * Inbound webhooks from third parties, grouped under one path prefix so
	 * `bootstrap/app.tsx` exempts it from cross-origin protection and language
	 * resolution; each leaf verifies its own signature over the request body.
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
		 * Bearer-API-key-gated public REST API. Each resource groups its CRUD leaves via
		 * `resources()`, plus any non-standard action as an extra key. `bootstrap/app.tsx`
		 * maps each leaf with its own `requireApiKey(scope)` since read/write scopes differ.
		 */
		v1: {
			status: get("/api/v1/status"),
			backfillDailyStats: post("/api/v1/backfill-daily-stats"),

			/**
			 * Runs a one-shot check against a target described in the request body, with no
			 * monitor behind it — its own top-level leaf, since the body's `type`
			 * discriminator alone picks which kind of check to run.
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
				 * The monitor's tracked records and the toggle deciding which of them alert, kept
				 * on the existing `dns-monitors:read`/`:write` scopes, since reconfiguring a
				 * monitor and picking its watched records share the same authority. `PATCH` touches only `isEnabled`.
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

			/**
			 * On the generic `monitors:read`/`:write` scopes, since no flow-specific pair is
			 * grantable — a key that may reconfigure a monitor may reconfigure this one too.
			 */
			flowMonitors: {
				...resources("/api/v1/flow-monitors", {
					param: "flowMonitorId",
					exclude: ["new", "edit"],
				}),
				results: get("/api/v1/flow-monitors/:flowMonitorId/results"),
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

			/**
			 * `destroy` reads the id from the JSON body, since `DELETE /api/v1/team-domains`
			 * carries no id segment for `resources()` to bind as a `:id` param — added by hand.
			 */
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
