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

import {
	createContentCheck,
	deleteContentCheck,
} from "~/app/http/controllers/actions/content-checks";
import { setDashboardTab } from "~/app/http/controllers/actions/dashboard";
import {
	createMonitor,
	deleteMonitor,
	playMonitor,
	updateMonitor,
} from "~/app/http/controllers/actions/monitors";
import { updateSsl } from "~/app/http/controllers/actions/ssl";
import appIndex from "~/app/http/controllers/app/index";
import teamDashboard from "~/app/http/controllers/app/team/dashboard";
import httpMonitors from "~/app/http/controllers/app/team/http-monitors";
import teamIndex from "~/app/http/controllers/app/team/index";
import monitorEdit from "~/app/http/controllers/app/team/monitor-edit";
import monitorNew from "~/app/http/controllers/app/team/monitor-new";
import monitorShow from "~/app/http/controllers/app/team/monitor-show";
import authController from "~/app/http/controllers/auth";
import defaultHandler from "~/app/http/controllers/default-handler";
import healthcheck from "~/app/http/controllers/healthcheck";
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
		},
	});

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
