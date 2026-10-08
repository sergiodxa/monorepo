/**
 * Assembles the blog HTTP application. Wires global middleware, maps public,
 * RSS, auth, admin-guarded CMS, and MCP routes onto the fetch router, and provides
 * the streaming HTML renderer and SSR frame resolver used by controllers.
 *
 * Every route is mapped through `lazy()`, so the URL surface is complete at startup
 * while each controller is imported by the first request that reaches it. A cold
 * isolate evaluates what it serves instead of the whole route table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";
import type { SpamFilter } from "@sdxc/spam";
import type { ResolveFrameContext } from "remix/component/server";
import type { Middleware, RequestContext } from "remix/router";

import getClientIP from "@sdxc/get-client-ip/middleware";
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { redirect } from "@sdxc/http/response";
import { jobEnqueuer } from "@sdxc/jobs/router";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { noWWW } from "@sdxc/no-www-middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { NODEINFO_2_1, nodeInfoLinks } from "@sdxc/well-known/nodeinfo";
import { securityTxt } from "@sdxc/well-known/security-txt";
import workersCache from "@sdxc/workers-cache/middleware";
import { cache as platformCache } from "cloudflare:workers";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";

import type { AppContext, BlogRenderer, RenderOptions } from "~/app/http/context";
import type { Syndication } from "~/app/http/view-models/syndication";

import activityPub from "~/app/http/middleware/activitypub";
import activityPubRateLimit from "~/app/http/middleware/activitypub-rate-limit";
import auth from "~/app/http/middleware/auth";
import { isAuthenticated } from "~/app/http/middleware/auth";
import database from "~/app/http/middleware/database";
import createEnvMiddleware from "~/app/http/middleware/env";
import pingHubFor from "~/app/http/middleware/ping-hub";
import purgePostList from "~/app/http/middleware/purge-post-list";
import redirects from "~/app/http/middleware/redirects";
import requireAdmin from "~/app/http/middleware/require-admin";
import session from "~/app/http/middleware/session";
import supportDesk from "~/app/http/middleware/support-desk";
import webmentionRateLimit from "~/app/http/middleware/webmention-rate-limit";
import { loginFor } from "~/app/http/return-path";
import { SECURITY_POLICY } from "~/app/http/security-policy";
import { jobQueue } from "~/app/jobs/queue";
import mcpRateLimit from "~/app/mcp/rate-limit";
import { documentAssets } from "~/app/services/assets";
import { createDatabase } from "~/app/services/database";
import { PROFILE } from "~/config/profile";
import { SECURITY_TXT } from "~/config/security-txt";
import { DocumentAssets } from "~/resources/layouts/document";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

import { logger } from "./logger";

/**
 * Paths where a non-`GET` request signals a machine caller, since a reader's browser sends
 * only `GET` here. Matched exactly against the route table, so a path *beneath* one of
 * these still falls through to the full chain and the normal 404 page.
 */
const MACHINE_PATHS = new Set<string>([
	routes.mcp.index.href(),
	routes.webmention.href(),
	routes.activityPub.inbox.href(),
]);

/**
 * The `/.well-known/nodeinfo` links document: one link, to the NodeInfo 2.1 document on the
 * canonical origin, which is the same for every request.
 */
const NODEINFO_LINKS = {
	links: [
		{ rel: NODEINFO_2_1, href: new URL(routes.nodeInfo.href(), PROFILE.canonical.origin).href },
	],
};

/**
 * Whether a request is the machine half of a machine path. Method-aware because `/mcp`
 * answers both: a `POST` is an agent speaking the protocol, while a `GET` is a person who
 * pasted the URL into a browser and needs the full reader page.
 */
function isMachineRequest(ctx: RequestContext): boolean {
	return ctx.method !== "GET" && MACHINE_PATHS.has(ctx.url.pathname);
}

/**
 * Scopes a middleware to the HTML surface. The session, redirect lookup and auth resolver
 * exist for a person's page view and would spend a KV read against a cookieless MCP
 * request; the renderer stays exempt, since a closure costs the same regardless.
 *
 * @param middleware Middleware that only applies to pages.
 * @returns Middleware that passes machine requests straight through.
 */
function htmlOnly(middleware: Middleware<any>): Middleware<any> {
	return (ctx, next) => {
		if (isMachineRequest(ctx)) return next();
		return middleware(ctx, next);
	};
}

/**
 * Redirects anonymous CMS requests to login, carrying the page's path and query as `next`,
 * so a link opened with an expired session lands on that page once signed in.
 */
