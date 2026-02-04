import type { RouteConfig } from "@react-router/dev/routes";

import { prefix } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

const [publicRoutes, apiRoutes] = await Promise.all([
	flatRoutes({ rootDirectory: "./routes" }),
	flatRoutes({ rootDirectory: "./routes/api" }),
]);

export default [...publicRoutes, ...prefix("/api", apiRoutes)] satisfies RouteConfig;
