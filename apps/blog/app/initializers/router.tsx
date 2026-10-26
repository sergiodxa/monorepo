/**
 * The blog's fetch-router: the global middleware chain, and the public, RSS, auth,
 * admin-guarded CMS and MCP routes mapped onto their controllers, with the renderer
 * controllers reach through `ctx.render` installed last.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";
import type { SpamFilter } from "@sdxc/spam";
import type { Middleware, RequestContext, RouterContext } from "remix/router";

import { assets } from "@sdxc/assets-middleware";
import { models } from "@sdxc/data-model/router";
import { database } from "@sdxc/database-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { redirect } from "@sdxc/http/response";
import { jobEnqueuer } from "@sdxc/jobs/router";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { previews } from "@sdxc/mail/previews";
import { noWWW } from "@sdxc/no-www-middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { NODEINFO_2_1, nodeInfoLinks } from "@sdxc/well-known/nodeinfo";
import workersCache from "@sdxc/workers-cache/middleware";
import { cache as platformCache } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import access from "~/app/http/middleware/access";
import activityPub from "~/app/http/middleware/activitypub";
import activityPubRateLimit from "~/app/http/middleware/activitypub-rate-limit";
import auth from "~/app/http/middleware/auth";
import { isAuthenticated } from "~/app/http/middleware/auth";
import createEnvMiddleware from "~/app/http/middleware/env";
import githubWebhook from "~/app/http/middleware/github-webhook";
import importMapHash from "~/app/http/middleware/import-map-hash";
import mcpRateLimit from "~/app/http/middleware/mcp-rate-limit";
import pingHubFor from "~/app/http/middleware/ping-hub";
import purgePostList from "~/app/http/middleware/purge-post-list";
import redirects from "~/app/http/middleware/redirects";
import requireAdmin from "~/app/http/middleware/require-admin";
import session from "~/app/http/middleware/session";
import socialCards from "~/app/http/middleware/social-cards";
import supportDesk from "~/app/http/middleware/support-desk";
import { viewRenderer } from "~/app/http/middleware/view-renderer";
import webmentionRateLimit from "~/app/http/middleware/webmention-rate-limit";
import { loginFor } from "~/app/http/return-path";
import { assetResolver } from "~/app/initializers/assets";
import { createDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { jobQueue } from "~/app/initializers/queue";
import registry from "~/app/models";
import { PROFILE } from "~/config/profile";
import { SECURITY_POLICY } from "~/config/security-policy";
import { securityTxtEntry } from "~/config/security-txt";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

/** The context a controller sees once the router's global middleware has run. */
export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	/** Types `createAction` and `createController` with the context the router's chain builds. */
	interface RouterTypes {
		context: AppContext;
	}
}

/**
 * Paths where a non-`GET` request signals a machine caller, since a reader's browser sends
 * only `GET` here. Matched exactly against the route table, so a path *beneath* one of
 * these still falls through to the full chain and the normal 404 page.
 */
const MACHINE_PATHS = new Set<string>([
	routes.mcp.index.href(),
	routes.webmention.href(),
	routes.activityPub.inbox.href(),
	routes.sponsorsWebhook.href(),
	routes.cspReports.href(),
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
 * @template M The wrapped middleware, whose published context the router keeps deriving.
 * @param middleware Middleware that only applies to pages.
 * @returns Middleware that passes machine requests straight through.
 */
function htmlOnly<M extends Middleware<any>>(middleware: M): M {
	let scoped: Middleware = (ctx, next) => {
		if (isMachineRequest(ctx)) return next();
		return middleware(ctx, next);
	};
	return scoped as M;
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
 * A feed's routes in every format it is served in, which the WebSub hub is pinged with
 * together because one stored write changes all of them: `"feed"` for the whole site, or a
 * kind's topic slug for that topic's feeds.
 */
function feedsOf(stream: "feed" | (string & {})): Array<{ href(): string }> {
	if (stream === "feed") return [routes.rss.feed, routes.atom.feed, routes.jsonFeed.feed];
	return [routes.rss.topic, routes.atom.topic, routes.jsonFeed.topic].map((feed) => ({
		href: () => feed.href({ topic: stream }),
	}));
}

/**
 * Maps a kind's topic page onto the shared topic controller, which renders the topic the
 * registry names by `slug`; the controller loads on the page's first request.
 *
 * @param slug The kind's `topic` in the registry, which is also the page's path.
 */
function kindTopic(slug: string) {
	return lazy(() => import("~/app/http/controllers/topic").then((it) => it.kindTopic(slug)));
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
				import("~/app/initializers/activitypub-keys"),
				import("@sdxc/cache/worker-kv"),
			]);
		return createFederation({
			db: ctx.db,
			models: ctx.models,
			cache: new WorkerKVCache(env.CACHE),
			keys: BLOG_KEYS,
			queue: federationQueue(ctx.jobs),
		});
	});
}

/** Services {@link createWebRouter} otherwise builds from the Worker's bindings. */
export interface ApplicationOptions {
	/** Delivers Encore support requests in place of the `EMAIL` binding. */
	mailTransport?: Transport;
	/** Scores Encore support requests in place of the free default checks. */
	spamFilter?: SpamFilter;
}