let requireCMSAuth: Middleware = (ctx, next) => {
	if (isAuthenticated()) return next();
	return redirect(loginFor(ctx), { status: redirect.Status.SeeOther });
};

/**
 * The chain every CMS route runs behind. Declared here rather than inside each controller
 * so the group's guard is one decision: a new CMS route that forgets it is visible at the
 * map call, and it answers before the controller it protects is ever loaded.
 */
const CMS_GUARDS: Middleware[] = [requireCMSAuth, requireAdmin];

/** The same, for the routes that write, which invalidate the shared listing afterwards. */
const CMS_WRITE_GUARDS: Middleware[] = [...CMS_GUARDS, purgePostList];

/**
 * A feed stream's routes in every format it is served in, which the WebSub hub is pinged
 * with together because one stored write changes all of them.
 */
function feedsOf(stream: Syndication.Stream) {
	return [routes.rss[stream], routes.atom[stream], routes.jsonFeed[stream]];
}

/**
 * Publishes `ctx.activityPub` over the request's database, its job enqueuer and the `CACHE`
 * namespace. The federation is imported on the first request that reaches a federating
 * route, which keeps the resolver and signing code off every other cold start.
 *
 * @param env Environment bindings, read for the `CACHE` namespace.
 */
function activityPubService(env: App.Env): Middleware {
	return activityPub(async (ctx) => {
		let [{ createFederation, federationQueue }, { BLOG_KEYS }, { WorkerKVCache }] =
			await Promise.all([
				import("~/app/services/activitypub"),
				import("~/app/services/activitypub-keys"),
				import("@sdxc/cache/worker-kv"),
			]);
		return createFederation({
			db: ctx.db,
			cache: new WorkerKVCache(env.CACHE),
			keys: BLOG_KEYS,
			queue: federationQueue(ctx.jobs),
		});
	});
}

/** Services {@link createApplication} otherwise builds from the Worker's bindings. */
export interface ApplicationOptions {
	/** Delivers Encore support requests in place of the `EMAIL` binding. */
	mailTransport?: Transport;
	/** Scores Encore support requests in place of the free default checks. */
	spamFilter?: SpamFilter;
}

/**
 * Builds the blog HTTP router with global middleware, route mappings, CMS auth
 * guards, and the HTML 404 fallback. `headRequests()` runs first so every later
 * middleware sees a plain `GET` and treats a `HEAD` probe as the page request;
 * `log(logger)` follows it and opens the request's wide event around everything else,
 * and `trace()` then continues the caller's W3C trace (or starts one) and sets its IDs on it.
 * `wellKnown()` answers the registered documents it lists before any session or cache
 * work, since they are static and the same for every visitor.
 * `securityHeaders` sits just before the renderer, so it decorates the rendered response
 * that `workersCache` then stores and replays.
 * `workersCache` sits outside session and auth so its refusal check reads the finished
 * response, downgrading a public declaration once the visitor turns out to be identified.
 * `database(createDatabase)` is global, so `ctx.db` is there for a route the app maps and
 * for a handler behind a route-agnostic boundary alike; `jobEnqueuer` publishes `ctx.jobs`
 * after it, so every message a handler enqueues carries the request's trace.
 * @param env Worker environment bindings injected into request context.
 * @param options Services a test substitutes for the ones the bindings provide.
 * @returns Configured router instance for the worker fetch entrypoint.
 */
