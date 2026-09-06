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
import auth from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import { createHtmlRenderer } from "~/app/http/render";
import routes from "~/routes/web";

import { logger } from "./logger";

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
		/** Stays after `auth`, whose viewer decides which language preference is in scope. */
		i18n,
		cop(),
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
		routes.feeds.index,
		lazy(() => import("~/app/http/controllers/feeds/index")),
	);
	router.map(
		routes.feeds.show,
		lazy(() => import("~/app/http/controllers/feeds/show")),
	);
	router.map(
		routes.feeds.follow,
		lazy(() => import("~/app/http/controllers/feeds/follow")),
	);
	router.map(
		routes.feeds.unfollow,
		lazy(() => import("~/app/http/controllers/feeds/unfollow")),
	);
	router.map(
		routes.items.read,
		lazy(() => import("~/app/http/controllers/items/read")),
	);
	router.map(
		routes.settings,
		lazy(() => import("~/app/http/controllers/settings")),
	);

	return router;
}
