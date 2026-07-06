/**
 * Route configuration for the auth app. Loads flat file-system routes from
 * separate directories (auth, oauth, oidc, well-known, account, admin, api)
 * and mounts each group under its URL prefix, assembling the full route tree
 * for the OAuth/OIDC server and its account and admin surfaces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RouteConfig } from "@react-router/dev/routes";

import { prefix } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

let [
	rootRoutes,
	authRoutes,
	oauthRoutes,
	oidcRoutes,
	wellKnownRoutes,
	accountRoutes,
	adminRoutes,
	apiRoutes,
] = await Promise.all([
	flatRoutes(),
	flatRoutes({ rootDirectory: "./routes/auth" }),
	flatRoutes({ rootDirectory: "./routes/oauth" }),
	flatRoutes({ rootDirectory: "./routes/oidc" }),
	flatRoutes({ rootDirectory: "./routes/well-known" }),
	flatRoutes({ rootDirectory: "./routes/account" }),
	flatRoutes({ rootDirectory: "./routes/admin" }),
	flatRoutes({ rootDirectory: "./routes/api" }),
]);

export default [
	...rootRoutes,
	...prefix("auth", authRoutes),
	...prefix("oauth", oauthRoutes),
	...prefix("oidc", oidcRoutes),
	...prefix(".well-known", wellKnownRoutes),
	...prefix("account", accountRoutes),
	...prefix("admin", adminRoutes),
	...prefix("api", apiRoutes),
] satisfies RouteConfig;