export default function createApplication(env: App.Env, options: ApplicationOptions = {}) {
	let globalMiddleware: Array<Middleware<any>> = [
		headRequests(),
		log(logger),
		getClientIP(),
		trace(),
		createEnvMiddleware(env),
		noWWW(),
		trailingSlash(),
		wellKnown({
			"security.txt": serve(securityTxt, () => SECURITY_TXT),
			nodeinfo: serve(nodeInfoLinks, () => NODEINFO_LINKS),
		}),
		asyncContext(),
		database(createDatabase),
		jobEnqueuer(jobQueue),
		workersCache({ cache: () => platformCache }),
		/**
		 * Refuses an unsafe request a browser sent from another origin before any session is
		 * read, so a page elsewhere can never write to the CMS with an editor's cookie. The
		 * machine paths take cross-origin callers by design and read no cookie.
		 */
		cop({ insecureBypassPatterns: [...MACHINE_PATHS] }),
		htmlOnly(session),
		formData(),
		methodOverride(),
		htmlOnly(redirects),
		htmlOnly(auth),
		securityHeaders(SECURITY_POLICY),
		renderWith(createHtmlRenderer),
	];
	let router = createRouter<AppContext>({
		middleware: globalMiddleware,

		async defaultHandler(ctx) {
			return ctx.render(
				NotFoundView,
				{
					title: "Page Not Found",
					description: "The page you are looking for does not exist.",
					emoji: "❓",
				},
				{ status: 404 },
			);
		},
	});

	let federating = activityPubService(env);

	/** The home page negotiates to the actor document, which `ctx.activityPub` builds. */
	router.map(
		routes.feed,
		lazy(() => import("~/app/http/controllers/feed"), [federating]),
	);
	router.map(
		routes.colors,
		lazy(() => import("~/app/http/controllers/colors")),
	);
	router.map(
		routes.sponsor,
		lazy(() => import("~/app/http/controllers/sponsor")),
	);
	router.map(
		routes.sponsors,
		lazy(() => import("~/app/http/controllers/sponsors")),
	);
	router.map(
		routes.sitemap,
		lazy(() => import("~/app/http/controllers/sitemap")),
	);
	router.map(
		routes.healthcheck,
		lazy(() => import("~/app/http/controllers/healthcheck")),
	);

	/**
	 * Other sites notify the blog here. Anonymous by definition, so it answers behind
	 * per-address and per-source-host budgets before the controller is loaded.
	 */
	router.map(
		routes.webmention,
		lazy(() => import("~/app/http/controllers/webmention"), webmentionRateLimit(env)),
	);
	/**
	 * Any server delivers activities here, so the inbox answers behind a per-network budget
	 * before the service or the controller is loaded.
	 */
	router.map(
		routes.activityPub.inbox,
		lazy(
			() => import("~/app/http/controllers/activitypub-inbox"),
			[...activityPubRateLimit(env), federating],
		),
	);
	router.map(
		routes.activityPub.documents,
		lazy(() => import("~/app/http/controllers/activitypub"), [federating]),
	);
	router.map(
		routes.nodeInfo,
		lazy(() => import("~/app/http/controllers/nodeinfo")),
	);

	/**
	 * Anonymous submissions, behind honeypot fields and the rate-limited support desk. The
	 * honeypot keys off the session secret under a `honeypot:` label, so it needs no secret of
	 * its own; a refused submission reaches the controller, which answers a trap like a success.
	 */
	router.map(
		routes.encoreSupport,
		lazy(
			() => import("~/app/http/controllers/encore-support"),
			[
				honeypot(new Honeypot({ secret: `honeypot:${env.COOKIE_SESSION_SECRET}` }), {
					onFailure: () => null,
				}),
				supportDesk(env, options.mailTransport, options.spamFilter),
			],
		),
	);
	router.map(
		routes.encorePrivacy,
		lazy(() => import("~/app/http/controllers/encore-privacy")),
	);
	router.map(
		routes.encorePrivacyMarkdown,
		lazy(() => import("~/app/http/controllers/encore-privacy").then((it) => it.markdownPage)),
	);
	router.map(
		routes.articles,
		lazy(() => import("~/app/http/controllers/articles")),
	);
	router.map(
		routes.tutorials,
		lazy(() => import("~/app/http/controllers/tutorials")),
	);
	router.map(
		routes.bookmarks,
		lazy(() => import("~/app/http/controllers/bookmarks")),
	);
	router.map(
		routes.glossary,
		lazy(() => import("~/app/http/controllers/glossary")),
	);
	router.map(
		routes.search,
		lazy(() => import("~/app/http/controllers/search")),
	);
	router.map(
		routes.searchFrame,
		lazy(() => import("~/app/http/controllers/search-frame")),
	);
	/** A post page negotiates to its `Article`, which `ctx.activityPub` answers. */
	router.map(
		routes.post,
		lazy(() => import("~/app/http/controllers/post"), [federating]),
	);
	router.map(
		routes.postRelated,
		lazy(() => import("~/app/http/controllers/post-related")),
	);

	/**
	 * The MCP endpoint sits outside every auth guard, keeping the blog freely readable by
	 * any agent, and reads `ctx.db` because an MCP tool's handler receives only a context
	 * to work with.
	 */
	router.map(
		routes.mcpMarkdown,
		lazy(() => import("~/app/http/controllers/mcp").then((it) => it.mcpMarkdownPage)),
	);
	router.map(routes.mcp, {
		actions: {
			index: lazy(() => import("~/app/http/controllers/mcp")),
			action: {
				middleware: [mcpRateLimit(env)],
				/**
				 * Imported here rather than through `lazy()`, because this action declares
				 * middleware that publishes context and so has to stay an action object,
				 * whose `handler` must be a function. The server is built at module scope,
				 * so deferring the import is what keeps it off a cold start.
				 */
				handler: async (ctx) => (await import("./mcp")).default.fetch(ctx),
			},
		},
	});

	router.map(
		routes.wellKnown,
		lazy(() => import("~/app/http/controllers/well-known")),
	);
	router.map(
		routes.rss,
		lazy(() => import("~/app/http/controllers/feeds/rss")),
	);
	router.map(
		routes.atom,
		lazy(() => import("~/app/http/controllers/feeds/atom")),
	);
	router.map(
		routes.jsonFeed,
		lazy(() => import("~/app/http/controllers/feeds/json-feed")),
	);
	router.map(
		routes.auth.login,
		lazy(() => import("~/app/http/controllers/auth").then((it) => it.loginController)),
	);
	router.map(
		routes.auth.logout,
		lazy(() => import("~/app/http/controllers/auth").then((it) => it.logoutController)),
	);
	router.map(
		routes.auth.callback,
		lazy(() => import("~/app/http/controllers/auth").then((it) => it.callbackAction)),
	);
	router.map(
		routes.cms.dashboard,
		lazy(() => import("~/app/http/controllers/cms/dashboard"), CMS_GUARDS),
	);
	router.map(
		routes.cms.purgeCache,
		lazy(() => import("~/app/http/controllers/cms/purge-cache"), CMS_GUARDS),
	);
	router.map(
		routes.cms.articles,
		lazy(
			() => import("~/app/http/controllers/cms/articles"),
			[...CMS_WRITE_GUARDS, pingHubFor(...feedsOf("feed"), ...feedsOf("articles"))],
		),
	);
	router.map(
		routes.cms.tutorials,
		lazy(
			() => import("~/app/http/controllers/cms/tutorials"),
			[...CMS_WRITE_GUARDS, pingHubFor(...feedsOf("feed"), ...feedsOf("tutorials"))],
		),
	);
	router.map(
		routes.cms.bookmarks,
		lazy(
			() => import("~/app/http/controllers/cms/bookmarks"),
			[...CMS_WRITE_GUARDS, pingHubFor(...feedsOf("feed"), ...feedsOf("bookmarks"))],
		),
	);
	router.map(
		routes.cms.glossary,
		lazy(
			() => import("~/app/http/controllers/cms/glossary"),
			[...CMS_WRITE_GUARDS, pingHubFor(...feedsOf("feed"))],
		),
	);
	router.map(
		routes.cms.redirects,
		lazy(() => import("~/app/http/controllers/cms/redirects"), CMS_GUARDS),
	);
	router.map(
		routes.cms.webmentions,
		lazy(() => import("~/app/http/controllers/cms/webmentions"), CMS_GUARDS),
	);

	return router;
}

