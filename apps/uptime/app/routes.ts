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
