/**
 * Application bootstrap that assembles the uptime fetch-router. It registers the
 * core middleware stack (async context, logging, form data, method override, session,
 * auth, language resolution for the HTML surface, cross-origin protection, HTML
 * rendering), mounts the web routes with their auth guards, and wires a
 * request-scoped SSR renderer that resolves and follows nested frame redirects. It
 * exists as the composition root shared by the worker and any other runtime entry
 * point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, Router } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";
import type { ResolveFrameContext } from "remix/ui/server";

import { asyncContext } from "remix/async-context-middleware";
import { cop } from "remix/cop-middleware";
import { createController, createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { renderWith } from "remix/render-middleware";
import { renderToStream } from "remix/ui/server";

import { createTeam, leaveTeam, updateLanguage } from "~/app/http/controllers/actions/account";
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
	updateDnsMonitor,
} from "~/app/http/controllers/actions/dns-monitors";
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
import dnsMonitorsController, { dnsMonitorsRoutes } from "~/app/http/controllers/api/dns-monitors";
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
import dnsMonitorEdit from "~/app/http/controllers/app/team/dns-monitor-edit";
import dnsMonitorNew from "~/app/http/controllers/app/team/dns-monitor-new";
import dnsMonitorShow from "~/app/http/controllers/app/team/dns-monitor-show";
import dnsMonitors from "~/app/http/controllers/app/team/dns-monitors";
import httpMonitors from "~/app/http/controllers/app/team/http-monitors";
import teamIndex from "~/app/http/controllers/app/team/index";
import maintenanceWindowEdit from "~/app/http/controllers/app/team/maintenance-window-edit";
import maintenanceWindowNew from "~/app/http/controllers/app/team/maintenance-window-new";
import maintenanceWindows from "~/app/http/controllers/app/team/maintenance-windows";
import monitorCardHeatmap from "~/app/http/controllers/app/team/monitor-card-heatmap";
import monitorCardP99ResponseTime from "~/app/http/controllers/app/team/monitor-card-p99-response-time";
import monitorCardSlowestResult from "~/app/http/controllers/app/team/monitor-card-slowest-result";
import monitorCardUptime from "~/app/http/controllers/app/team/monitor-card-uptime";
import monitorCardUsage from "~/app/http/controllers/app/team/monitor-card-usage";
import monitorEdit from "~/app/http/controllers/app/team/monitor-edit";
import monitorNew from "~/app/http/controllers/app/team/monitor-new";
import monitorShow from "~/app/http/controllers/app/team/monitor-show";
import settings from "~/app/http/controllers/app/team/settings";
import statusPageEdit from "~/app/http/controllers/app/team/status-page-edit";
import statusPageNew from "~/app/http/controllers/app/team/status-page-new";
import statusPages from "~/app/http/controllers/app/team/status-pages";
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
import auth from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import logger from "~/app/http/middleware/logger";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import routes from "~/routes/web";

/**
 * Path prefix of the JSON surface. Requests under it carry their own bearer-token
 * auth (see `requireApiKey`), are called server-to-server, and answer with JSON
 * that is never translated — so both cross-origin protection and language
 * resolution are scoped around this one boundary.
 */
