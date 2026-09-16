/**
 * Assembles the app's fetch-router: the global middleware stack (head requests, async
 * context, logging, form data, method override, session, auth, language resolution,
 * cross-origin protection, HTML rendering) followed by every route mapped to its
 * controller. It is the composition root the worker and any router-level test share.
 *
 * Every route is mapped through `lazy()`, so the URL surface is complete at startup while
 * each controller is imported by the first request that reaches it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import featureFlags from "@sdxc/flags/middleware/router";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import auth, { getViewer } from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import { createHtmlRenderer } from "~/app/http/render";
import { flags } from "~/app/lib/flags";
import routes from "~/routes/web";

import { logger } from "./logger";

/**
 * The callback a publisher's hub delivers to, in the pattern language `cop()` matches
 * bypasses by. Both methods are named, since the verification arrives as a `GET`.
 */
const WEBSUB_CALLBACK = "/websub/{feedId}/{token}";

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
	 * Typed as `Middleware[]` because each entry publishes its context value through a
	 * `declare module "remix/router"` augmentation in its own module, so the router's
	 * context typing already comes from there.
	 */
	let globalMiddleware: Middleware[] = [
		/**
		 * Runs first so the session, the auth resolver, and cross-origin protection all see
		 * a plain `GET` and treat a `HEAD` probe exactly like the request behind it.
		 */
		headRequests(),
		asyncContext(),
		log(logger) as Middleware,
		formData() as Middleware,
		methodOverride(),
		createSessionMiddleware(options.kv, options.cookieSecret, options.secure) as Middleware,
		auth as Middleware,
		/**
		 * Publishes `ctx.flags` on every surface. It stays after `auth` because the subject
		 * targeting is written against is the signed-in reader, and a rule that names one
		 * reader is the whole reason an evaluation carries a subject at all.
		 */
		featureFlags(flags, { context: () => ({ targetingKey: getViewer()?.id }) }) as Middleware,
		/** Stays after `auth`, whose viewer decides which language preference is in scope. */
		i18n,
		/**
		 * A publisher's hub is a cross-origin caller by construction, and a notification is
		 * exactly the unsafe cross-origin `POST` the default refusal is written to reject, so
		 * the callback states its own provenance instead: an unguessable token in the path
		 * and an HMAC over the delivery.
		 */
		cop({ insecureBypassPatterns: [WEBSUB_CALLBACK] }),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({ middleware: globalMiddleware, defaultHandler });

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
		routes.websub,
		lazy(() => import("~/app/http/controllers/websub")),
	);

	return router;
}
