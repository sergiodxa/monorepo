/**
 * Assembles the engine's request pipeline: the global middleware stack and the
 * route→controller map, bound through {@link createEngineRouter} to the session
 * middleware and OIDC configuration an engine instance holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Issuer } from "@sdxc/auth/issuer";
import type { Middleware } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { createRouter } from "remix/router";

import type { EngineAuthConfig } from "./auth/oidc.js";

import appearance from "./appearance/controllers/cms.js";
import assets from "./assets/controllers/assets.js";
import { callback, login, logout } from "./auth/controllers/auth.js";
import { authMiddleware } from "./auth/middleware/auth.js";
import dashboard from "./cms/controllers/dashboard.js";
import postTypes from "./post-types/controllers/cms.js";
import posts from "./posts/controllers/cms.js";
import feed from "./posts/controllers/feed.js";
import post from "./posts/controllers/post.js";
import typeIndex from "./posts/controllers/type-index.js";
import roles from "./roles/controllers/cms.js";
import routes from "./routes.js";
import settings from "./settings/controllers/cms.js";
import oidcMiddleware from "./shared/middleware/oidc.js";
import renderMiddleware from "./shared/middleware/render.js";
import trailingSlash from "./shared/middleware/trailing-slash.js";
import notFound from "./shared/not-found.js";
import robots from "./syndication/controllers/robots.js";
import * as rss from "./syndication/controllers/rss.js";
import sitemap from "./syndication/controllers/sitemap.js";
import users from "./users/controllers/cms.js";

/** Dependencies the request pipeline is bound to. */
export interface EngineRouterDeps {
	sessionMiddleware: Middleware;
	oidc: EngineAuthConfig;
	/** Held by the engine instance, so a blog reads its provider's documents once. */
	issuer: Issuer;
}

/**
 * Builds the engine's fetch-router. `log()` heads the middleware chain so every
 * request publishes `ctx.log`, joining the host's log when one is current. Route
 * groups map in call order — dynamic public routes go last so fixed routes win,
 * and nested `map()` groups throw.
 * @param deps - The session middleware and OIDC config.
 * @returns A configured fetch-router ready to handle the request.
 */
export function createEngineRouter(deps: EngineRouterDeps) {
	let globalMiddleware: Middleware[] = [
		trailingSlash,
		log() as Middleware,
		oidcMiddleware(deps.oidc, deps.issuer),
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
