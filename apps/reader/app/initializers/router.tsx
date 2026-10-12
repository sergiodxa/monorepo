/**
 * The reader's fetch-router: the global middleware chain (head requests, async context,
 * logging, form data, method override, session, auth, flags, language, cross-origin
 * protection, security headers, document assets, HTML rendering) and every route mapped to
 * its controller. The worker and every router-level test build it through `createWebRouter()`.
 *
 * Every route is mapped through `lazy()`, so the URL surface is complete at startup while
 * each controller is imported by the first request that reaches it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import featureFlags from "@sdxc/flags/middleware/router";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import agentRateLimit from "~/app/http/middleware/agent-rate-limit";
import documentShellAssets from "~/app/http/middleware/assets";
import auth, { getViewer } from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import presentation from "~/app/http/middleware/presentation";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import { assetResolver } from "~/app/initializers/assets";
import { flags } from "~/app/initializers/flags";
import { logger, logRenderFailure } from "~/app/initializers/logger";
import requireAgent from "~/app/mcp/agent";
import { SECURITY_POLICY } from "~/config/security-policy";
import { SECURITY_TXT } from "~/config/security-txt";
import routes from "~/routes/web";

/**
 * The callback a publisher's hub delivers to, in the pattern language `cop()` matches
 * bypasses by. Both methods are named, since the verification arrives as a `GET`.
 */
const WEBSUB_CALLBACK = "/websub/{feedId}/{token}";

/**
 * The agent endpoint, in the pattern language `cop()` matches bypasses by.
 *
 * It states its own provenance instead of a browser's: every call carries a bearer token
 * this deployment signed, and nothing there reads a cookie, so a client that happens to
 * run inside a browser is a caller like any other rather than a request made on a
 * reader's behalf by a page they did not visit.
 */
const AGENT_ENDPOINT = "/mcp";

/** What {@link createWebRouter} reads per request to build the session middleware. */
export interface WebRouterOptions {
	/** KV namespace backing session storage. */
	kv: KVNamespace;
	/** Secret used to sign the session cookie. */
	cookieSecret: string;
	/** Whether the session cookie should be marked `Secure`. */
	secure: boolean;
}

/**
 * Builds the app's fetch-router: global middleware, then every route mapped to its controller.
 *
 * @param options The session's storage, its signing secret and whether its cookie is `Secure`.
 * @returns The router the worker forwards every request to.
 */
