/**
 * Assembles the uptime fetch-router: the global middleware stack (async
 * context, logging, the database, mail, form data, method override, session,
 * auth, language resolution, first-touch attribution, cross-origin protection,
 * HTML rendering) followed by every route mapped to its controller. Shared
 * by the worker and any other runtime entry point.
 *
 * Every route is mapped through `lazy()`, so the URL surface is complete at
 * startup while each controller arrives with the first request that reaches it.
 * A cold isolate evaluates the handful of modules it serves instead of the whole
 * route table, which here spans the marketing site, the signed-in app, and the API.
 *
 * The SSR renderer lives in `~/app/http/render` so tests can reach it directly,
 * without building a router to get at it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import billing from "@sdxc/billing/middleware";
import featureFlags from "@sdxc/flags/middleware/router";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import mail from "@sdxc/mail/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { renderWith } from "remix/middleware/render";
import { createController, createRouter } from "remix/router";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import defaultHandler from "~/app/http/controllers/default-handler";
import { attribution } from "~/app/http/middleware/attribution";
import auth, { getViewer } from "~/app/http/middleware/auth";
import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import { createHtmlRenderer } from "~/app/http/render";
import { polar } from "~/app/lib/billing";
import { createDatabase } from "~/app/lib/database";
import { flags } from "~/app/lib/flags";
import { logger } from "~/bootstrap/logger";
import {
	alertRoutes,
	alertsRoutes,
	apiKeysRoutes,
	cronJobRoutes,
	cronJobsRoutes,
	dnsMonitorRecordsRoutes,
	dnsMonitorRoutes,
	dnsMonitorsRoutes,
	flowMonitorsRoutes,
	invitesRoutes,
	maintenanceRoutes,
	maintenanceWindowRoutes,
	monitorContentChecksRoutes,
	monitorRoutes,
	monitorsRoutes,
	statusPageRoutes,
	statusPagesRoutes,
	tcpMonitorRoutes,
	tcpMonitorsRoutes,
	teamDomainsRoutes,
	teamRoutes,
} from "~/routes/api-groups";
import routes from "~/routes/web";

/**
 * Path prefix of the JSON surface: bearer-token auth, server-to-server
 * calls only, and untranslated JSON responses — so cross-origin checks and
 * language resolution skip it.
 */
const API_PATH_PREFIX = "/api/";

/**
 * Path prefix of the inbound-webhook surface. A sender proves itself with a signature
 * over the raw request body (see `webhooks/polar.ts`), so it has neither a session nor an
 * `Origin` to satisfy, and its responses are machine-read JSON.
 */
const WEBHOOK_PATH_PREFIX = "/webhooks/";

/**
 * Prefixes whose requests are machine-to-machine. Sharing one list gives
 * them the same exemption from cross-origin protection, language resolution,
 * and translated 404s, so adding a surface takes a single edit.
 */
const MACHINE_PATH_PREFIXES = [API_PATH_PREFIX, WEBHOOK_PATH_PREFIX];

namespace application {
	export interface Options {
		/** KV namespace backing session storage. */
		kv: KVNamespace;
		/** Secret used to sign the session cookie. */
		cookieSecret: string;
		/** Whether the session cookie should be marked `Secure`. */
		secure: boolean;
	}
}