const API_PATH_PREFIX = "/api/";

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
	// Non-tuple `Middleware[]`: values middleware expose on the context are declared
	// via `declare module "remix/fetch-router"` augmentations in their own files,
	// not through the transform-typed middleware chain (see AGENTS.md).
	let globalMiddleware: Middleware[] = [
		asyncContext(),
		logger,
		formData() as Middleware,
		methodOverride(),
		createSessionMiddleware(options.kv, options.cookieSecret, options.secure) as Middleware,
		auth as Middleware,
		// Stays after the session middleware, whose session the language detector reads
		// the stored language from, and skips the JSON surface: resolving a language and
		// building an i18next instance is wasted work for a response nothing translates,
		// the unauthenticated cron-ping endpoint included.
		htmlOnly(i18n),
		// Cross-origin protection doesn't apply to the JSON surface either.
		cop({ insecureBypassPatterns: [`${API_PATH_PREFIX}{path...}`] }),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({
		middleware: globalMiddleware,
		/**
		 * Renders the translated 404 page for unmatched paths. A path under
		 * {@link API_PATH_PREFIX} that matches no route still lands here, and `htmlOnly`
		 * skipped language resolution for it, so resolve the language for that one case
		 * before rendering instead of translating through an absent `ctx.i18next`.
		 */
		defaultHandler(context) {
			if (!context.url.pathname.startsWith(API_PATH_PREFIX)) return defaultHandler(context);
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

	// Public marketing pages, legal pages, docs, and the sitemap. Anonymous — no
	// requireUser/requireTeam middleware.
	router.map(routes.marketing.feature, marketingFeature);
	router.map(routes.marketing.audience, marketingAudience);
	router.map(routes.marketing.useCase, marketingUseCase);
	router.map(routes.marketing.comparison, marketingComparison);
	router.map(routes.legal.privacy, privacy);
	router.map(routes.legal.terms, terms);
	router.map(routes.docs.index, docsIndex);
	router.map(routes.docs.show, docsShow);
	router.map(routes.sitemap, sitemap);

	// Each of these controllers bakes its own `requireUser`/`requireTeam` (and, where
	// noted, `requireRole`) chain into its `createAction` call instead of supplying
	// middleware here, so `router.map()` can take the controller's default export
	// directly with no `RequestHandler` cast — see e.g. `app/team/dashboard.tsx`.
	router.map(routes.app.index, appIndex);
	router.map(routes.app.team.index, teamIndex);
	router.map(routes.app.team.dashboard.index, teamDashboard);
	router.map(routes.app.team.dashboard.panel, dashboardPanel);
	router.map(routes.app.team.dashboard.cards.usage, dashboardCardUsage);
	router.map(routes.app.team.dashboard.cards.uptime, dashboardCardUptime);
	router.map(routes.app.team.dashboard.cards.slowestEndpoint, dashboardCardSlowestEndpoint);
	router.map(routes.app.team.dashboard.cards.count, dashboardCardCount);
	router.map(routes.app.team.monitors.index, httpMonitors);
	router.map(routes.app.team.monitors.new, monitorNew);
	router.map(routes.app.team.monitors.show, monitorShow);
	router.map(routes.app.team.monitors.edit, monitorEdit);
	router.map(routes.app.team.monitors.cards.usage, monitorCardUsage);
	router.map(routes.app.team.monitors.cards.slowestResult, monitorCardSlowestResult);
	router.map(routes.app.team.monitors.cards.uptime, monitorCardUptime);
	router.map(routes.app.team.monitors.cards.heatmap, monitorCardHeatmap);
	router.map(routes.app.team.monitors.cards.p99ResponseTime, monitorCardP99ResponseTime);
	router.map(routes.app.team.dnsMonitors.index, dnsMonitors);
	router.map(routes.app.team.dnsMonitors.new, dnsMonitorNew);
	router.map(routes.app.team.dnsMonitors.show, dnsMonitorShow);
	router.map(routes.app.team.dnsMonitors.edit, dnsMonitorEdit);
	router.map(routes.app.team.tcpMonitors.index, tcpMonitors);
	router.map(routes.app.team.tcpMonitors.new, tcpMonitorNew);
	router.map(routes.app.team.tcpMonitors.show, tcpMonitorShow);
	router.map(routes.app.team.tcpMonitors.edit, tcpMonitorEdit);
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

	// `routes.actions` is now nested by resource (see its docblock in `routes/web.ts`),
	// and `createController()` only accepts a route map whose every key is a leaf
	// `Route` — a nested group key types as `never` in its `actions` object — so each
	// leaf group below gets its own `router.map()`/`createController()` call instead of
	// one call across the whole `actions` tree. All of them still share the same
	// member-level `[requireUser, requireTeam]` chain, repeated as an inline array at
	// each call site rather than a shared variable — inline arrays are what let
	// TypeScript infer the middleware-provided context (see this file's imports'
	// `remix/fetch-router` README on `createController()`).
	router.map(
		routes.actions.monitor.http,
		createController(routes.actions.monitor.http, {
			middleware: [requireUser, requireTeam],
			actions: {
				create: createMonitor,
				update: updateMonitor,
				delete: deleteMonitor,
				play: playMonitor,
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
	// `setDashboardTab` bakes its own `requireUser`/`requireTeam` chain into its own
	// `createAction()` call (see `app/http/controllers/actions/dashboard.ts`), the same
	// pattern the `app.team.*` page controllers above use, since it's a single `Route`
	// rather than a `RouteMap` and so can't take a controller-level `middleware` option.
	router.map(routes.actions.setDashboardTab, setDashboardTab);

	// A separate group (see `routes/web.ts`'s docblock on `teamAdminActions`), so
	// `requireRole("admin")` layers on top of the member-level chain the `actions`
	// group above uses, without restricting those member-level actions too. Same
	// one-call-per-leaf-group constraint as `actions` above applies here too.
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

	// Not team-scoped: reached from the account page, which lists every team the
	// viewer belongs to rather than acting on the one team in its own URL.
	router.map(
		routes.accountActions,
		createController(routes.accountActions, {
			middleware: [requireUser],
			actions: {
				createTeam,
				leaveTeam,
				updateLanguage,
			},
		}),
	);

	// Public, unauthenticated: the cron-job ping endpoint (see its controller's
	// docblock for why it doesn't sit behind `requireUser`/`requireTeam`).
	router.map(routes.api.cronJobPing, cronJobPing);

	// Bearer-API-key-gated REST API. Each file with 2+ actions is wired through a
	// single `createController()` call keyed by that file's own exported route-map
	// object (e.g. `monitorRoutes`), so read/write methods on the same resource can
	// still require different scopes via each action's own `middleware` (see
	// `routes/web.ts`'s docblock on the `api.v1` group). Single-action files stay
	// plain `createAction()` default exports mapped directly to their one route.
	router.map(routes.api.v1.status, statusShow);
	router.map(routes.api.v1.backfillDailyStats, backfillDailyStatsCreate);

	router.map(monitorsRoutes, monitorsController);
	router.map(monitorRoutes, monitorController);
	router.map(monitorContentChecksRoutes, monitorContentChecksController);

	router.map(dnsMonitorsRoutes, dnsMonitorsController);
	router.map(dnsMonitorRoutes, dnsMonitorController);

	router.map(tcpMonitorsRoutes, tcpMonitorsController);
	router.map(tcpMonitorRoutes, tcpMonitorController);

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

/**
 * Scopes a global middleware to the HTML surface: requests under
 * {@link API_PATH_PREFIX} skip it and go straight to the rest of the chain. Use it
 * for work only a rendered page benefits from, so the JSON surface never pays for
 * it; middleware the API also needs stays in the chain unwrapped.
 *
 * @param middleware - The middleware to run for everything outside `/api/`.
 * @returns A middleware that either delegates to it or continues the chain.
 */
function htmlOnly(middleware: Middleware): Middleware {
	return (context, next) => {
		if (context.url.pathname.startsWith(API_PATH_PREFIX)) return next();
		return middleware(context, next);
	};
}

/** Creates a request-scoped renderer for server-side HTML responses. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveFrame(ctx.router, ctx.request, src, target, context);
			},
		});

		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return new Response(stream, { ...init, headers });
	};
}

/** Fetches frame HTML through the current router so SSR frames share request context. */
async function resolveFrame(
	router: Router,
	request: Request,
	src: string,
	target?: string,
	context?: ResolveFrameContext,
) {
	let frameSrc = context?.currentFrameSrc ?? request.url;
	let url = new URL(src, frameSrc);
	let headers = new Headers();
	headers.set("accept", "text/html");
	headers.set("accept-encoding", "identity");
	headers.set("x-remix-frame", "true");

	if (target) headers.set("x-remix-target", target);

	let cookie = request.headers.get("cookie");
	if (cookie) headers.set("cookie", cookie);

	let res = await followFrameRedirects(router, request, url, headers);
	if (res.body) return res.body;
	if (res.ok) return res.text();
	return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`;
}

/** Follows SSR frame redirects without letting fetch auto-follow with changed headers. */
async function followFrameRedirects(router: Router, request: Request, url: URL, headers: Headers) {
	let currentUrl = url;
	let redirectsRemaining = 10;

	while (true) {
		let res = await router.fetch(
			new Request(currentUrl, { method: "GET", headers, signal: request.signal }),
		);
		let location = res.headers.get("location");
		if (!location || res.status < 300 || res.status >= 400) return res;

		if (redirectsRemaining-- <= 0) throw new Error("Too many frame redirects");
		currentUrl = new URL(location, currentUrl);
	}
}
