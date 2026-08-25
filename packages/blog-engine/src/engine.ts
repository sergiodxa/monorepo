/**
 * Assembles the engine's request pipeline: the global middleware stack and the
 * route→controller map. A fresh router is built per request (via
 * {@link createEngineRouter}) so the request-scoped logger can be injected.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Logger } from "@pkg/logger/request";
import type { Middleware } from "remix/router";

import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { createRouter } from "remix/router";

import type { EngineAuthConfig } from "./auth/oidc";

import appearance from "./appearance/controllers/cms";
import assets from "./assets/controllers/assets";
import { callback, login, logout } from "./auth/controllers/auth";
import { authMiddleware } from "./auth/middleware/auth";
import dashboard from "./cms/controllers/dashboard";
import postTypes from "./post-types/controllers/cms";
import posts from "./posts/controllers/cms";
import feed from "./posts/controllers/feed";
import post from "./posts/controllers/post";
import typeIndex from "./posts/controllers/type-index";
import roles from "./roles/controllers/cms";
import routes from "./routes";
import settings from "./settings/controllers/cms";
import loggerMiddleware from "./shared/middleware/logger";
import oidcMiddleware from "./shared/middleware/oidc";
import renderMiddleware from "./shared/middleware/render";
import trailingSlash from "./shared/middleware/trailing-slash";
import notFound from "./shared/not-found";
import robots from "./syndication/controllers/robots";
import * as rss from "./syndication/controllers/rss";
import sitemap from "./syndication/controllers/sitemap";
import users from "./users/controllers/cms";

/** Dependencies the request pipeline is bound to. */
export interface EngineRouterDeps {
	logger: Logger;
	sessionMiddleware: Middleware;
	oidc: EngineAuthConfig;
}

/**
 * Builds the engine's fetch-router, fresh per request so the request-scoped
 * logger can be injected. Route groups map in call order — dynamic public
 * routes go last so fixed routes win, and nested `map()` groups throw.
 * @param deps - The request-scoped logger, session middleware, and OIDC config.
 * @returns A configured fetch-router ready to handle the request.
 */
export function createEngineRouter(deps: EngineRouterDeps) {
	let globalMiddleware: Middleware[] = [
		trailingSlash,
		loggerMiddleware(deps.logger),
		oidcMiddleware(deps.oidc),
		renderMiddleware as Middleware,
		asyncContext(),
		deps.sessionMiddleware,
		authMiddleware as Middleware,
		cop(),
		formData() as Middleware,
		methodOverride(),
	];

	let router = createRouter({ middleware: globalMiddleware, defaultHandler: notFound });

	router.map(routes.feed, feed);
	router.map(routes.rss, rss.feedRss);
	router.map(routes.typeRss, rss.typeRss);
	router.map(routes.sitemap, sitemap);
	router.map(routes.robots, robots);
	router.map(routes.assets, assets);

	router.map(routes.auth.login, login);
	router.map(routes.auth.logout, logout);
	router.map(routes.auth.callback, callback);

	router.map(routes.cms.dashboard, dashboard);
	router.map(routes.cms.posts, posts);
	router.map(routes.cms.postTypes, postTypes);
	router.map(routes.cms.users, users);
	router.map(routes.cms.roles, roles);
	router.map(routes.cms.settings, settings);
	router.map(routes.cms.appearance, appearance);

	router.map(routes.typeIndex, typeIndex);
	router.map(routes.post, post);

	return router;
}