/**
 * Creates the request-scoped renderer used by controllers via `ctx.render`,
 * exported so its guarantees can be asserted directly. `createHtmlResponse`
 * leads the stream with `<!DOCTYPE html>`, keeping every page in standards mode.
 */
export function createHtmlRenderer(ctx: RequestContext): BlogRenderer {
	return async function render(ViewComponent, viewModel, options?: RenderOptions) {
		let renderView = ViewComponent();
		let assets = await documentAssets();
		let page = <DocumentAssets value={assets}>{renderView({ model: viewModel })}</DocumentAssets>;
		let stream = renderToStream(page, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveSsrFrame(ctx, src, target, context);
			},
		});
		let headers = new Headers(options?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return createHtmlResponse(stream, {
			status: options?.status ?? 200,
			headers,
		});
	};
}

/**
 * Renders a page's `<Frame>` by dispatching its source through this same router, with the
 * page request's headers (cookies included) so the frame sees the same visitor. In process,
 * a frame resolves wherever the page renders, at no subrequest; a non-2xx renders nothing.
 */
async function resolveSsrFrame(
	ctx: RequestContext,
	src: string,
	target: string | undefined,
	context?: ResolveFrameContext,
) {
	let frameUrl = new URL(src, context?.currentFrameSrc ?? ctx.request.url);
	let headers = new Headers(ctx.request.headers);
	headers.set("accept", "text/html");
	headers.delete("x-remix-target");
	if (target) headers.set("x-remix-target", target);

	let response = await ctx.router.fetch(
		new Request(frameUrl, { method: "GET", headers, signal: ctx.request.signal }),
	);
	if (response.ok) return response.body ?? (await response.text());
	await response.body?.cancel();
	return "";
}
