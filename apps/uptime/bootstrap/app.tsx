/**
 * Assembles the uptime fetch-router: the global middleware stack (async
 * context, logging, mail, form data, method override, session, auth,
 * language resolution, first-touch attribution, cross-origin protection,
 * HTML rendering) followed by every route mapped to its controller. Shared
 * by the worker and any other runtime entry point.
 *
 * The SSR renderer lives in `~/app/http/render` so tests can reach it
 * directly — the controllers mounted here pull in bundler-only globs that
 * block any test from importing this module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import billing from "@sdxc/billing/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
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
import {
	cancelDeletion,
	createTeam,
	exportData,
	leaveTeam,
	requestDeletion,
	updateEmails,
	updateLanguage,
} from "~/app/http/controllers/actions/account";
import { createAlert, deleteAlert, updateAlert } from "~/app/http/controllers/actions/alerts";
import { createApiKey, deleteApiKey } from "~/app/http/controllers/actions/api-keys";
import {
	createContentCheck,
	deleteContentCheck,
} from "~/app/http/controllers/actions/content-checks";
import {
	createCronJob,
	deleteCronJob,
	updateCronJob,
} from "~/app/http/controllers/actions/cron-jobs";
import { setDashboardTab } from "~/app/http/controllers/actions/dashboard";
import {
	checkDnsMonitor,
	createDnsMonitor,
	deleteDnsMonitor,
	importDnsMonitorZoneFile,
	reviewDnsMonitor,
	toggleDnsMonitorRecord,
	updateDnsMonitor,
} from "~/app/http/controllers/actions/dns-monitors";
import {
	checkFlowMonitor,
	createFlowMonitor,
	deleteFlowMonitor,
	updateFlowMonitor,
} from "~/app/http/controllers/actions/flow-monitors";
import { createInvite, revokeInvite } from "~/app/http/controllers/actions/invites";
import {
	createMaintenanceWindow,
	deleteMaintenanceWindow,
	endMaintenanceWindow,
	updateMaintenanceWindow,
} from "~/app/http/controllers/actions/maintenance-windows";
import {
	createMonitor,
	deleteMonitor,
	playMonitor,
	updateMonitor,
} from "~/app/http/controllers/actions/monitors";
import { importMonitors } from "~/app/http/controllers/actions/monitors-import";
import { runPing } from "~/app/http/controllers/actions/ping";
import { updateSsl } from "~/app/http/controllers/actions/ssl";
import {
	createStatusPage,
	deleteStatusPage,
	updateStatusPage,
} from "~/app/http/controllers/actions/status-pages";
import {
	checkTcpMonitor,
	createTcpMonitor,
	deleteTcpMonitor,
	updateTcpMonitor,
} from "~/app/http/controllers/actions/tcp-monitors";
import {
	changeRole,
	deleteTeam,
	removeMember,
	updateTeam,
} from "~/app/http/controllers/actions/team";
import {
	addDomain,
	removeDomain,
	retryDomainVerification,
} from "~/app/http/controllers/actions/team-domains";
import alertController, { alertRoutes } from "~/app/http/controllers/api/alert";
import alertsController, { alertsRoutes } from "~/app/http/controllers/api/alerts";
import { apiKeyDestroy } from "~/app/http/controllers/api/api-key";
import apiKeysController, { apiKeysRoutes } from "~/app/http/controllers/api/api-keys";
import { backfillDailyStatsCreate } from "~/app/http/controllers/api/backfill-daily-stats";
import cronJobController, { cronJobRoutes } from "~/app/http/controllers/api/cron-job";
import cronJobPing from "~/app/http/controllers/api/cron-job-ping";
import cronJobsController, { cronJobsRoutes } from "~/app/http/controllers/api/cron-jobs";
import dnsMonitorController, { dnsMonitorRoutes } from "~/app/http/controllers/api/dns-monitor";
import dnsMonitorRecordsController, {
	dnsMonitorRecordsRoutes,
} from "~/app/http/controllers/api/dns-monitor-records";
import dnsMonitorsController, { dnsMonitorsRoutes } from "~/app/http/controllers/api/dns-monitors";
import flowMonitorsController, {
	flowMonitorsRoutes,
} from "~/app/http/controllers/api/flow-monitors";
import { inviteDestroy } from "~/app/http/controllers/api/invite";
import invitesController, { invitesRoutes } from "~/app/http/controllers/api/invites";
import maintenanceController, { maintenanceRoutes } from "~/app/http/controllers/api/maintenance";
import maintenanceWindowController, {
	maintenanceWindowRoutes,
} from "~/app/http/controllers/api/maintenance-window";
import { membershipsIndex } from "~/app/http/controllers/api/memberships";
import monitorController, { monitorRoutes } from "~/app/http/controllers/api/monitor";
import monitorContentChecksController, {
	monitorContentChecksRoutes,
} from "~/app/http/controllers/api/monitor-content-checks";
import monitorsController, { monitorsRoutes } from "~/app/http/controllers/api/monitors";
import pingCreate from "~/app/http/controllers/api/ping";
import { statusShow } from "~/app/http/controllers/api/status";
import statusPageApiController, { statusPageRoutes } from "~/app/http/controllers/api/status-page";
import statusPagesController, { statusPagesRoutes } from "~/app/http/controllers/api/status-pages";
import tcpMonitorController, { tcpMonitorRoutes } from "~/app/http/controllers/api/tcp-monitor";
import tcpMonitorsController, { tcpMonitorsRoutes } from "~/app/http/controllers/api/tcp-monitors";
import teamController, { teamRoutes } from "~/app/http/controllers/api/team";
import teamDomainsController, { teamDomainsRoutes } from "~/app/http/controllers/api/team-domains";
import appIndex from "~/app/http/controllers/app/index";
import account from "~/app/http/controllers/app/team/account";
import alertEdit from "~/app/http/controllers/app/team/alert-edit";
import alertHistory from "~/app/http/controllers/app/team/alert-history";
import alertNew from "~/app/http/controllers/app/team/alert-new";
import alerts from "~/app/http/controllers/app/team/alerts";
import apiKeyNew from "~/app/http/controllers/app/team/api-key-new";
import apiKeys from "~/app/http/controllers/app/team/api-keys";
import checkout from "~/app/http/controllers/app/team/checkout";
import cronJobEdit from "~/app/http/controllers/app/team/cron-job-edit";
import cronJobNew from "~/app/http/controllers/app/team/cron-job-new";
import cronJobShow from "~/app/http/controllers/app/team/cron-job-show";
import cronJobs from "~/app/http/controllers/app/team/cron-jobs";
import teamDashboard from "~/app/http/controllers/app/team/dashboard";
import dashboardCardCount from "~/app/http/controllers/app/team/dashboard-card-count";
import dashboardCardSlowestEndpoint from "~/app/http/controllers/app/team/dashboard-card-slowest-endpoint";
import dashboardCardUptime from "~/app/http/controllers/app/team/dashboard-card-uptime";
import dashboardCardUsage from "~/app/http/controllers/app/team/dashboard-card-usage";
import dashboardPanel from "~/app/http/controllers/app/team/dashboard-panel";
import dashboardQuickPing from "~/app/http/controllers/app/team/dashboard-quick-ping";
import dnsMonitorCardCheckHistory from "~/app/http/controllers/app/team/dns-monitor-card-check-history";
import dnsMonitorCardResults from "~/app/http/controllers/app/team/dns-monitor-card-results";
import dnsMonitorCardUptimeHistory from "~/app/http/controllers/app/team/dns-monitor-card-uptime-history";
import dnsMonitorEdit from "~/app/http/controllers/app/team/dns-monitor-edit";
import dnsMonitorNew from "~/app/http/controllers/app/team/dns-monitor-new";
import dnsMonitorReview from "~/app/http/controllers/app/team/dns-monitor-review";
import dnsMonitorShow from "~/app/http/controllers/app/team/dns-monitor-show";
import dnsMonitors from "~/app/http/controllers/app/team/dns-monitors";
import flowMonitorCardResults from "~/app/http/controllers/app/team/flow-monitor-card-results";
import flowMonitorEdit from "~/app/http/controllers/app/team/flow-monitor-edit";
import flowMonitorNew from "~/app/http/controllers/app/team/flow-monitor-new";
import flowMonitorShow from "~/app/http/controllers/app/team/flow-monitor-show";
import flowMonitors from "~/app/http/controllers/app/team/flow-monitors";
import httpMonitors from "~/app/http/controllers/app/team/http-monitors";
import teamIndex from "~/app/http/controllers/app/team/index";
import maintenanceWindowEdit from "~/app/http/controllers/app/team/maintenance-window-edit";
import maintenanceWindowNew from "~/app/http/controllers/app/team/maintenance-window-new";
import maintenanceWindows from "~/app/http/controllers/app/team/maintenance-windows";
import monitorCardP99ResponseTime from "~/app/http/controllers/app/team/monitor-card-p99-response-time";
import monitorCardSlowestResult from "~/app/http/controllers/app/team/monitor-card-slowest-result";
import monitorCardUptime from "~/app/http/controllers/app/team/monitor-card-uptime";
import monitorCardUptimeHistory from "~/app/http/controllers/app/team/monitor-card-uptime-history";
import monitorCardUsage from "~/app/http/controllers/app/team/monitor-card-usage";
import monitorEdit from "~/app/http/controllers/app/team/monitor-edit";
import monitorNew from "~/app/http/controllers/app/team/monitor-new";
import monitorRunStatus from "~/app/http/controllers/app/team/monitor-run-status";
import monitorShow from "~/app/http/controllers/app/team/monitor-show";
import monitorsImport from "~/app/http/controllers/app/team/monitors-import";
import settings from "~/app/http/controllers/app/team/settings";
import statusPageEdit from "~/app/http/controllers/app/team/status-page-edit";
import statusPageNew from "~/app/http/controllers/app/team/status-page-new";
import statusPages from "~/app/http/controllers/app/team/status-pages";
import tcpMonitorCardResults from "~/app/http/controllers/app/team/tcp-monitor-card-results";
import tcpMonitorCardUptimeHistory from "~/app/http/controllers/app/team/tcp-monitor-card-uptime-history";
import tcpMonitorEdit from "~/app/http/controllers/app/team/tcp-monitor-edit";
import tcpMonitorNew from "~/app/http/controllers/app/team/tcp-monitor-new";
import tcpMonitorShow from "~/app/http/controllers/app/team/tcp-monitor-show";
import tcpMonitors from "~/app/http/controllers/app/team/tcp-monitors";
import authController from "~/app/http/controllers/auth";
import defaultHandler from "~/app/http/controllers/default-handler";
import docsIndex from "~/app/http/controllers/docs-index";
import docsShow from "~/app/http/controllers/docs-show";
import healthcheck from "~/app/http/controllers/healthcheck";
import healthcheckAnalyticsEngine from "~/app/http/controllers/healthcheck-analytics-engine";
import home from "~/app/http/controllers/home";
import inviteController from "~/app/http/controllers/invite";
import logoutController from "~/app/http/controllers/logout";
import marketingAudience from "~/app/http/controllers/marketing-audience";
import marketingComparison from "~/app/http/controllers/marketing-comparison";
import marketingFeature from "~/app/http/controllers/marketing-feature";
import marketingUseCase from "~/app/http/controllers/marketing-use-case";
import privacy from "~/app/http/controllers/privacy";
import sitemap from "~/app/http/controllers/sitemap";
import statusPageController from "~/app/http/controllers/status-page";
import terms from "~/app/http/controllers/terms";
import trialCheck from "~/app/http/controllers/trial/index";
import trialLead from "~/app/http/controllers/trial/lead";
import trialReport from "~/app/http/controllers/trial/report";
import trialUnsubscribe from "~/app/http/controllers/trial/unsubscribe";
import trust from "~/app/http/controllers/trust";
import polarWebhook from "~/app/http/controllers/webhooks/polar";
import { attribution } from "~/app/http/middleware/attribution";
import auth from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import { createHtmlRenderer } from "~/app/http/render";
import { polar } from "~/app/lib/billing";
import { logger } from "~/bootstrap/logger";
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
		 * earlier, this resolves the language itself before rendering.
		 */
		defaultHandler(context) {
			if (!isMachinePath(context.url.pathname)) return defaultHandler(context);
			return i18n(context, async () => defaultHandler(context));
		},
	});

	router.map(routes.home, home);
	router.map(routes.healthcheck, healthcheck);
	router.map(routes.healthcheckAnalyticsEngine, healthcheckAnalyticsEngine);
	router.map(routes.auth, authController);
	router.map(routes.logout, logoutController);
	router.map(routes.statusPage, statusPageController);
	router.map(routes.invite, inviteController);

	/**
	 * Public try-it surface: outside every auth guard since using it needs no
	 * account. Each leaf guards itself instead — `trial-guard.ts` for
	 * `trial.check`'s POST, an unguessable URL token for `trial.unsubscribe`.
	 */
	router.map(routes.trial.check, trialCheck);
	router.map(routes.trial.lead, trialLead);
	router.map(routes.trial.unsubscribe, trialUnsubscribe);
	router.map(routes.trial.report, trialReport);

	router.map(routes.marketing.feature, marketingFeature);
	router.map(routes.marketing.audience, marketingAudience);
	router.map(routes.marketing.useCase, marketingUseCase);
	router.map(routes.marketing.comparison, marketingComparison);
	router.map(routes.trust, trust);
	router.map(routes.legal.privacy, privacy);
	router.map(routes.legal.terms, terms);
	router.map(routes.docs.index, docsIndex);
	router.map(routes.docs.show, docsShow);
	router.map(routes.sitemap, sitemap);

	/**
	 * Each controller bakes its own `requireUser`/`requireTeam` (and, where
	 * noted, `requireRole`) chain into its `createAction` call, so `router.map()`
	 * takes its default export directly, with no `RequestHandler` cast needed.
	 */
	router.map(routes.app.index, appIndex);
	router.map(routes.app.team.index, teamIndex);
	router.map(routes.app.team.dashboard.index, teamDashboard);
	router.map(routes.app.team.dashboard.panel, dashboardPanel);
	router.map(routes.app.team.dashboard.quickPing, dashboardQuickPing);
	router.map(routes.app.team.dashboard.cards.usage, dashboardCardUsage);
	router.map(routes.app.team.dashboard.cards.uptime, dashboardCardUptime);
	router.map(routes.app.team.dashboard.cards.slowestEndpoint, dashboardCardSlowestEndpoint);
	router.map(routes.app.team.dashboard.cards.count, dashboardCardCount);
	router.map(routes.app.team.monitorsImport, monitorsImport);
	router.map(routes.app.team.monitors.index, httpMonitors);
	router.map(routes.app.team.monitors.new, monitorNew);
	router.map(routes.app.team.monitors.show, monitorShow);
	router.map(routes.app.team.monitors.edit, monitorEdit);
	router.map(routes.app.team.monitors.cards.usage, monitorCardUsage);
	router.map(routes.app.team.monitors.cards.slowestResult, monitorCardSlowestResult);
	router.map(routes.app.team.monitors.cards.uptime, monitorCardUptime);
	router.map(routes.app.team.monitors.cards.uptimeHistory, monitorCardUptimeHistory);
	router.map(routes.app.team.monitors.cards.p99ResponseTime, monitorCardP99ResponseTime);
	router.map(routes.app.team.monitors.runStatus, monitorRunStatus);
	router.map(routes.app.team.dnsMonitors.index, dnsMonitors);
	router.map(routes.app.team.dnsMonitors.new, dnsMonitorNew);
	router.map(routes.app.team.dnsMonitors.show, dnsMonitorShow);
	router.map(routes.app.team.dnsMonitors.edit, dnsMonitorEdit);
	router.map(routes.app.team.dnsMonitors.review, dnsMonitorReview);
	router.map(routes.app.team.dnsMonitors.cards.uptimeHistory, dnsMonitorCardUptimeHistory);
	router.map(routes.app.team.dnsMonitors.cards.results, dnsMonitorCardResults);
	router.map(routes.app.team.dnsMonitors.cards.checkHistory, dnsMonitorCardCheckHistory);
	router.map(routes.app.team.flowMonitors.index, flowMonitors);
	router.map(routes.app.team.flowMonitors.new, flowMonitorNew);
	router.map(routes.app.team.flowMonitors.show, flowMonitorShow);
	router.map(routes.app.team.flowMonitors.edit, flowMonitorEdit);
	router.map(routes.app.team.flowMonitors.cards.results, flowMonitorCardResults);
	router.map(routes.app.team.tcpMonitors.index, tcpMonitors);
	router.map(routes.app.team.tcpMonitors.new, tcpMonitorNew);
	router.map(routes.app.team.tcpMonitors.show, tcpMonitorShow);
	router.map(routes.app.team.tcpMonitors.edit, tcpMonitorEdit);
	router.map(routes.app.team.tcpMonitors.cards.uptimeHistory, tcpMonitorCardUptimeHistory);
	router.map(routes.app.team.tcpMonitors.cards.results, tcpMonitorCardResults);
	router.map(routes.app.team.cronJobs.index, cronJobs);
	router.map(routes.app.team.cronJobs.new, cronJobNew);
	router.map(routes.app.team.cronJobs.show, cronJobShow);
	router.map(routes.app.team.cronJobs.edit, cronJobEdit);
	router.map(routes.app.team.alerts.index, alerts);
	router.map(routes.app.team.alerts.new, alertNew);
	router.map(routes.app.team.alerts.edit, alertEdit);
	router.map(routes.app.team.alerts.history, alertHistory);
	router.map(routes.app.team.maintenanceWindows.index, maintenanceWindows);
	router.map(routes.app.team.maintenanceWindows.new, maintenanceWindowNew);
	router.map(routes.app.team.maintenanceWindows.edit, maintenanceWindowEdit);
	router.map(routes.app.team.statusPages.index, statusPages);
	router.map(routes.app.team.statusPages.new, statusPageNew);
	router.map(routes.app.team.statusPages.edit, statusPageEdit);
	router.map(routes.app.team.settings, settings);
	router.map(routes.app.team.account, account);
	router.map(routes.app.team.apiKeys.index, apiKeys);
	router.map(routes.app.team.apiKeys.new, apiKeyNew);
	router.map(routes.app.team.checkout, checkout);

	/**
	 * Each leaf group gets its own `router.map()`/`createController()` call — a
	 * nested `routes.actions` key types as `never` for `createController()`. The
	 * `[requireUser, requireTeam]` chain repeats inline so TypeScript can infer context.
	 */
	router.map(
		routes.actions.monitor.http,
		createController(routes.actions.monitor.http, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: createMonitor,
				update: updateMonitor,
				delete: deleteMonitor,
				play: playMonitor,
				import: importMonitors,
				updateSsl,
				createContentCheck,
				deleteContentCheck,
			},
		}),
	);
	router.map(
		routes.actions.monitor.dns,
		createController(routes.actions.monitor.dns, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: createDnsMonitor,
				update: updateDnsMonitor,
				delete: deleteDnsMonitor,
				check: checkDnsMonitor,
				review: reviewDnsMonitor,
				toggleRecord: toggleDnsMonitorRecord,
				importZoneFile: importDnsMonitorZoneFile,
			},
		}),
	);
	router.map(
		routes.actions.monitor.tcp,
		createController(routes.actions.monitor.tcp, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: createTcpMonitor,
				update: updateTcpMonitor,
				delete: deleteTcpMonitor,
				check: checkTcpMonitor,
			},
		}),
	);
	router.map(
		routes.actions.monitor.flow,
		createController(routes.actions.monitor.flow, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: createFlowMonitor,
				update: updateFlowMonitor,
				delete: deleteFlowMonitor,
				check: checkFlowMonitor,
			},
		}),
	);
	router.map(
		routes.actions.cronJob,
		createController(routes.actions.cronJob, {
			middleware: [requireUser, requireTeam],
			actions: { create: createCronJob, update: updateCronJob, delete: deleteCronJob },
		}),
	);
	router.map(
		routes.actions.alert,
		createController(routes.actions.alert, {
			middleware: [requireUser, requireTeam],
			actions: { create: createAlert, update: updateAlert, delete: deleteAlert },
		}),
	);
	router.map(
		routes.actions.maintenanceWindow,
		createController(routes.actions.maintenanceWindow, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: createMaintenanceWindow,
				update: updateMaintenanceWindow,
				delete: deleteMaintenanceWindow,
				end: endMaintenanceWindow,
			},
		}),
	);
	router.map(
		routes.actions.statusPage,
		createController(routes.actions.statusPage, {
			middleware: [requireUser, requireTeam],
			actions: { create: createStatusPage, update: updateStatusPage, delete: deleteStatusPage },
		}),
	);
	/**
	 * `setDashboardTab` bakes its own `requireUser`/`requireTeam` chain into its
	 * own `createAction()` call, the same pattern the `app.team.*` page
	 * controllers above use — a single `Route` takes middleware only via `createAction()`.
	 */
	router.map(routes.actions.setDashboardTab, setDashboardTab);
	/** `runPing` is a single `Route` too, so it carries the same self-contained chain. */
	router.map(routes.actions.runPing, runPing);

	/**
	 * A separate group from `actions` above (see `routes/web.ts`'s docblock on
	 * `teamAdminActions`): `requireRole("admin")` layers on the same member-level
	 * chain, scoped to this group alone — same one-call-per-leaf-group constraint applies.
	 */
	router.map(
		routes.teamAdminActions.team,
		createController(routes.teamAdminActions.team, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: { update: updateTeam, delete: deleteTeam },
		}),
	);
	router.map(
		routes.teamAdminActions.member,
		createController(routes.teamAdminActions.member, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: { remove: removeMember, changeRole },
		}),
	);
	router.map(
		routes.teamAdminActions.invite,
		createController(routes.teamAdminActions.invite, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: { create: createInvite, revoke: revokeInvite },
		}),
	);
	router.map(
		routes.teamAdminActions.domain,
		createController(routes.teamAdminActions.domain, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: {
				add: addDomain,
				remove: removeDomain,
				retryVerification: retryDomainVerification,
			},
		}),
	);
	router.map(
		routes.teamAdminActions.apiKey,
		createController(routes.teamAdminActions.apiKey, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: { create: createApiKey, delete: deleteApiKey },
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
				createTeam,
				leaveTeam,
				updateLanguage,
				updateEmails,
				exportData,
				requestDeletion,
				cancelDeletion,
			},
		}),
	);

	/**
	 * Public, unauthenticated cron-job ping endpoint. Its `createAction()`
	 * middleware bakes in a per-caller budget; see its controller's docblock
	 * for the full authorization rationale.
	 */
	router.map(routes.api.cronJobPing, cronJobPing);

	/**
	 * Inbound webhooks, gated by `MACHINE_PATH_PREFIXES` above: the sender
	 * proves itself with a signature over the request body, verified by each
	 * controller before acting — standing in for the auth guard and `cop`.
	 */
	router.map(routes.webhooks.polar, polarWebhook);

	/**
	 * Bearer-API-key-gated REST API. Each file with 2+ actions wires through one
	 * `createController()` call keyed by its own route-map object, so same-
	 * resource methods can scope differently via each action's own `middleware`.
	 */
	router.map(routes.api.v1.status, statusShow);
	router.map(routes.api.v1.backfillDailyStats, backfillDailyStatsCreate);
	router.map(routes.api.v1.ping, pingCreate);

	router.map(monitorsRoutes, monitorsController);
	router.map(monitorRoutes, monitorController);
	router.map(monitorContentChecksRoutes, monitorContentChecksController);

	router.map(dnsMonitorsRoutes, dnsMonitorsController);
	router.map(dnsMonitorRoutes, dnsMonitorController);
	router.map(dnsMonitorRecordsRoutes, dnsMonitorRecordsController);

	router.map(tcpMonitorsRoutes, tcpMonitorsController);
	router.map(tcpMonitorRoutes, tcpMonitorController);

	router.map(flowMonitorsRoutes, flowMonitorsController);

	router.map(cronJobsRoutes, cronJobsController);
	router.map(cronJobRoutes, cronJobController);

	router.map(alertsRoutes, alertsController);
	router.map(alertRoutes, alertController);

	router.map(maintenanceRoutes, maintenanceController);
	router.map(maintenanceWindowRoutes, maintenanceWindowController);

	router.map(statusPagesRoutes, statusPagesController);
	router.map(statusPageRoutes, statusPageApiController);

	router.map(invitesRoutes, invitesController);
	router.map(routes.api.v1.invites.destroy, inviteDestroy);

	router.map(routes.api.v1.memberships, membershipsIndex);

	router.map(teamRoutes, teamController);

	router.map(teamDomainsRoutes, teamDomainsController);

	router.map(apiKeysRoutes, apiKeysController);
	router.map(routes.api.v1.apiKeys.destroy, apiKeyDestroy);

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