/**
 * Builds the blog HTTP router with global middleware, route mappings, CMS auth guards, and
 * the HTML 404 fallback.
 *
 * @param env Worker environment bindings injected into request context.
 * @param options Services a test substitutes for the ones the bindings provide.
 * @returns Configured router instance for the worker fetch entrypoint.
 */
export function createWebRouter(env: App.Env, options: ApplicationOptions = {}) {
	let router = createRouter({
		middleware: [
			headRequests(),
			log(logger),
			getClientIP(),
			trace(),
			createEnvMiddleware(env),
			noWWW(),
			trailingSlash(),
			wellKnown({
				"security.txt": securityTxtEntry,
				nodeinfo: serve(nodeInfoLinks, () => NODEINFO_LINKS),
			}),
			asyncContext(),
			socialCards((request): Promise<Response> => router.fetch(request)),
			database(createDatabase()),
			models(registry, (ctx) => ({ db: ctx.db })),
			previews(mail, {
				enabled: import.meta.env.DEV,
				stylesheets: () => assetResolver.getStylesheets("resources/layouts/document.tsx"),
			}),
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
			htmlOnly(access),
			securityHeaders(SECURITY_POLICY),
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
			}),
			htmlOnly(importMapHash()),
			render({ assets: assetResolver }),
			viewRenderer(),
		],

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
		routes.sponsorsWebhook,
		lazy(
			() => import("~/app/http/controllers/sponsors-webhook"),
			[githubWebhook(env.GITHUB_SPONSORS_WEBHOOK_SECRET)],
		),
	);
	router.map(
		routes.sitemap,
		lazy(() => import("~/app/http/controllers/sitemap")),
	);
	router.map(
		routes.health,
		lazy(() => import("~/app/http/controllers/health")),
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
	let contactGuards = [
		honeypot(new Honeypot({ secret: `honeypot:${env.COOKIE_SESSION_SECRET}` }), {
			onFailure: () => null,
		}),
		supportDesk(env, options.mailTransport, options.spamFilter),
	];
	router.map(
		routes.encoreSupport,
		lazy(() => import("~/app/http/controllers/encore-support"), contactGuards),
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
		routes.press,
		lazy(() => import("~/app/http/controllers/press"), contactGuards),
	);
	router.map(
		routes.pressMarkdown,
		lazy(() => import("~/app/http/controllers/press").then((it) => it.markdownPage)),
	);
	router.map(
		routes.uses,
		lazy(() => import("~/app/http/controllers/uses")),
	);
	router.map(
		routes.usesMarkdown,
		lazy(() => import("~/app/http/controllers/uses").then((it) => it.markdownPage)),
	);
	router.map(routes.articles, kindTopic("articles"));
	router.map(routes.tutorials, kindTopic("tutorials"));
	router.map(routes.bookmarks, kindTopic("bookmarks"));
	router.map(routes.glossary, kindTopic("glossary"));
	router.map(routes.releases, kindTopic("releases"));
	router.map(routes.notes, kindTopic("notes"));
	router.map(routes.til, kindTopic("til"));
	router.map(
		routes.topics,
		lazy(() => import("~/app/http/controllers/topics")),
	);
	router.map(
		routes.topic,
		lazy(() => import("~/app/http/controllers/topic")),
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
				 * middleware that publishes context and so has to stay an action object, whose
				 * `handler` must be a function.
				 */
				handler: async (ctx) => (await import("~/app/initializers/mcp")).default.fetch(ctx),
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
		routes.cms.notes,
		lazy(
			() => import("~/app/http/controllers/cms/notes"),
			[...CMS_WRITE_GUARDS, pingHubFor(...feedsOf("feed"))],
		),
	);
	router.map(
		routes.cms.tils,
		lazy(
			() => import("~/app/http/controllers/cms/tils"),
			[...CMS_WRITE_GUARDS, pingHubFor(...feedsOf("feed"))],
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
			[...CMS_WRITE_GUARDS, pingHubFor(...feedsOf("feed"), ...feedsOf("glossary"))],
		),
	);
	router.map(
		routes.cms.releases,
		lazy(
			() => import("~/app/http/controllers/cms/releases"),
			[...CMS_WRITE_GUARDS, pingHubFor(...feedsOf("feed"), ...feedsOf("releases"))],
		),
	);
	router.map(
		routes.cms.topics,
		lazy(() => import("~/app/http/controllers/cms/topics"), CMS_WRITE_GUARDS),
	);
	router.map(
		routes.cms.redirects,
		lazy(() => import("~/app/http/controllers/cms/redirects"), CMS_GUARDS),
	);
	router.map(
		routes.cms.webmentions,
		lazy(() => import("~/app/http/controllers/cms/webmentions"), CMS_GUARDS),
	);
	router.map(
		routes.cspReports,
		lazy(() => import("~/app/http/controllers/csp-reports")),
	);
	router.map(
		routes.robots,
		lazy(() => import("~/app/http/controllers/robots")),
	);

	return router;
}
