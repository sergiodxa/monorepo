import type { Logger } from "@pkg/logger/request";
import type { Database } from "remix/data-table";
import type { Middleware } from "remix/fetch-router";

import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

import type { OIDCConfig } from "./auth/oidc";

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
import databaseMiddleware from "./shared/middleware/db";
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
	db: Database;
	logger: Logger;
	sessionMiddleware: Middleware;
	oidc: OIDCConfig;
}

/**
 * Builds the engine's fetch-router. Each request gets a fresh router so the
 * request-scoped logger can be injected (matching `@pkg/oidc-provider`). Each CMS
 * controller carries its own permission middleware, so the router just maps
 * route→controller (one group per `map()`; nested route-map keys throw).
 */
export function createEngineRouter(deps: EngineRouterDeps) {
	let globalMiddleware: Middleware[] = [
		trailingSlash,
		loggerMiddleware(deps.logger),
		databaseMiddleware(deps.db),
		oidcMiddleware(deps.oidc),
		renderMiddleware as Middleware,
		asyncContext(),
		deps.sessionMiddleware,
		authMiddleware as Middleware,
		formData() as Middleware,
		methodOverride(),
	];

	let router = createRouter({ middleware: globalMiddleware, defaultHandler: notFound });

	// Public + feeds + assets.
	router.map(routes.feed, feed);
	router.map(routes.rss, rss.feedRss);
	router.map(routes.typeRss, rss.typeRss);
	router.map(routes.sitemap, sitemap);
	router.map(routes.robots, robots);
	router.map(routes.assets, assets);

	// Auth.
	router.map(routes.auth.login, login);
	router.map(routes.auth.logout, logout);
	router.map(routes.auth.callback, callback);

	// CMS (each controller declares its own permission middleware).
	router.map(routes.cms.dashboard, dashboard);
	router.map(routes.cms.posts, posts);
	router.map(routes.cms.postTypes, postTypes);
	router.map(routes.cms.users, users);
	router.map(routes.cms.roles, roles);
	router.map(routes.cms.settings, settings);
	router.map(routes.cms.appearance, appearance);

	// Dynamic public routes registered last so fixed routes win.
	router.map(routes.typeIndex, typeIndex);
	router.map(routes.post, post);

	return router;
}
