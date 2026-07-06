/**
 * Route manifest for the uptime app. Loads flat file-system routes from four
 * separate directories (public, app, api, actions) in parallel and combines them
 * into a single config, prefixing the latter three with `/app`, `/api`, and
 * `/actions`. It exists to organise the app's URL structure by concern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RouteConfig } from "@react-router/dev/routes";

import { prefix } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

const [publicRoutes, appRoutes, apiRoutes, actionRoutes] = await Promise.all([
	flatRoutes({ rootDirectory: "./routes" }),
	flatRoutes({ rootDirectory: "./routes/app" }),
	flatRoutes({ rootDirectory: "./routes/api" }),
	flatRoutes({ rootDirectory: "./routes/actions" }),
]);

export default [
	...publicRoutes,
	...prefix("/app", appRoutes),
	...prefix("/api", apiRoutes),
	...prefix("/actions", actionRoutes),
] satisfies RouteConfig;
