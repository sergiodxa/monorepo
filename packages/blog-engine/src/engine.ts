import type { Logger } from "@pkg/logger/request";
import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/fetch-router";

import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

import type { OIDCConfig } from "./auth/oidc";

import assets from "./http/controllers/assets";
import * as auth from "./http/controllers/auth";
import * as appearance from "./http/controllers/cms/appearance";
import dashboard from "./http/controllers/cms/dashboard";
import * as postTypes from "./http/controllers/cms/post-types";
import * as posts from "./http/controllers/cms/posts";
import * as roles from "./http/controllers/cms/roles";
import * as settings from "./http/controllers/cms/settings";
import * as users from "./http/controllers/cms/users";
import feed from "./http/controllers/feed";
import notFound from "./http/controllers/not-found";
import post from "./http/controllers/post";
import robots from "./http/controllers/robots";
import * as rss from "./http/controllers/rss";
import sitemap from "./http/controllers/sitemap";
import typeIndex from "./http/controllers/type-index";
import routes from "./routes";
import databaseMiddleware from "./shared/middleware/db";
import loggerMiddleware from "./shared/middleware/logger";
import oidcMiddleware from "./shared/middleware/oidc";
import { requireAuth, requirePermission } from "./shared/middleware/require-permission";
import trailingSlash from "./shared/middleware/trailing-slash";

/** Dependencies the request pipeline is bound to. */
export interface EngineRouterDeps {
	db: Database;
	logger: Logger;
	sessionMiddleware: Middleware;
	oidc: OIDCConfig;
}

/**
 * Builds the engine's fetch-router. Each request gets a fresh router so the
 * request-scoped logger can be injected (matching `@pkg/oidc-provider`). The
 * router maps one route group per `map()` call (nested route-map keys throw).
 */
export function createEngineRouter(deps: EngineRouterDeps) {
	let globalMiddleware: Middleware[] = [
		trailingSlash,
		loggerMiddleware(deps.logger),
		databaseMiddleware(deps.db),
		oidcMiddleware(deps.oidc),
		asyncContext(),
		deps.sessionMiddleware,
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
	router.map(routes.auth.login, { actions: { index: auth.loginIndex, action: auth.loginStart } });
	router.map(routes.auth.logout, {
		actions: { index: auth.logoutIndex, action: auth.logoutAction },
	});
	router.map(routes.auth.callback, auth.callback);

	// CMS (permission-gated per group; finer own-vs-any checks live in controllers).
	router.map(routes.cms.dashboard, {
		middleware: [requireAuth()],
		handler: dashboard as RequestHandler,
	});
	router.map(routes.cms.posts, {
		middleware: [requirePermission("posts.create")],
		actions: {
			index: posts.index,
			new: posts.newPost,
			create: posts.create,
			edit: posts.edit,
			update: posts.update,
			destroy: posts.destroy,
		},
	});
	router.map(routes.cms.postTypes, {
		middleware: [requirePermission("post_types.manage")],
		actions: {
			index: postTypes.index,
			new: postTypes.newType,
			create: postTypes.create,
			edit: postTypes.edit,
			update: postTypes.update,
			destroy: postTypes.destroy,
		},
	});
	router.map(routes.cms.users, {
		middleware: [requirePermission("users.manage")],
		actions: { index: users.index, edit: users.edit, update: users.update, destroy: users.destroy },
	});
	router.map(routes.cms.roles, {
		middleware: [requirePermission("roles.manage")],
		actions: {
			index: roles.index,
			new: roles.newRole,
			create: roles.create,
			edit: roles.edit,
			update: roles.update,
			destroy: roles.destroy,
		},
	});
	router.map(routes.cms.settings, {
		middleware: [requirePermission("settings.manage")],
		actions: { index: settings.index, action: settings.action_ },
	});
	router.map(routes.cms.appearance, {
		middleware: [requirePermission("appearance.manage")],
		actions: { index: appearance.index, action: appearance.action_ },
	});

	// Dynamic public routes registered last so fixed routes win.
	router.map(routes.typeIndex, typeIndex);
	router.map(routes.post, post);

	return router;
}