export function createWebRouter(options: WebRouterOptions) {
	let router = createRouter({
		middleware: [
			/**
			 * Runs first so the session, the auth resolver, and cross-origin protection all see
			 * a plain `GET` and treat a `HEAD` probe exactly like the request behind it.
			 */
			headRequests(),
			asyncContext(),
			log(logger),
			/**
			 * Right after the log, so every event the request writes carries its trace id, and a
			 * caller that sent a `traceparent` finds this request's events under its own trace.
			 */
			trace(),
			formData(),
			methodOverride(),
			createSessionMiddleware(options.kv, options.cookieSecret, options.secure),
			auth,
			/**
			 * Publishes `ctx.flags` on every surface. It stays after `auth` because the subject
			 * targeting is written against is the signed-in reader, and a rule that names one
			 * reader is the whole reason an evaluation carries a subject at all.
			 */
			featureFlags(flags, { context: () => ({ targetingKey: getViewer()?.id }) }),
			/** Stays after `auth`, whose viewer decides which language preference is in scope. */
			i18n,
			/**
			 * Reads how the document is painted before any controller runs, so the shell writes
			 * the reader's own scheme into the first byte rather than correcting a page that has
			 * already been painted in somebody else's.
			 */
			presentation,
			/**
			 * A publisher's hub is a cross-origin caller by construction, and a notification is
			 * exactly the unsafe cross-origin `POST` the default refusal is written to reject, so
			 * the callback states its own provenance instead: an unguessable token in the path
			 * and an HMAC over the delivery.
			 */
			cop({ insecureBypassPatterns: [WEBSUB_CALLBACK, AGENT_ENDPOINT] }),
			/**
			 * Ahead of the renderer, so what it decorates is the response the renderer
			 * produced and every surface this app adds later is covered without being asked.
			 */
			securityHeaders(SECURITY_POLICY),
			/**
			 * Inside the security headers, so `/.well-known/security.txt` is served under the same
			 * policy as every other response.
			 */
			wellKnown({ "security.txt": serve(securityTxt, () => SECURITY_TXT) }),
			/**
			 * After the security headers, whose nonce it publishes on `ctx.assets` for the
			 * document's inline import map, and before the renderer, so every page reads one lookup.
			 */
			documentShellAssets,
			render({ assets: assetResolver, onError: logRenderFailure }),
		],
		defaultHandler,
	});

	/**
	 * Mapped one leaf at a time: handing `router.map` a nested route map throws, so a group
	 * such as `feeds` is spread across calls rather than passed whole.
	 */
	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
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
		routes.reading,
		lazy(() => import("~/app/http/controllers/reading")),
	);
	router.map(
		routes.feed,
		lazy(() => import("~/app/http/controllers/feed")),
	);
	router.map(
		routes.folder,
		lazy(() => import("~/app/http/controllers/folders/show")),
	);
	router.map(
		routes.post,
		lazy(() => import("~/app/http/controllers/post")),
	);
	router.map(
		routes.folders.create,
		lazy(() => import("~/app/http/controllers/folders/create")),
	);
	router.map(
		routes.folders.rename,
		lazy(() => import("~/app/http/controllers/folders/rename")),
	);
	router.map(
		routes.folders.delete,
		lazy(() => import("~/app/http/controllers/folders/delete")),
	);
	router.map(
		routes.folders.file,
		lazy(() => import("~/app/http/controllers/folders/file")),
	);
	router.map(
		routes.saved,
		lazy(() => import("~/app/http/controllers/saved")),
	);
	router.map(
		routes.tag,
		lazy(() => import("~/app/http/controllers/tags/show")),
	);
	router.map(
		routes.tags.create,
		lazy(() => import("~/app/http/controllers/tags/create")),
	);
	router.map(
		routes.tags.rename,
		lazy(() => import("~/app/http/controllers/tags/rename")),
	);
	router.map(
		routes.tags.delete,
		lazy(() => import("~/app/http/controllers/tags/delete")),
	);
	router.map(
		routes.tags.apply,
		lazy(() => import("~/app/http/controllers/tags/apply")),
	);
	router.map(
		routes.tags.remove,
		lazy(() => import("~/app/http/controllers/tags/remove")),
	);
	router.map(
		routes.rules,
		lazy(() => import("~/app/http/controllers/rules/manage")),
	);
	router.map(
		routes.rule.update,
		lazy(() => import("~/app/http/controllers/rules/update")),
	);
	router.map(
		routes.rule.delete,
		lazy(() => import("~/app/http/controllers/rules/delete")),
	);
	router.map(
		routes.rule.apply,
		lazy(() => import("~/app/http/controllers/rules/apply")),
	);
	router.map(
		routes.searches.create,
		lazy(() => import("~/app/http/controllers/searches/save")),
	);
	router.map(
		routes.searches.delete,
		lazy(() => import("~/app/http/controllers/searches/forget")),
	);
	router.map(
		routes.feeds.pin,
		lazy(() => import("~/app/http/controllers/feeds/pin")),
	);
	router.map(
		routes.feeds.unfollow,
		lazy(() => import("~/app/http/controllers/feeds/unfollow")),
	);
	router.map(
		routes.feeds.refresh,
		lazy(() => import("~/app/http/controllers/feeds/refresh")),
	);
	router.map(
		routes.items.read,
		lazy(() => import("~/app/http/controllers/items/read")),
	);
	router.map(
		routes.items.save,
		lazy(() => import("~/app/http/controllers/items/save")),
	);
	router.map(
		routes.items.open,
		lazy(() => import("~/app/http/controllers/items/open")),
	);
	router.map(
		routes.readAll,
		lazy(() => import("~/app/http/controllers/read-all")),
	);
	router.map(
		routes.feeds.refreshAll,
		lazy(() => import("~/app/http/controllers/feeds/refresh-all")),
	);
	router.map(
		routes.feeds.read,
		lazy(() => import("~/app/http/controllers/feeds/read")),
	);
	router.map(
		routes.feeds.velocity,
		lazy(() => import("~/app/http/controllers/feeds/velocity")),
	);
	router.map(
		routes.feeds.export,
		lazy(() => import("~/app/http/controllers/feeds/export")),
	);
	router.map(
		routes.dataExport,
		lazy(() => import("~/app/http/controllers/data-export")),
	);
	router.map(
		routes.feeds.import,
		lazy(() => import("~/app/http/controllers/feeds/import")),
	);
	router.map(
		routes.sidebar.feeds,
		lazy(() => import("~/app/http/controllers/sidebar")),
	);
	router.map(
		routes.settings,
		lazy(() => import("~/app/http/controllers/settings")),
	);
	router.map(
		routes.appearance,
		lazy(() => import("~/app/http/controllers/appearance")),
	);
	router.map(
		routes.feeds.notify,
		lazy(() => import("~/app/http/controllers/feeds/notify")),
	);
	router.map(
		routes.notifications.channels,
		lazy(() => import("~/app/http/controllers/notifications/channels")),
	);
	router.map(
		routes.notifications.quietHours,
		lazy(() => import("~/app/http/controllers/notifications/quiet-hours")),
	);
	router.map(
		routes.notifications.devices,
		lazy(() => import("~/app/http/controllers/notifications/devices")),
	);
	router.map(
		routes.notifications.forget,
		lazy(() => import("~/app/http/controllers/notifications/forget")),
	);
	router.map(
		routes.notifications.timeZone,
		lazy(() => import("~/app/http/controllers/notifications/time-zone")),
	);
	router.map(
		routes.billing.checkout,
		lazy(() => import("~/app/http/controllers/billing/checkout")),
	);
	router.map(
		routes.billing.portal,
		lazy(() => import("~/app/http/controllers/billing/portal")),
	);
	router.map(
		routes.webhooks.billing,
		lazy(() => import("~/app/http/controllers/webhooks/billing")),
	);
	router.map(
		routes.feeds.linkParameters,
		lazy(() => import("~/app/http/controllers/feeds/link-parameters")),
	);
	/**
	 * The agent surface. A browser's `GET` renders the page explaining how to connect; an
	 * agent's `POST` is answered by the protocol handler, behind the credential middleware
	 * that turns a token into one reader and the burst limiter keyed on that token.
	 */
	router.map(
		routes.mcp.index,
		lazy(() => import("~/app/http/controllers/mcp")),
	);
	router.map(routes.mcp.action, {
		middleware: [requireAgent, agentRateLimit(env)],
		/**
		 * Imported here rather than through `lazy()`, because `requireAgent` publishes the agent
		 * the handlers read, so this stays an action object, whose `handler` must be a function.
		 * The server is built at module scope, so deferring the import keeps it off a cold
		 * start for every reader who never speaks to an agent.
		 */
		handler: async (ctx) => (await import("~/app/initializers/mcp")).default.fetch(ctx),
	});
	router.map(
		routes.tokens.create,
		lazy(() => import("~/app/http/controllers/tokens/mint")),
	);
	router.map(
		routes.tokens.revoke,
		lazy(() => import("~/app/http/controllers/tokens/revoke")),
	);
	router.map(
		routes.media,
		lazy(() => import("~/app/http/controllers/media")),
	);
	router.map(
		routes.websub,
		lazy(() => import("~/app/http/controllers/websub")),
	);
	router.map(
		routes.unsubscribe,
		lazy(() => import("~/app/http/controllers/unsubscribe")),
	);

	return router;
}
