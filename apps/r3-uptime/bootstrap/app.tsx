/**
 * Application bootstrap that assembles the r3-uptime fetch-router. It registers the
 * core middleware stack (async context, logging, form data, method override, session,
 * auth, cross-origin protection, HTML rendering), mounts the web routes with their
 * auth guards, and wires a request-scoped SSR renderer that resolves and follows
 * nested frame redirects. It exists as the composition root shared by the worker and
 * any other runtime entry point.
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
import {
	alertDestroy,
	alertEvents,
	alertShow,
	alertUpdate,
} from "~/app/http/controllers/api/alert";
import { alertsCreate, alertsIndex } from "~/app/http/controllers/api/alerts";
import { apiKeyDestroy } from "~/app/http/controllers/api/api-key";
import { apiKeysCreate, apiKeysIndex } from "~/app/http/controllers/api/api-keys";
import { backfillDailyStatsCreate } from "~/app/http/controllers/api/backfill-daily-stats";
import {
	cronJobDestroy,
	cronJobShow as apiCronJobShow,
	cronJobUpdate,
} from "~/app/http/controllers/api/cron-job";
import cronJobPing from "~/app/http/controllers/api/cron-job-ping";
import { cronJobsCreate, cronJobsIndex } from "~/app/http/controllers/api/cron-jobs";
import {
	dnsMonitorDestroy,
	dnsMonitorResults,
	dnsMonitorShow as apiDnsMonitorShow,
	dnsMonitorUpdate,
} from "~/app/http/controllers/api/dns-monitor";
import { dnsMonitorsCreate, dnsMonitorsIndex } from "~/app/http/controllers/api/dns-monitors";
import { inviteDestroy } from "~/app/http/controllers/api/invite";
import { invitesCreate, invitesIndex } from "~/app/http/controllers/api/invites";
import { maintenanceCreate, maintenanceIndex } from "~/app/http/controllers/api/maintenance";
import {
	maintenanceDestroy,
	maintenanceEnd,
	maintenanceShow,
	maintenanceUpdate,
} from "~/app/http/controllers/api/maintenance-window";
import { membershipsIndex } from "~/app/http/controllers/api/memberships";
import {
	monitorAlertEvents,
	monitorDestroy,
	monitorResults,
	monitorShow as apiMonitorShow,
	monitorStats,
	monitorUpdate,
} from "~/app/http/controllers/api/monitor";
import {
	monitorContentCheckDestroy,
	monitorContentChecksCreate,
	monitorContentChecksIndex,
} from "~/app/http/controllers/api/monitor-content-checks";
import { monitorsCreate, monitorsIndex, monitorsStats } from "~/app/http/controllers/api/monitors";
import { statusShow } from "~/app/http/controllers/api/status";
import {
	statusPageDestroy,
	statusPageMonitors,
	statusPageShow,
	statusPageUpdate,
} from "~/app/http/controllers/api/status-page";
import { statusPagesCreate, statusPagesIndex } from "~/app/http/controllers/api/status-pages";
import {
	tcpMonitorDestroy,
	tcpMonitorResults,
	tcpMonitorShow as apiTcpMonitorShow,
	tcpMonitorUpdate,
} from "~/app/http/controllers/api/tcp-monitor";
import { tcpMonitorsCreate, tcpMonitorsIndex } from "~/app/http/controllers/api/tcp-monitors";
import { teamShow, teamUpdate } from "~/app/http/controllers/api/team";
import {
	teamDomainsCreate,
	teamDomainsDestroy,
	teamDomainsIndex,
} from "~/app/http/controllers/api/team-domains";
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
		i18n,
		// `/api/` carries its own bearer-token auth (see `requireApiKey`) and is called
		// server-to-server, so cross-origin protection doesn't apply to it.
		cop({ insecureBypassPatterns: ["/api/{path...}"] }),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({
		middleware: globalMiddleware,
		defaultHandler,
	});

	router.map(routes.home, home);
	router.map(routes.healthcheck, healthcheck);
	router.map(routes.healthcheckAnalyticsEngine, healthcheckAnalyticsEngine);
	router.map(routes.auth, authController);
	router.map(routes.logout, logoutController);
	router.map(routes.statusPage, statusPageController);
	router.map(routes.invite, inviteController);

	// Public marketing pages, legal pages, docs, and the sitemap. Anonymous, matching
	// the OLD APP — no requireUser/requireTeam middleware.
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
	router.map(routes.app.team.dashboard, teamDashboard);
	router.map(routes.app.team.dashboardPanel, dashboardPanel);
	router.map(routes.app.team.httpMonitors, httpMonitors);
	router.map(routes.app.team.monitorNew, monitorNew);
	router.map(routes.app.team.monitorShow, monitorShow);
	router.map(routes.app.team.monitorEdit, monitorEdit);
	router.map(routes.app.team.dnsMonitors, dnsMonitors);
	router.map(routes.app.team.dnsMonitorNew, dnsMonitorNew);
	router.map(routes.app.team.dnsMonitorShow, dnsMonitorShow);
	router.map(routes.app.team.dnsMonitorEdit, dnsMonitorEdit);
	router.map(routes.app.team.tcpMonitors, tcpMonitors);
	router.map(routes.app.team.tcpMonitorNew, tcpMonitorNew);
	router.map(routes.app.team.tcpMonitorShow, tcpMonitorShow);
	router.map(routes.app.team.tcpMonitorEdit, tcpMonitorEdit);
	router.map(routes.app.team.cronJobs, cronJobs);
	router.map(routes.app.team.cronJobNew, cronJobNew);
	router.map(routes.app.team.cronJobShow, cronJobShow);
	router.map(routes.app.team.cronJobEdit, cronJobEdit);
	router.map(routes.app.team.alerts, alerts);
	router.map(routes.app.team.alertNew, alertNew);
	router.map(routes.app.team.alertEdit, alertEdit);
	router.map(routes.app.team.alertHistory, alertHistory);
	router.map(routes.app.team.maintenanceWindows, maintenanceWindows);
	router.map(routes.app.team.maintenanceWindowNew, maintenanceWindowNew);
	router.map(routes.app.team.maintenanceWindowEdit, maintenanceWindowEdit);
	router.map(routes.app.team.statusPages, statusPages);
	router.map(routes.app.team.statusPageNew, statusPageNew);
	router.map(routes.app.team.statusPageEdit, statusPageEdit);
	router.map(routes.app.team.settings, settings);
	router.map(routes.app.team.account, account);
	router.map(routes.app.team.apiKeys, apiKeys);
	router.map(routes.app.team.apiKeyNew, apiKeyNew);
	router.map(routes.app.team.checkout, checkout);

	router.map(
		routes.actions,
		createController(routes.actions, {
			middleware: [requireUser, requireTeam],
			actions: {
				createMonitor,
				updateMonitor,
				deleteMonitor,
				playMonitor,
				updateSsl,
				createContentCheck,
				deleteContentCheck,
				setDashboardTab,
				createDnsMonitor,
				updateDnsMonitor,
				deleteDnsMonitor,
				checkDnsMonitor,
				createTcpMonitor,
				updateTcpMonitor,
				deleteTcpMonitor,
				checkTcpMonitor,
				createCronJob,
				updateCronJob,
				deleteCronJob,
				createAlert,
				updateAlert,
				deleteAlert,
				createMaintenanceWindow,
				updateMaintenanceWindow,
				deleteMaintenanceWindow,
				endMaintenanceWindow,
				createStatusPage,
				updateStatusPage,
				deleteStatusPage,
			},
		}),
	);

	// A separate group (see `routes/web.ts`'s docblock on `teamAdminActions`), so
	// `requireRole("admin")` layers on top of the member-level chain the `actions`
	// group above uses, without restricting those member-level actions too.
	router.map(
		routes.teamAdminActions,
		createController(routes.teamAdminActions, {
			middleware: [requireUser, requireTeam, requireRole("admin")],
			actions: {
				updateTeam,
				deleteTeam,
				removeMember,
				changeRole,
				createInvite,
				revokeInvite,
				addDomain,
				removeDomain,
				retryDomainVerification,
				createApiKey,
				deleteApiKey,
			},
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

	// Bearer-API-key-gated REST API. Each leaf is mapped individually so read/write
	// methods on the same resource can require different scopes (see `routes/web.ts`'s
	// docblock on the `api.v1` group).
	router.map(routes.api.v1.status, statusShow);
	router.map(routes.api.v1.backfillDailyStats, backfillDailyStatsCreate);

	router.map(routes.api.v1.monitorsIndex, monitorsIndex);
	router.map(routes.api.v1.monitorsCreate, monitorsCreate);
	router.map(routes.api.v1.monitorsStats, monitorsStats);
	router.map(routes.api.v1.monitorShow, apiMonitorShow);
	router.map(routes.api.v1.monitorUpdate, monitorUpdate);
	router.map(routes.api.v1.monitorDestroy, monitorDestroy);
	router.map(routes.api.v1.monitorStats, monitorStats);
	router.map(routes.api.v1.monitorResults, monitorResults);
	router.map(routes.api.v1.monitorAlertEvents, monitorAlertEvents);
	router.map(routes.api.v1.monitorContentChecksIndex, monitorContentChecksIndex);
	router.map(routes.api.v1.monitorContentChecksCreate, monitorContentChecksCreate);
	router.map(routes.api.v1.monitorContentCheckDestroy, monitorContentCheckDestroy);

	router.map(routes.api.v1.dnsMonitorsIndex, dnsMonitorsIndex);
	router.map(routes.api.v1.dnsMonitorsCreate, dnsMonitorsCreate);
	router.map(routes.api.v1.dnsMonitorShow, apiDnsMonitorShow);
	router.map(routes.api.v1.dnsMonitorUpdate, dnsMonitorUpdate);
	router.map(routes.api.v1.dnsMonitorDestroy, dnsMonitorDestroy);
	router.map(routes.api.v1.dnsMonitorResults, dnsMonitorResults);

	router.map(routes.api.v1.tcpMonitorsIndex, tcpMonitorsIndex);
	router.map(routes.api.v1.tcpMonitorsCreate, tcpMonitorsCreate);
	router.map(routes.api.v1.tcpMonitorShow, apiTcpMonitorShow);
	router.map(routes.api.v1.tcpMonitorUpdate, tcpMonitorUpdate);
	router.map(routes.api.v1.tcpMonitorDestroy, tcpMonitorDestroy);
	router.map(routes.api.v1.tcpMonitorResults, tcpMonitorResults);

	router.map(routes.api.v1.cronJobsIndex, cronJobsIndex);
	router.map(routes.api.v1.cronJobsCreate, cronJobsCreate);
	router.map(routes.api.v1.cronJobShow, apiCronJobShow);
	router.map(routes.api.v1.cronJobUpdate, cronJobUpdate);
	router.map(routes.api.v1.cronJobDestroy, cronJobDestroy);

	router.map(routes.api.v1.alertsIndex, alertsIndex);
	router.map(routes.api.v1.alertsCreate, alertsCreate);
	router.map(routes.api.v1.alertShow, alertShow);
	router.map(routes.api.v1.alertUpdate, alertUpdate);
	router.map(routes.api.v1.alertDestroy, alertDestroy);
	router.map(routes.api.v1.alertEvents, alertEvents);

	router.map(routes.api.v1.maintenanceIndex, maintenanceIndex);
	router.map(routes.api.v1.maintenanceCreate, maintenanceCreate);
	router.map(routes.api.v1.maintenanceShow, maintenanceShow);
	router.map(routes.api.v1.maintenanceUpdate, maintenanceUpdate);
	router.map(routes.api.v1.maintenanceDestroy, maintenanceDestroy);
	router.map(routes.api.v1.maintenanceEnd, maintenanceEnd);

	router.map(routes.api.v1.statusPagesIndex, statusPagesIndex);
	router.map(routes.api.v1.statusPagesCreate, statusPagesCreate);
	router.map(routes.api.v1.statusPageShow, statusPageShow);
	router.map(routes.api.v1.statusPageUpdate, statusPageUpdate);
	router.map(routes.api.v1.statusPageDestroy, statusPageDestroy);
	router.map(routes.api.v1.statusPageMonitors, statusPageMonitors);

	router.map(routes.api.v1.invitesIndex, invitesIndex);
	router.map(routes.api.v1.invitesCreate, invitesCreate);
	router.map(routes.api.v1.inviteDestroy, inviteDestroy);

	router.map(routes.api.v1.memberships, membershipsIndex);

	router.map(routes.api.v1.teamShow, teamShow);
	router.map(routes.api.v1.teamUpdate, teamUpdate);

	router.map(routes.api.v1.teamDomainsIndex, teamDomainsIndex);
	router.map(routes.api.v1.teamDomainsCreate, teamDomainsCreate);
	router.map(routes.api.v1.teamDomainsDestroy, teamDomainsDestroy);

	router.map(routes.api.v1.apiKeysIndex, apiKeysIndex);
	router.map(routes.api.v1.apiKeysCreate, apiKeysCreate);
	router.map(routes.api.v1.apiKeyDestroy, apiKeyDestroy);

	return router;
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
