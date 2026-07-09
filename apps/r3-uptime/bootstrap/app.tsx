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

import type { Middleware, RequestContext, RequestHandler, Router } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";
import type { ResolveFrameContext } from "remix/ui/server";

import { asyncContext } from "remix/async-context-middleware";
import { cop } from "remix/cop-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { renderWith } from "remix/render-middleware";
import { renderToStream } from "remix/ui/server";

import { createAlert, deleteAlert, updateAlert } from "~/app/http/controllers/actions/alerts";
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
	checkTcpMonitor,
	createTcpMonitor,
	deleteTcpMonitor,
	updateTcpMonitor,
} from "~/app/http/controllers/actions/tcp-monitors";
import cronJobPing from "~/app/http/controllers/api/cron-job-ping";
import appIndex from "~/app/http/controllers/app/index";
import alertEdit from "~/app/http/controllers/app/team/alert-edit";
import alertHistory from "~/app/http/controllers/app/team/alert-history";
import alertNew from "~/app/http/controllers/app/team/alert-new";
import alerts from "~/app/http/controllers/app/team/alerts";
import cronJobEdit from "~/app/http/controllers/app/team/cron-job-edit";
import cronJobNew from "~/app/http/controllers/app/team/cron-job-new";
import cronJobShow from "~/app/http/controllers/app/team/cron-job-show";
import cronJobs from "~/app/http/controllers/app/team/cron-jobs";
import teamDashboard from "~/app/http/controllers/app/team/dashboard";
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
import tcpMonitorEdit from "~/app/http/controllers/app/team/tcp-monitor-edit";
import tcpMonitorNew from "~/app/http/controllers/app/team/tcp-monitor-new";
import tcpMonitorShow from "~/app/http/controllers/app/team/tcp-monitor-show";
import tcpMonitors from "~/app/http/controllers/app/team/tcp-monitors";
import authController from "~/app/http/controllers/auth";
import defaultHandler from "~/app/http/controllers/default-handler";
import healthcheck from "~/app/http/controllers/healthcheck";
import healthcheckAnalyticsEngine from "~/app/http/controllers/healthcheck-analytics-engine";
import home from "~/app/http/controllers/home";
import logoutController from "~/app/http/controllers/logout";
import auth from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import logger from "~/app/http/middleware/logger";
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
		cop(),
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

	// `createAction`'s handler type fixes its middleware-entries tuple at `[]`, but a
	// `router.map` middleware array of plain (untransformed) `Middleware` values types
	// its merged context with an opaque `any[]` entries tuple — the two never unify, so
	// the handler is cast to accept any context here. `ctx.team`/`ctx.membership` are
	// still correctly typed inside each handler via the global `declare module`
	// augmentations in `require-team.ts`, independent of this cast.
	router.map(routes.app.index, {
		middleware: [requireUser],
		handler: appIndex as RequestHandler<any>,
	});
	router.map(routes.app.team.index, {
		middleware: [requireUser, requireTeam],
		handler: teamIndex as RequestHandler<any>,
	});
	router.map(routes.app.team.dashboard, {
		middleware: [requireUser, requireTeam],
		handler: teamDashboard as RequestHandler<any>,
	});
	router.map(routes.app.team.httpMonitors, {
		middleware: [requireUser, requireTeam],
		handler: httpMonitors as RequestHandler<any>,
	});
	router.map(routes.app.team.monitorNew, {
		middleware: [requireUser, requireTeam],
		handler: monitorNew as RequestHandler<any>,
	});
	router.map(routes.app.team.monitorShow, {
		middleware: [requireUser, requireTeam],
		handler: monitorShow as RequestHandler<any>,
	});
	router.map(routes.app.team.monitorEdit, {
		middleware: [requireUser, requireTeam],
		handler: monitorEdit as RequestHandler<any>,
	});
	router.map(routes.app.team.dnsMonitors, {
		middleware: [requireUser, requireTeam],
		handler: dnsMonitors as RequestHandler<any>,
	});
	router.map(routes.app.team.dnsMonitorNew, {
		middleware: [requireUser, requireTeam],
		handler: dnsMonitorNew as RequestHandler<any>,
	});
	router.map(routes.app.team.dnsMonitorShow, {
		middleware: [requireUser, requireTeam],
		handler: dnsMonitorShow as RequestHandler<any>,
	});
	router.map(routes.app.team.dnsMonitorEdit, {
		middleware: [requireUser, requireTeam],
		handler: dnsMonitorEdit as RequestHandler<any>,
	});
	router.map(routes.app.team.tcpMonitors, {
		middleware: [requireUser, requireTeam],
		handler: tcpMonitors as RequestHandler<any>,
	});
	router.map(routes.app.team.tcpMonitorNew, {
		middleware: [requireUser, requireTeam],
		handler: tcpMonitorNew as RequestHandler<any>,
	});
	router.map(routes.app.team.tcpMonitorShow, {
		middleware: [requireUser, requireTeam],
		handler: tcpMonitorShow as RequestHandler<any>,
	});
	router.map(routes.app.team.tcpMonitorEdit, {
		middleware: [requireUser, requireTeam],
		handler: tcpMonitorEdit as RequestHandler<any>,
	});
	router.map(routes.app.team.cronJobs, {
		middleware: [requireUser, requireTeam],
		handler: cronJobs as RequestHandler<any>,
	});
	router.map(routes.app.team.cronJobNew, {
		middleware: [requireUser, requireTeam],
		handler: cronJobNew as RequestHandler<any>,
	});
	router.map(routes.app.team.cronJobShow, {
		middleware: [requireUser, requireTeam],
		handler: cronJobShow as RequestHandler<any>,
	});
	router.map(routes.app.team.cronJobEdit, {
		middleware: [requireUser, requireTeam],
		handler: cronJobEdit as RequestHandler<any>,
	});
	router.map(routes.app.team.alerts, {
		middleware: [requireUser, requireTeam],
		handler: alerts as RequestHandler<any>,
	});
	router.map(routes.app.team.alertNew, {
		middleware: [requireUser, requireTeam],
		handler: alertNew as RequestHandler<any>,
	});
	router.map(routes.app.team.alertEdit, {
		middleware: [requireUser, requireTeam],
		handler: alertEdit as RequestHandler<any>,
	});
	router.map(routes.app.team.alertHistory, {
		middleware: [requireUser, requireTeam],
		handler: alertHistory as RequestHandler<any>,
	});
	router.map(routes.app.team.maintenanceWindows, {
		middleware: [requireUser, requireTeam],
		handler: maintenanceWindows as RequestHandler<any>,
	});
	router.map(routes.app.team.maintenanceWindowNew, {
		middleware: [requireUser, requireTeam],
		handler: maintenanceWindowNew as RequestHandler<any>,
	});
	router.map(routes.app.team.maintenanceWindowEdit, {
		middleware: [requireUser, requireTeam],
		handler: maintenanceWindowEdit as RequestHandler<any>,
	});

	router.map(routes.actions, {
		middleware: [requireUser, requireTeam],
		actions: {
			createMonitor: createMonitor as RequestHandler<any>,
			updateMonitor: updateMonitor as RequestHandler<any>,
			deleteMonitor: deleteMonitor as RequestHandler<any>,
			playMonitor: playMonitor as RequestHandler<any>,
			updateSsl: updateSsl as RequestHandler<any>,
			createContentCheck: createContentCheck as RequestHandler<any>,
			deleteContentCheck: deleteContentCheck as RequestHandler<any>,
			setDashboardTab: setDashboardTab as RequestHandler<any>,
			createDnsMonitor: createDnsMonitor as RequestHandler<any>,
			updateDnsMonitor: updateDnsMonitor as RequestHandler<any>,
			deleteDnsMonitor: deleteDnsMonitor as RequestHandler<any>,
			checkDnsMonitor: checkDnsMonitor as RequestHandler<any>,
			createTcpMonitor: createTcpMonitor as RequestHandler<any>,
			updateTcpMonitor: updateTcpMonitor as RequestHandler<any>,
			deleteTcpMonitor: deleteTcpMonitor as RequestHandler<any>,
			checkTcpMonitor: checkTcpMonitor as RequestHandler<any>,
			createCronJob: createCronJob as RequestHandler<any>,
			updateCronJob: updateCronJob as RequestHandler<any>,
			deleteCronJob: deleteCronJob as RequestHandler<any>,
			createAlert: createAlert as RequestHandler<any>,
			updateAlert: updateAlert as RequestHandler<any>,
			deleteAlert: deleteAlert as RequestHandler<any>,
			createMaintenanceWindow: createMaintenanceWindow as RequestHandler<any>,
			updateMaintenanceWindow: updateMaintenanceWindow as RequestHandler<any>,
			deleteMaintenanceWindow: deleteMaintenanceWindow as RequestHandler<any>,
			endMaintenanceWindow: endMaintenanceWindow as RequestHandler<any>,
		},
	});

	// Public, unauthenticated: the cron-job ping endpoint (see its controller's
	// docblock for why it doesn't sit behind `requireUser`/`requireTeam`).
	router.map(routes.api.cronJobPing, cronJobPing);

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