/** Builds the app's fetch-router: global middleware, then every route mapped to its controller. */
export default function application(options: application.Options) {
	/**
	 * Typed as `Middleware[]` because each entry publishes its context value
	 * through a `declare module "remix/router"` augmentation in its own file,
	 * so the router's context typing already comes from there (see AGENTS.md).
	 */
	let globalMiddleware: Middleware[] = [
		/**
		 * Runs first so the session, the auth guard, cross-origin protection, and
		 * the per-route API guards all see a plain `GET` and treat a `HEAD` probe
		 * exactly like the request behind it.
		 */
		headRequests(),
		asyncContext(),
		log(logger) as Middleware,
		/**
		 * Publishes `ctx.db` on every surface. The session, the auth guard and every
		 * controller below read from it, so it leads the chain that reaches storage.
		 */
		database(createDatabase),
		/**
		 * Publishes `ctx.email` on every surface, including machine ones — the
		 * cron-job ping endpoint dispatches alerts too. Sits after the log so
		 * failures from its deferred flush queue can still reach `ctx.log`.
		 */
		mail({
			transport: () => new CloudflareTransport(env.EMAIL),
			from: MAIL_FROM,
			replyTo: MAIL_REPLY_TO,
		}),
		formData() as Middleware,
		methodOverride(),
		/**
		 * Publishes `ctx.billing` on every surface. It costs nothing per request — the provider
		 * is one module-scope object — and the webhook endpoint is a machine surface that needs
		 * it as much as a checkout redirect does.
		 */
		billing({ provider: polar }),
		createSessionMiddleware(options.kv, options.cookieSecret, options.secure) as Middleware,
		auth as Middleware,
		/**
		 * Publishes `ctx.flags` on every surface, machine ones included — the ad-hoc
		 * ping endpoint reads a flag before it reads a body. The subject is the
		 * signed-in viewer, so it stays after the auth guard; an endpoint whose
		 * subject is the team names that team on the evaluation itself.
		 */
		featureFlags(flags, { context: () => ({ targetingKey: getViewer()?.id }) }) as Middleware,
		/**
		 * Stays after the session middleware, whose stored language it reads.
		 * Wrapped in `htmlOnly` because resolving a language and building an
		 * i18next instance only pays off for a page a person actually reads.
		 */
		htmlOnly(i18n),
		/**
		 * Records first-touch acquisition while the visitor is still anonymous —
		 * the only time it's knowable. Wrapped in `htmlOnly` since a webhook or an
		 * API call has no campaign and no session worth writing to.
		 */
		htmlOnly(attribution),
		/**
		 * Machine surfaces authenticate differently: a webhook sender proves itself
		 * by signing the request body — a stronger claim than an `Origin` header —
		 * from a caller with no browser to send one from.
		 */
		cop({
			insecureBypassPatterns: MACHINE_PATH_PREFIXES.map((prefix) => `${prefix}{path...}`),
		}),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({
		middleware: globalMiddleware,
		/**
		 * Renders the translated 404 page for unmatched paths. A path under
		 * {@link MACHINE_PATH_PREFIXES} lands here too; since `htmlOnly` skipped it
		 * earlier, this resolves the language itself before rendering. Imported
		 * eagerly, unlike every mapped controller: a request that matches no route
		 * ends here, so deferring it would only delay the response it already owes.
		 */
		defaultHandler(context) {
			if (!isMachinePath(context.url.pathname)) return defaultHandler(context);
			return i18n(context, async () => defaultHandler(context));
		},
	});

	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		routes.healthcheck,
		lazy(() => import("~/app/http/controllers/healthcheck")),
	);
	router.map(
		routes.healthcheckAnalyticsEngine,
		lazy(() => import("~/app/http/controllers/healthcheck-analytics-engine")),
	);
	router.map(
		routes.auth,
		lazy(() => import("~/app/http/controllers/auth")),
	);
	router.map(
		routes.logout,
		lazy(() => import("~/app/http/controllers/logout")),
	);
	router.map(
		routes.statusPage,
		lazy(() => import("~/app/http/controllers/status-page")),
	);
	router.map(
		routes.invite,
		lazy(() => import("~/app/http/controllers/invite")),
	);

	/**
	 * Public try-it surface: outside every auth guard since using it needs no
	 * account. Each leaf guards itself instead — `trial-guard.ts` for
	 * `trial.check`'s POST, an unguessable URL token for `trial.unsubscribe`.
	 */
	router.map(
		routes.trial.check,
		lazy(() => import("~/app/http/controllers/trial/index")),
	);
	router.map(
		routes.trial.lead,
		lazy(() => import("~/app/http/controllers/trial/lead")),
	);
	router.map(
		routes.trial.unsubscribe,
		lazy(() => import("~/app/http/controllers/trial/unsubscribe")),
	);
	router.map(
		routes.trial.report,
		lazy(() => import("~/app/http/controllers/trial/report")),
	);

	router.map(
		routes.marketing.feature,
		lazy(() => import("~/app/http/controllers/marketing-feature")),
	);
	router.map(
		routes.marketing.audience,
		lazy(() => import("~/app/http/controllers/marketing-audience")),
	);
	router.map(
		routes.marketing.useCase,
		lazy(() => import("~/app/http/controllers/marketing-use-case")),
	);
	router.map(
		routes.marketing.comparison,
		lazy(() => import("~/app/http/controllers/marketing-comparison")),
	);
	router.map(
		routes.trust,
		lazy(() => import("~/app/http/controllers/trust")),
	);
	router.map(
		routes.legal.privacy,
		lazy(() => import("~/app/http/controllers/privacy")),
	);
	router.map(
		routes.legal.terms,
		lazy(() => import("~/app/http/controllers/terms")),
	);
	router.map(
		routes.docs.index,
		lazy(() => import("~/app/http/controllers/docs-index")),
	);
	router.map(
		routes.docs.show,
		lazy(() => import("~/app/http/controllers/docs-show")),
	);
	router.map(
		routes.sitemap,
		lazy(() => import("~/app/http/controllers/sitemap")),
	);

	/**
	 * Each controller bakes its own `requireUser`/`requireTeam` (and, where
	 * noted, `requireRole`) chain into its `createAction` call, so `lazy()`
	 * takes its module directly, with no guards passed alongside it.
	 */
	router.map(
		routes.app.index,
		lazy(() => import("~/app/http/controllers/app/index")),
	);
	router.map(
		routes.app.team.index,
		lazy(() => import("~/app/http/controllers/app/team/index")),
	);
	router.map(
		routes.app.team.dashboard.index,
		lazy(() => import("~/app/http/controllers/app/team/dashboard")),
	);
	router.map(
		routes.app.team.dashboard.panel,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-panel")),
	);
	router.map(
		routes.app.team.dashboard.quickPing,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-quick-ping")),
	);
	router.map(
		routes.app.team.dashboard.cards.usage,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-card-usage")),
	);
	router.map(
		routes.app.team.dashboard.cards.uptime,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-card-uptime")),
	);
	router.map(
		routes.app.team.dashboard.cards.slowestEndpoint,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-card-slowest-endpoint")),
	);
	router.map(
		routes.app.team.dashboard.cards.count,
		lazy(() => import("~/app/http/controllers/app/team/dashboard-card-count")),
	);
	router.map(
		routes.app.team.monitorsImport,
		lazy(() => import("~/app/http/controllers/app/team/monitors-import")),
	);
	router.map(
		routes.app.team.monitors.index,
		lazy(() => import("~/app/http/controllers/app/team/http-monitors")),
	);
	router.map(
		routes.app.team.monitors.new,
		lazy(() => import("~/app/http/controllers/app/team/monitor-new")),
	);
	router.map(
		routes.app.team.monitors.show,
		lazy(() => import("~/app/http/controllers/app/team/monitor-show")),
	);
	router.map(
		routes.app.team.monitors.edit,
		lazy(() => import("~/app/http/controllers/app/team/monitor-edit")),
	);
	router.map(
		routes.app.team.monitors.cards.usage,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-usage")),
	);
	router.map(
		routes.app.team.monitors.cards.slowestResult,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-slowest-result")),
	);
	router.map(
		routes.app.team.monitors.cards.uptime,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-uptime")),
	);
	router.map(
		routes.app.team.monitors.cards.uptimeHistory,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-uptime-history")),
	);
	router.map(
		routes.app.team.monitors.cards.p99ResponseTime,
		lazy(() => import("~/app/http/controllers/app/team/monitor-card-p99-response-time")),
	);
	router.map(
		routes.app.team.monitors.runStatus,
		lazy(() => import("~/app/http/controllers/app/team/monitor-run-status")),
	);
	router.map(
		routes.app.team.dnsMonitors.index,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitors")),
	);
	router.map(
		routes.app.team.dnsMonitors.new,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-new")),
	);
	router.map(
		routes.app.team.dnsMonitors.show,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-show")),
	);
	router.map(
		routes.app.team.dnsMonitors.edit,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-edit")),
	);
	router.map(
		routes.app.team.dnsMonitors.review,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-review")),
	);
	router.map(
		routes.app.team.dnsMonitors.cards.uptimeHistory,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-card-uptime-history")),
	);
	router.map(
		routes.app.team.dnsMonitors.cards.results,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-card-results")),
	);
	router.map(
		routes.app.team.dnsMonitors.cards.checkHistory,
		lazy(() => import("~/app/http/controllers/app/team/dns-monitor-card-check-history")),
	);
	router.map(
		routes.app.team.flowMonitors.index,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitors")),
	);
	router.map(
		routes.app.team.flowMonitors.new,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-new")),
	);
	router.map(
		routes.app.team.flowMonitors.show,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-show")),
	);
	router.map(
		routes.app.team.flowMonitors.edit,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-edit")),
	);
	router.map(
		routes.app.team.flowMonitors.cards.results,
		lazy(() => import("~/app/http/controllers/app/team/flow-monitor-card-results")),
	);
	router.map(
		routes.app.team.tcpMonitors.index,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitors")),
	);
	router.map(
		routes.app.team.tcpMonitors.new,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-new")),
	);
	router.map(
		routes.app.team.tcpMonitors.show,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-show")),
	);
	router.map(
		routes.app.team.tcpMonitors.edit,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-edit")),
	);
	router.map(
		routes.app.team.tcpMonitors.cards.uptimeHistory,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-card-uptime-history")),
	);
	router.map(
		routes.app.team.tcpMonitors.cards.results,
		lazy(() => import("~/app/http/controllers/app/team/tcp-monitor-card-results")),
	);
	router.map(
		routes.app.team.cronJobs.index,
		lazy(() => import("~/app/http/controllers/app/team/cron-jobs")),
	);
	router.map(
		routes.app.team.cronJobs.new,
		lazy(() => import("~/app/http/controllers/app/team/cron-job-new")),
	);
	router.map(
		routes.app.team.cronJobs.show,
		lazy(() => import("~/app/http/controllers/app/team/cron-job-show")),
	);
	router.map(
		routes.app.team.cronJobs.edit,
		lazy(() => import("~/app/http/controllers/app/team/cron-job-edit")),
	);
	router.map(
		routes.app.team.alerts.index,
		lazy(() => import("~/app/http/controllers/app/team/alerts")),
	);
	router.map(
		routes.app.team.alerts.new,
		lazy(() => import("~/app/http/controllers/app/team/alert-new")),
	);
	router.map(
		routes.app.team.alerts.edit,
		lazy(() => import("~/app/http/controllers/app/team/alert-edit")),
	);
	router.map(
		routes.app.team.alerts.history,
		lazy(() => import("~/app/http/controllers/app/team/alert-history")),
	);
	router.map(
		routes.app.team.maintenanceWindows.index,
		lazy(() => import("~/app/http/controllers/app/team/maintenance-windows")),
	);
	router.map(
		routes.app.team.maintenanceWindows.new,
		lazy(() => import("~/app/http/controllers/app/team/maintenance-window-new")),
	);
	router.map(
		routes.app.team.maintenanceWindows.edit,
		lazy(() => import("~/app/http/controllers/app/team/maintenance-window-edit")),
	);
	router.map(
		routes.app.team.statusPages.index,
		lazy(() => import("~/app/http/controllers/app/team/status-pages")),
	);
	router.map(
		routes.app.team.statusPages.new,
		lazy(() => import("~/app/http/controllers/app/team/status-page-new")),
	);
	router.map(
		routes.app.team.statusPages.edit,
		lazy(() => import("~/app/http/controllers/app/team/status-page-edit")),
	);
	router.map(
		routes.app.team.settings,
		lazy(() => import("~/app/http/controllers/app/team/settings")),
	);
	router.map(
		routes.app.team.account,
		lazy(() => import("~/app/http/controllers/app/team/account")),
	);
	router.map(
		routes.app.team.apiKeys.index,
		lazy(() => import("~/app/http/controllers/app/team/api-keys")),
	);
	router.map(
		routes.app.team.apiKeys.new,
		lazy(() => import("~/app/http/controllers/app/team/api-key-new")),
	);
	router.map(
		routes.app.team.checkout,
		lazy(() => import("~/app/http/controllers/app/team/checkout")),
	);

	/**
	 * Each leaf group gets its own `router.map()`/`createController()` call — a
	 * nested `routes.actions` key types as `never` for `createController()`. The
	 * `[requireUser, requireTeam]` chain repeats inline so TypeScript can infer context,
	 * and it answers an unauthorized request before the action's module is loaded.
	 *
	 * A group's actions come from several modules, so each one names its own loader.
	 * The ones sharing a module also share its chunk, imported once for whichever
	 * action is submitted first.
	 */
	router.map(
		routes.actions.monitor.http,
		createController(routes.actions.monitor.http, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/monitors").then((it) => it.createMonitor),
				),
				update: lazy(() =>
					import("~/app/http/controllers/actions/monitors").then((it) => it.updateMonitor),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/monitors").then((it) => it.deleteMonitor),
				),
				play: lazy(() =>
					import("~/app/http/controllers/actions/monitors").then((it) => it.playMonitor),
				),
				import: lazy(() =>
					import("~/app/http/controllers/actions/monitors-import").then((it) => it.importMonitors),
				),
				updateSsl: lazy(() =>
					import("~/app/http/controllers/actions/ssl").then((it) => it.updateSsl),
				),
				createContentCheck: lazy(() =>
					import("~/app/http/controllers/actions/content-checks").then(
						(it) => it.createContentCheck,
					),
				),
				deleteContentCheck: lazy(() =>
					import("~/app/http/controllers/actions/content-checks").then(
						(it) => it.deleteContentCheck,
					),
				),
			},
		}),
	);
	router.map(
		routes.actions.monitor.dns,
		createController(routes.actions.monitor.dns, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.createDnsMonitor),
				),
				update: lazy(() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.updateDnsMonitor),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.deleteDnsMonitor),
				),
				check: lazy(() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.checkDnsMonitor),
				),
				review: lazy(() =>
					import("~/app/http/controllers/actions/dns-monitors").then((it) => it.reviewDnsMonitor),
				),
				toggleRecord: lazy(() =>
					import("~/app/http/controllers/actions/dns-monitors").then(
						(it) => it.toggleDnsMonitorRecord,
					),
				),
				importZoneFile: lazy(() =>
					import("~/app/http/controllers/actions/dns-monitors").then(
						(it) => it.importDnsMonitorZoneFile,
					),
				),
			},
		}),
	);
	router.map(
		routes.actions.monitor.tcp,
		createController(routes.actions.monitor.tcp, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/tcp-monitors").then((it) => it.createTcpMonitor),
				),
				update: lazy(() =>
					import("~/app/http/controllers/actions/tcp-monitors").then((it) => it.updateTcpMonitor),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/tcp-monitors").then((it) => it.deleteTcpMonitor),
				),
				check: lazy(() =>
					import("~/app/http/controllers/actions/tcp-monitors").then((it) => it.checkTcpMonitor),
				),
			},
		}),
	);
	router.map(
		routes.actions.monitor.flow,
		createController(routes.actions.monitor.flow, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/flow-monitors").then((it) => it.createFlowMonitor),
				),
				update: lazy(() =>
					import("~/app/http/controllers/actions/flow-monitors").then((it) => it.updateFlowMonitor),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/flow-monitors").then((it) => it.deleteFlowMonitor),
				),
				check: lazy(() =>
					import("~/app/http/controllers/actions/flow-monitors").then((it) => it.checkFlowMonitor),
				),
			},
		}),
	);
	router.map(
		routes.actions.cronJob,
		createController(routes.actions.cronJob, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/cron-jobs").then((it) => it.createCronJob),
				),
				update: lazy(() =>
					import("~/app/http/controllers/actions/cron-jobs").then((it) => it.updateCronJob),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/cron-jobs").then((it) => it.deleteCronJob),
				),
			},
		}),
	);
	router.map(
		routes.actions.alert,
		createController(routes.actions.alert, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/alerts").then((it) => it.createAlert),
				),
				update: lazy(() =>
					import("~/app/http/controllers/actions/alerts").then((it) => it.updateAlert),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/alerts").then((it) => it.deleteAlert),
				),
			},
		}),
	);
	router.map(
		routes.actions.maintenanceWindow,
		createController(routes.actions.maintenanceWindow, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/maintenance-windows").then(
						(it) => it.createMaintenanceWindow,
					),
				),
				update: lazy(() =>
					import("~/app/http/controllers/actions/maintenance-windows").then(
						(it) => it.updateMaintenanceWindow,
					),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/maintenance-windows").then(
						(it) => it.deleteMaintenanceWindow,
					),
				),
				end: lazy(() =>
					import("~/app/http/controllers/actions/maintenance-windows").then(
						(it) => it.endMaintenanceWindow,
					),
				),
			},
		}),
	);
	router.map(
		routes.actions.statusPage,
		createController(routes.actions.statusPage, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/status-pages").then((it) => it.createStatusPage),
				),
				update: lazy(() =>
					import("~/app/http/controllers/actions/status-pages").then((it) => it.updateStatusPage),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/status-pages").then((it) => it.deleteStatusPage),
				),
			},
		}),
	);
	/**
	 * `setDashboardTab` bakes its own `requireUser`/`requireTeam` chain into its
	 * own `createAction()` call, the same pattern the `app.team.*` page
	 * controllers above use — a single `Route` takes middleware only via `createAction()`.
	 */
	router.map(
		routes.actions.setDashboardTab,
		lazy(() => import("~/app/http/controllers/actions/dashboard").then((it) => it.setDashboardTab)),
	);
	/** `runPing` is a single `Route` too, so it carries the same self-contained chain. */
	router.map(
		routes.actions.runPing,
		lazy(() => import("~/app/http/controllers/actions/ping").then((it) => it.runPing)),
	);

	/**
	 * A separate group from `actions` above (see `routes/web.ts`'s docblock on
	 * `teamAdminActions`): `requireRole("admin")` layers on the same member-level
	 * chain, scoped to this group alone — same one-call-per-leaf-group constraint applies.
	 */
	router.map(
		routes.teamAdminActions.team,
		createController(routes.teamAdminActions.team, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: {
				update: lazy(() =>
					import("~/app/http/controllers/actions/team").then((it) => it.updateTeam),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/team").then((it) => it.deleteTeam),
				),
			},
		}),
	);
	router.map(
		routes.teamAdminActions.member,
		createController(routes.teamAdminActions.member, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: {
				remove: lazy(() =>
					import("~/app/http/controllers/actions/team").then((it) => it.removeMember),
				),
				changeRole: lazy(() =>
					import("~/app/http/controllers/actions/team").then((it) => it.changeRole),
				),
			},
		}),
	);
	router.map(
		routes.teamAdminActions.invite,
		createController(routes.teamAdminActions.invite, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/invites").then((it) => it.createInvite),
				),
				revoke: lazy(() =>
					import("~/app/http/controllers/actions/invites").then((it) => it.revokeInvite),
				),
			},
		}),
	);
	router.map(
		routes.teamAdminActions.domain,
		createController(routes.teamAdminActions.domain, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: {
				add: lazy(() =>
					import("~/app/http/controllers/actions/team-domains").then((it) => it.addDomain),
				),
				remove: lazy(() =>
					import("~/app/http/controllers/actions/team-domains").then((it) => it.removeDomain),
				),
				retryVerification: lazy(() =>
					import("~/app/http/controllers/actions/team-domains").then(
						(it) => it.retryDomainVerification,
					),
				),
			},
		}),
	);
	router.map(
		routes.teamAdminActions.apiKey,
		createController(routes.teamAdminActions.apiKey, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: {
				create: lazy(() =>
					import("~/app/http/controllers/actions/api-keys").then((it) => it.createApiKey),
				),
				delete: lazy(() =>
					import("~/app/http/controllers/actions/api-keys").then((it) => it.deleteApiKey),
				),
			},
		}),
	);

	/**
	 * Guarded by `requireUser` alone. Reached from the account page, which lists
	 * every team the viewer belongs to, so each action carries its own team id.
	 */
	router.map(
		routes.accountActions,
		createController(routes.accountActions, {
			middleware: [requireUser],
			actions: {
				createTeam: lazy(() =>
					import("~/app/http/controllers/actions/account").then((it) => it.createTeam),
				),
				leaveTeam: lazy(() =>
					import("~/app/http/controllers/actions/account").then((it) => it.leaveTeam),
				),
				updateLanguage: lazy(() =>
					import("~/app/http/controllers/actions/account").then((it) => it.updateLanguage),
				),
				updateEmails: lazy(() =>
					import("~/app/http/controllers/actions/account").then((it) => it.updateEmails),
				),
				exportData: lazy(() =>
					import("~/app/http/controllers/actions/account").then((it) => it.exportData),
				),
				requestDeletion: lazy(() =>
					import("~/app/http/controllers/actions/account").then((it) => it.requestDeletion),
				),
				cancelDeletion: lazy(() =>
					import("~/app/http/controllers/actions/account").then((it) => it.cancelDeletion),
				),
			},
		}),
	);

	/**
	 * Public, unauthenticated cron-job ping endpoint. Its `createAction()`
	 * middleware bakes in a per-caller budget; see its controller's docblock
	 * for the full authorization rationale.
	 */
	router.map(
		routes.api.cronJobPing,
		lazy(() => import("~/app/http/controllers/api/cron-job-ping")),
	);

	/**
	 * Inbound webhooks, gated by `MACHINE_PATH_PREFIXES` above: the sender
	 * proves itself with a signature over the request body, verified by each
	 * controller before acting — standing in for the auth guard and `cop`.
	 */
	router.map(
		routes.webhooks.polar,
		lazy(() => import("~/app/http/controllers/webhooks/polar")),
	);

	/**
	 * Bearer-API-key-gated REST API. Each file with 2+ actions wires through one
	 * `createController()` call keyed by its own route-map object, declared in
	 * `routes/api-groups.ts` so mapping a group here leaves its controller unloaded.
	 */
	router.map(
		routes.api.v1.status,
		lazy(() => import("~/app/http/controllers/api/status").then((it) => it.statusShow)),
	);
	router.map(
		routes.api.v1.backfillDailyStats,
		lazy(() =>
			import("~/app/http/controllers/api/backfill-daily-stats").then(
				(it) => it.backfillDailyStatsCreate,
			),
		),
	);
	router.map(
		routes.api.v1.ping,
		lazy(() => import("~/app/http/controllers/api/ping")),
	);

	router.map(
		monitorsRoutes,
		lazy(() => import("~/app/http/controllers/api/monitors")),
	);
	router.map(
		monitorRoutes,
		lazy(() => import("~/app/http/controllers/api/monitor")),
	);
	router.map(
		monitorContentChecksRoutes,
		lazy(() => import("~/app/http/controllers/api/monitor-content-checks")),
	);

	router.map(
		dnsMonitorsRoutes,
		lazy(() => import("~/app/http/controllers/api/dns-monitors")),
	);
	router.map(
		dnsMonitorRoutes,
		lazy(() => import("~/app/http/controllers/api/dns-monitor")),
	);
	router.map(
		dnsMonitorRecordsRoutes,
		lazy(() => import("~/app/http/controllers/api/dns-monitor-records")),
	);

	router.map(
		tcpMonitorsRoutes,
		lazy(() => import("~/app/http/controllers/api/tcp-monitors")),
	);
	router.map(
		tcpMonitorRoutes,
		lazy(() => import("~/app/http/controllers/api/tcp-monitor")),
	);

	router.map(
		flowMonitorsRoutes,
		lazy(() => import("~/app/http/controllers/api/flow-monitors")),
	);

	router.map(
		cronJobsRoutes,
		lazy(() => import("~/app/http/controllers/api/cron-jobs")),
	);
	router.map(
		cronJobRoutes,
		lazy(() => import("~/app/http/controllers/api/cron-job")),
	);

	router.map(
		alertsRoutes,
		lazy(() => import("~/app/http/controllers/api/alerts")),
	);
	router.map(
		alertRoutes,
		lazy(() => import("~/app/http/controllers/api/alert")),
	);

	router.map(
		maintenanceRoutes,
		lazy(() => import("~/app/http/controllers/api/maintenance")),
	);
	router.map(
		maintenanceWindowRoutes,
		lazy(() => import("~/app/http/controllers/api/maintenance-window")),
	);

	router.map(
		statusPagesRoutes,
		lazy(() => import("~/app/http/controllers/api/status-pages")),
	);
	router.map(
		statusPageRoutes,
		lazy(() => import("~/app/http/controllers/api/status-page")),
	);

	router.map(
		invitesRoutes,
		lazy(() => import("~/app/http/controllers/api/invites")),
	);
	router.map(
		routes.api.v1.invites.destroy,
		lazy(() => import("~/app/http/controllers/api/invite").then((it) => it.inviteDestroy)),
	);

	router.map(
		routes.api.v1.memberships,
		lazy(() => import("~/app/http/controllers/api/memberships").then((it) => it.membershipsIndex)),
	);

	router.map(
		teamRoutes,
		lazy(() => import("~/app/http/controllers/api/team")),
	);

	router.map(
		teamDomainsRoutes,
		lazy(() => import("~/app/http/controllers/api/team-domains")),
	);

	router.map(
		apiKeysRoutes,
		lazy(() => import("~/app/http/controllers/api/api-keys")),
	);
	router.map(
		routes.api.v1.apiKeys.destroy,
		lazy(() => import("~/app/http/controllers/api/api-key").then((it) => it.apiKeyDestroy)),
	);

	return router;
}

function isMachinePath(pathname: string): boolean {
	return MACHINE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Scopes a global middleware to the HTML surface: requests under one of the
 * {@link MACHINE_PATH_PREFIXES} skip it and continue the chain unchanged. Use
 * it for page-only work; middleware both surfaces need stays unwrapped.
 *
 * @param middleware - The middleware to run for everything outside those prefixes.
 * @returns A middleware that either delegates to it or continues the chain.
 */
function htmlOnly(middleware: Middleware): Middleware {
	return (context, next) => {
		if (isMachinePath(context.url.pathname)) return next();
		return middleware(context, next);
	};
}
